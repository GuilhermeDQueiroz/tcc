BEGIN;
CREATE TABLE IF NOT EXISTS posvenda.registro (
 execucao_id uuid NOT NULL REFERENCES posvenda.execucao(id),categoria text NOT NULL CHECK(categoria IN ('assistencias','cancelamentos','devolucoes')),
 registro_id bigint NOT NULL,documento_id bigint NOT NULL,pedido_id bigint,produto_id bigint,empresa_id bigint,
 data date NOT NULL,emissao_original date,previsao date,tipo_documento smallint NOT NULL,
 cliente text,uf text,cidade text,produto text,motivo text,status_erp text,modalidade text,
 quantidade numeric NOT NULL,quantidade_aberta numeric,quantidade_faturada numeric,quantidade_cancelada numeric,
 valor numeric,valor_aberto numeric,valor_unitario numeric,cliente_id bigint,
 PRIMARY KEY(execucao_id,categoria,registro_id)
);
ALTER TABLE posvenda.registro ADD COLUMN IF NOT EXISTS cliente_id bigint;
CREATE INDEX IF NOT EXISTS posvenda_registro_categoria_data ON posvenda.registro(execucao_id,categoria,data);

-- One row per original assistance item. Snapshot balances are never added to
-- cancellation events; those have a separate grain and publication category.
INSERT INTO posvenda.registro
SELECT '${ETL_RUN_ID}','assistencias',i.autoinc_docitemdet,d.codigo_docfat,d.codigo_docfat,di.item_docitem,d.empresa_docfat,
 d.dtemissao_docfat::date,d.dtemissao_docfat::date,p.dtdprevisao::date,d.tipo_docfat,
 c.razaosocial_pessoa,u.sigla_uf,city.descricao_cidade,product.descricao_item,m.descricao_motivo,s.descricao_status,
 CASE di.tipoassistencia_docitem WHEN 1 THEN 'Reparo' WHEN 2 THEN 'Troca' WHEN 3 THEN 'Reposição' ELSE 'Não informado' END,
 i.qtdechapas_docitemdet,i.qtdeaberta_docitemdet,i.qtdefaturado_docitemdet,i.qtdecancelado_docitemdet,
 i.vlrbrutoliquido_docitemdet,i.qtdeaberta_docitemdet*(i.vlrbrutoliquido_docitemdet/NULLIF(i.qtdechapas_docitemdet,0)),i.vlrbrutoliquido_docitemdet/NULLIF(i.qtdechapas_docitemdet,0),d.cliente_docfat
FROM posvenda_stage.documento_fatura d
JOIN posvenda_stage.documento_item di ON di.documento_docitem=d.codigo_docfat
JOIN posvenda_stage.documento_item_detalhe i ON i.autoincitem_docitemdet=di.autoinc_docitem
LEFT JOIN (SELECT documento_docped,dtprevisaofaturamento_docped AS dtdprevisao FROM posvenda_stage.documento_pedido) p ON p.documento_docped=d.codigo_docfat
LEFT JOIN posvenda_stage.pessoa c ON c.codigo_pessoa=d.cliente_docfat
LEFT JOIN posvenda_stage.pessoa_endereco a ON a.autoinc_pessoa_end=d.localentrega_docfat
LEFT JOIN posvenda_stage.cidade city ON city.codigo_cidade=a.cidade_pessoa_end
LEFT JOIN posvenda_stage.uf u ON u.codigo_uf=city.uf_cidade
LEFT JOIN posvenda_stage.item product ON product.codigo_item=di.item_docitem
LEFT JOIN posvenda_stage.motivo m ON m.codigo_motivo=COALESCE(NULLIF(di.motivo_docitem,0),d.motivo_docfat)
LEFT JOIN posvenda_stage.status s ON s.codigo_status=d.status_docfat
WHERE d.tipo_docfat=2 AND d.opcao_docfat=1 AND d.entrega_docfat='N'
 AND d.dtemissao_docfat::date BETWEEN '${AFTERSALES_START_DATE}' AND '${AFTERSALES_REFERENCE_DATE}'
 AND di.autoinc_docitem=di.composicaoitem_docitem AND di.tipo_docitem IN (1,4)
 AND c.grupo_pessoa IS DISTINCT FROM 1603;

-- Cancellation events point to the original sales item through DOCDEV. Use
-- event dates and quantities, never sum the cumulative cancelled balance again.
INSERT INTO posvenda.registro
SELECT '${ETL_RUN_ID}','cancelamentos',v.autoinc_docdev,e.codigo_docfat,o.codigo_docfat,di.item_docitem,e.empresa_docfat,
 e.dtemissao_docfat::date,o.dtemissao_docfat::date,NULL,e.tipo_docfat,
 c.razaosocial_pessoa,u.sigla_uf,city.descricao_cidade,product.descricao_item,m.descricao_motivo,s.descricao_status,'Venda',
 v.quantidade_docdev,i.qtdeaberta_docitemdet,i.qtdefaturado_docitemdet,i.qtdecancelado_docitemdet,
 v.quantidade_docdev*(i.vlrbrutoliquido_docitemdet/NULLIF(i.qtdechapas_docitemdet,0)),NULL,i.vlrbrutoliquido_docitemdet/NULLIF(i.qtdechapas_docitemdet,0),o.cliente_docfat
FROM posvenda_stage.documento_devolucaocancela v
JOIN posvenda_stage.documento_fatura e ON e.codigo_docfat=v.documento_docdev
JOIN posvenda_stage.documento_item_detalhe i ON i.autoinc_docitemdet=v.autoincitemdetdoc_docdev
JOIN posvenda_stage.documento_item di ON di.autoinc_docitem=i.autoincitem_docitemdet
JOIN posvenda_stage.documento_fatura o ON o.codigo_docfat=di.documento_docitem
LEFT JOIN posvenda_stage.pessoa c ON c.codigo_pessoa=o.cliente_docfat
LEFT JOIN posvenda_stage.pessoa_endereco a ON a.autoinc_pessoa_end=o.localentrega_docfat
LEFT JOIN posvenda_stage.cidade city ON city.codigo_cidade=a.cidade_pessoa_end
LEFT JOIN posvenda_stage.uf u ON u.codigo_uf=city.uf_cidade
LEFT JOIN posvenda_stage.item product ON product.codigo_item=di.item_docitem
LEFT JOIN posvenda_stage.motivo m ON m.codigo_motivo=COALESCE(NULLIF(v.motivodevolucao_docdev,0),e.motivo_docfat)
LEFT JOIN posvenda_stage.status s ON s.codigo_status=o.status_docfat
WHERE e.tipo_docfat=1 AND e.opcao_docfat=2 AND e.entrega_docfat='N'
 AND o.tipo_docfat=1 AND o.opcao_docfat=1 AND o.entrega_docfat='N'
 AND e.dtemissao_docfat::date BETWEEN '${AFTERSALES_START_DATE}' AND '${AFTERSALES_REFERENCE_DATE}'
 AND di.autoinc_docitem=di.composicaoitem_docitem AND di.tipo_docitem IN (1,4) AND v.quantidade_docdev>0
 AND c.grupo_pessoa IS DISTINCT FROM 1603;

-- Returns use DOCENTDEV -> DOCENT -> original item detail, not DOCDEV.
-- One row per return link; sales and assistance remain separate dimensions.
INSERT INTO posvenda.registro
SELECT '${ETL_RUN_ID}','devolucoes',v.autoinc_docentdev,d.codigo_docfat,o.codigo_docfat,di.item_docitem,d.empresa_docfat,
 d.dtemissao_docfat::date,o.dtemissao_docfat::date,NULL,d.tipo_docfat,
 c.razaosocial_pessoa,u.sigla_uf,city.descricao_cidade,product.descricao_item,m.descricao_motivo,s.descricao_status,
 CASE d.tipo_docfat WHEN 1 THEN 'Venda' ELSE 'Assistência' END,
 v.qtdechapas_docentdev,NULL,NULL,NULL,v.qtdechapas_docentdev*(i.vlrbrutoliquido_docitemdet/NULLIF(i.qtdechapas_docitemdet,0)),NULL,i.vlrbrutoliquido_docitemdet/NULLIF(i.qtdechapas_docitemdet,0),d.cliente_docfat
FROM posvenda_stage.documento_fatura d
JOIN posvenda_stage.documento_entrega_devcan v ON v.documento_docentdev=d.codigo_docfat
JOIN posvenda_stage.documento_entrega t ON t.autoinc_docent=v.autoincdocent_docentdev
JOIN posvenda_stage.documento_item_detalhe i ON i.autoinc_docitemdet=t.autoincitemdetdoc_docent
JOIN posvenda_stage.documento_item di ON di.autoinc_docitem=i.autoincitem_docitemdet
JOIN posvenda_stage.documento_fatura o ON o.codigo_docfat=di.documento_docitem
LEFT JOIN posvenda_stage.pessoa c ON c.codigo_pessoa=d.cliente_docfat
LEFT JOIN posvenda_stage.pessoa_endereco a ON a.autoinc_pessoa_end=d.localentrega_docfat
LEFT JOIN posvenda_stage.cidade city ON city.codigo_cidade=a.cidade_pessoa_end
LEFT JOIN posvenda_stage.uf u ON u.codigo_uf=city.uf_cidade
LEFT JOIN posvenda_stage.item product ON product.codigo_item=di.item_docitem
LEFT JOIN posvenda_stage.motivo m ON m.codigo_motivo=COALESCE(NULLIF(v.motivo_docentdev,0),d.motivo_docfat)
LEFT JOIN posvenda_stage.status s ON s.codigo_status=d.status_docfat
WHERE d.tipo_docfat IN (1,2) AND d.opcao_docfat=4 AND d.entrega_docfat='N'
 AND v.opcaodocumento_docentdev=4 AND t.tipo_docent=1 AND v.qtdechapas_docentdev>0
 AND d.dtemissao_docfat::date BETWEEN '${AFTERSALES_START_DATE}' AND '${AFTERSALES_REFERENCE_DATE}'
 AND di.autoinc_docitem=di.composicaoitem_docitem AND di.tipo_docitem IN (1,4)
 AND c.grupo_pessoa IS DISTINCT FROM 1603;

-- Validate expected native grains and protect the prior publication on failure.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM posvenda_stage.documento_devolucaocancela v
 JOIN posvenda_stage.documento_fatura e ON e.codigo_docfat=v.documento_docdev
 LEFT JOIN posvenda_stage.documento_item_detalhe i ON i.autoinc_docitemdet=v.autoincitemdetdoc_docdev
 WHERE e.tipo_docfat=1 AND e.opcao_docfat=2 AND i.autoinc_docitemdet IS NULL)
 THEN RAISE EXCEPTION 'Cancelamento sem item original; publicação interrompida'; END IF;
 IF EXISTS(SELECT 1 FROM posvenda_stage.documento_entrega_devcan v
 JOIN posvenda_stage.documento_fatura e ON e.codigo_docfat=v.documento_docentdev
 LEFT JOIN posvenda_stage.documento_entrega t ON t.autoinc_docent=v.autoincdocent_docentdev
 LEFT JOIN posvenda_stage.documento_item_detalhe i ON i.autoinc_docitemdet=t.autoincitemdetdoc_docent
 WHERE e.opcao_docfat=4 AND v.opcaodocumento_docentdev=4 AND (t.autoinc_docent IS NULL OR i.autoinc_docitemdet IS NULL))
 THEN RAISE EXCEPTION 'Devolução sem vínculo original; publicação interrompida'; END IF;
 IF EXISTS(SELECT 1 FROM posvenda.registro WHERE execucao_id='${ETL_RUN_ID}' AND quantidade<0)
 THEN RAISE EXCEPTION 'Quantidade negativa em pós-venda; reconciliar origem'; END IF;
END $$;
UPDATE posvenda.execucao SET status='publicado',fim=now(),contagens=(
 SELECT jsonb_object_agg(categoria,n) FROM (SELECT categoria,count(*) AS n FROM posvenda.registro WHERE execucao_id='${ETL_RUN_ID}' GROUP BY categoria) x
) WHERE id='${ETL_RUN_ID}';
INSERT INTO posvenda.publicacao(singleton,execucao_id) VALUES(true,'${ETL_RUN_ID}')
ON CONFLICT(singleton) DO UPDATE SET execucao_id=EXCLUDED.execucao_id;
COMMIT;

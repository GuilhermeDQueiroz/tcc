BEGIN;
CREATE TABLE IF NOT EXISTS logistica.item_pedido (
  execucao_id uuid NOT NULL REFERENCES logistica.execucao(id), item_id bigint NOT NULL,
  pedido_id bigint NOT NULL, empresa_id bigint NOT NULL, produto_id bigint, emissao date NOT NULL,
  previsao_faturamento date, promessa_entrega date,
  quantidade_aberta numeric NOT NULL, quantidade_alocada numeric NOT NULL, quantidade_sem_carga numeric NOT NULL,
  quantidade_faturada numeric NOT NULL, quantidade_cancelada numeric NOT NULL, quantidade_carga_origem numeric NOT NULL,
  quantidade_carga_faturada numeric NOT NULL, cargas integer NOT NULL, valor_aberto numeric, valor_unitario numeric,
  PRIMARY KEY(execucao_id,item_id)
);
CREATE TABLE IF NOT EXISTS logistica.alocacao (
  execucao_id uuid NOT NULL REFERENCES logistica.execucao(id), alocacao_id bigint NOT NULL,
  item_id bigint NOT NULL, pedido_id bigint NOT NULL, empresa_id bigint NOT NULL, carga_id bigint NOT NULL,
  empresa_carga_id bigint NOT NULL, quantidade_aberta numeric NOT NULL, quantidade_faturada numeric NOT NULL,
  emissao date, inicio_separacao timestamp, fim_separacao timestamp, inicio_conferencia timestamp,
  fim_conferencia timestamp, fechamento timestamp, liberacao_saida timestamp,
  PRIMARY KEY(execucao_id,alocacao_id),
  FOREIGN KEY(execucao_id,item_id) REFERENCES logistica.item_pedido(execucao_id,item_id)
);

-- Aggregate each allocation bridge BEFORE joining order items: one item can occupy many loads.
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS peso_unitario numeric;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS cubagem_unitaria numeric;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS cliente_id bigint;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS cliente text;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS produto text;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS status_erp text;
ALTER TABLE logistica.item_pedido ADD COLUMN IF NOT EXISTS tipo_entrega text;
ALTER TABLE logistica.alocacao ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE logistica.alocacao ADD COLUMN IF NOT EXISTS previsao_faturamento date;

INSERT INTO logistica.item_pedido(execucao_id,item_id,pedido_id,empresa_id,produto_id,emissao,previsao_faturamento,promessa_entrega,
 quantidade_aberta,quantidade_alocada,quantidade_sem_carga,quantidade_faturada,quantidade_cancelada,quantidade_carga_origem,quantidade_carga_faturada,cargas,valor_aberto,valor_unitario)
SELECT '${ETL_RUN_ID}', i.autoinc_docitemdet, d.codigo_docfat, d.empresa_docfat, i.item_docitemdet,
 d.dtemissao_docfat::date, p.dtprevisaofaturamento_docped::date, p.dtpromessaentrega_docped::date,
 i.qtdeaberta_docitemdet, COALESCE(a.aberta,0), i.qtdeaberta_docitemdet-COALESCE(a.aberta,0),
 COALESCE(i.qtdefaturado_docitemdet,0), COALESCE(i.qtdecancelado_docitemdet,0),
 COALESCE(i.qtdecarga_docitemdet,0), COALESCE(i.qtdecargafat_docitemdet,0), COALESCE(a.cargas,0),
 TRUNC(i.vlrbrutoliquido_docitemdet::numeric / NULLIF(i.qtdechapas_docitemdet,0),6)*i.qtdeaberta_docitemdet,
 TRUNC(i.vlrbrutoliquido_docitemdet::numeric / NULLIF(i.qtdechapas_docitemdet,0),6)
FROM logistica_stage.documento_item_detalhe i
JOIN logistica_stage.documento_item di ON di.autoinc_docitem=i.autoincitem_docitemdet
JOIN logistica_stage.documento_fatura d ON d.codigo_docfat=di.documento_docitem
LEFT JOIN logistica_stage.documento_pedido p ON p.documento_docped=d.codigo_docfat
LEFT JOIN (
 SELECT ci.autoincitemdetdoc_carite AS item_id, SUM(ci.qtdeaberta_carite) AS aberta,
 COUNT(DISTINCT cd.carga_cardoc) FILTER(WHERE ci.qtdeaberta_carite>0)::integer AS cargas
 FROM logistica_stage.carga_itens ci
 JOIN logistica_stage.carga_documentos cd ON cd.autoinc_cardoc=ci.autoinccardoc_carite
 GROUP BY ci.autoincitemdetdoc_carite
) a ON a.item_id=i.autoinc_docitemdet;

UPDATE logistica.item_pedido ip SET
 peso_unitario=CASE WHEN v.pesobruto_item_detalhe>0 THEN v.pesobruto_item_detalhe WHEN m.pesobruto_item>0 THEN m.pesobruto_item ELSE NULL END,
 cubagem_unitaria=CASE WHEN v.volumem3_item_detalhe>0 THEN v.volumem3_item_detalhe WHEN m.volumem3_item>0 AND m.volumem3_item<10 THEN m.volumem3_item ELSE NULL END,
 cliente_id=d.cliente_docfat,cliente=COALESCE(p.razaosocial_pessoa,'Cliente '||d.cliente_docfat),produto=m.descricao_item,
 uf=uf.sigla_uf,cidade=city.descricao_cidade,status_erp=s.descricao_status,
 latitude=CASE WHEN address.latitude_pessoa_end BETWEEN -34 AND 6 AND address.latitude_pessoa_end<>0 AND address.longitude_pessoa_end BETWEEN -74 AND -34 THEN address.latitude_pessoa_end END,
 longitude=CASE WHEN address.latitude_pessoa_end BETWEEN -34 AND 6 AND address.latitude_pessoa_end<>0 AND address.longitude_pessoa_end BETWEEN -74 AND -34 THEN address.longitude_pessoa_end END,
 tipo_entrega=CASE TRIM(d.entregarmercadoria_docfat) WHEN 'S' THEN 'Entrega' WHEN 'N' THEN 'Retirada' ELSE 'Não informado' END
FROM logistica_stage.documento_item_detalhe i
JOIN logistica_stage.documento_fatura d ON d.codigo_docfat=i.documento_docitemdet
LEFT JOIN logistica_stage.item m ON m.codigo_item=i.item_docitemdet
LEFT JOIN logistica_stage.item_detalhe v ON v.autoinc_item_detalhe=i.autoincitemdetalhe_docitemdet
LEFT JOIN logistica_stage.pessoa p ON p.codigo_pessoa=d.cliente_docfat
LEFT JOIN logistica_stage.pessoa_endereco address ON address.autoinc_pessoa_end=d.localentrega_docfat
LEFT JOIN logistica_stage.cidade city ON city.codigo_cidade=address.cidade_pessoa_end
LEFT JOIN logistica_stage.uf uf ON uf.codigo_uf=city.uf_cidade
LEFT JOIN logistica_stage.status s ON s.codigo_status=d.status_docfat
WHERE ip.execucao_id='${ETL_RUN_ID}' AND ip.item_id=i.autoinc_docitemdet;

INSERT INTO logistica.alocacao(execucao_id,alocacao_id,item_id,pedido_id,empresa_id,carga_id,empresa_carga_id,quantidade_aberta,quantidade_faturada,
 emissao,inicio_separacao,fim_separacao,inicio_conferencia,fim_conferencia,fechamento,liberacao_saida,descricao,previsao_faturamento)
SELECT '${ETL_RUN_ID}', ci.autoinc_carite, ci.autoincitemdetdoc_carite, ip.pedido_id, ip.empresa_id,
 cd.carga_cardoc, c.empresa_carga, COALESCE(ci.qtdeaberta_carite,0), COALESCE(ci.qtdefaturado_carite,0),
 c.dtemissao_carga::date, c.datainicio_separacao_carga, c.data_separacao_carga,
 c.datainicio_conferencia_carga, c.data_conferencia_carga, c.datahorafechamento_carga, c.datahoralib_saida_carga,c.descricao_carga,
 COALESCE(cd.dtprevisaofaturamento_cardoc::date,c.dtprevisaofaturamento_carga::date,ip.previsao_faturamento)
FROM logistica_stage.carga_itens ci
JOIN logistica_stage.carga_documentos cd ON cd.autoinc_cardoc=ci.autoinccardoc_carite
JOIN logistica_stage.carga c ON c.codigo_carga=cd.carga_cardoc
JOIN logistica.item_pedido ip ON ip.item_id=ci.autoincitemdetdoc_carite AND ip.execucao_id='${ETL_RUN_ID}';

DO $validation$
BEGIN
 IF (SELECT COUNT(*) FROM logistica.item_pedido WHERE execucao_id='${ETL_RUN_ID}') <> (SELECT COUNT(*) FROM logistica_stage.documento_item_detalhe) THEN
  RAISE EXCEPTION 'Quantidade de itens transformados diverge do staging'; END IF;
 IF (SELECT COUNT(*) FROM logistica.alocacao WHERE execucao_id='${ETL_RUN_ID}') <> (SELECT COUNT(*) FROM logistica_stage.carga_itens) THEN
  RAISE EXCEPTION 'Alocação órfã: relação item/documento/carga incompleta'; END IF;
 IF EXISTS (SELECT 1 FROM logistica_stage.carga_itens WHERE qtdeaberta_carite IS NULL OR qtdeaberta_carite<0) THEN
  RAISE EXCEPTION 'Alocação com quantidade inválida'; END IF;
 IF EXISTS (SELECT 1 FROM logistica_stage.documento_item_detalhe i JOIN logistica_stage.documento_item di
  ON di.autoinc_docitem=i.autoincitem_docitemdet WHERE i.documento_docitemdet<>di.documento_docitem) THEN
  RAISE EXCEPTION 'Pedido do detalhe diverge do pedido do item'; END IF;
 IF EXISTS (SELECT 1 FROM logistica.item_pedido WHERE execucao_id='${ETL_RUN_ID}' AND
  (quantidade_aberta<=0 OR quantidade_alocada<0 OR quantidade_sem_carga<0 OR ABS(quantidade_alocada-(quantidade_carga_origem-quantidade_carga_faturada))>0.000001)) THEN
  RAISE EXCEPTION 'Saldo de carga não concilia com o item de pedido'; END IF;
 IF EXISTS (SELECT 1 FROM logistica_stage.carga_itens ci JOIN logistica_stage.carga_documentos cd ON cd.autoinc_cardoc=ci.autoinccardoc_carite
  JOIN logistica.item_pedido ip ON ip.item_id=ci.autoincitemdetdoc_carite AND ip.execucao_id='${ETL_RUN_ID}' WHERE cd.documento_cardoc<>ip.pedido_id) THEN
  RAISE EXCEPTION 'Pedido do vínculo de carga diverge do pedido do item'; END IF;
END $validation$;

UPDATE logistica.execucao SET status='publicado',fim=now(),contagens=jsonb_build_object(
 'itens',(SELECT COUNT(*) FROM logistica.item_pedido WHERE execucao_id='${ETL_RUN_ID}'),
 'pedidos',(SELECT COUNT(DISTINCT pedido_id) FROM logistica.item_pedido WHERE execucao_id='${ETL_RUN_ID}'),
 'alocacoes',(SELECT COUNT(*) FROM logistica.alocacao WHERE execucao_id='${ETL_RUN_ID}'),
 'cargas_ativas',(SELECT COUNT(DISTINCT carga_id) FROM logistica.alocacao WHERE execucao_id='${ETL_RUN_ID}' AND quantidade_aberta>0)
) WHERE id='${ETL_RUN_ID}';
INSERT INTO logistica.publicacao(singleton,execucao_id) VALUES(true,'${ETL_RUN_ID}')
 ON CONFLICT(singleton) DO UPDATE SET execucao_id=EXCLUDED.execucao_id;
COMMIT;

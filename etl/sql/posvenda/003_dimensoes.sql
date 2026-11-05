-- Freeze descriptive dimensions separately from the immutable event measures.
-- Sources are the existing, published ERP mirrors; no amounts are updated.
BEGIN;
SELECT pg_advisory_xact_lock(741083,0);
CREATE TABLE IF NOT EXISTS posvenda.dimensoes (
 execucao_id uuid NOT NULL,categoria text NOT NULL,registro_id bigint NOT NULL,
 versao_id uuid NOT NULL,comercial_execucao_id uuid NOT NULL REFERENCES etl.execucao_carga(id),
 atributos jsonb NOT NULL,publicado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(execucao_id,categoria,registro_id),
 FOREIGN KEY(execucao_id,categoria,registro_id) REFERENCES posvenda.registro(execucao_id,categoria,registro_id)
);
CREATE TEMP TABLE dimensoes_contexto ON COMMIT DROP AS
SELECT p.execucao_id,
 (SELECT id FROM etl.execucao_carga WHERE status='publicado' ORDER BY fim DESC LIMIT 1) AS comercial_id
FROM posvenda.publicacao p JOIN posvenda.execucao e ON e.id=p.execucao_id AND e.status='publicado';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM dimensoes_contexto WHERE comercial_id IS NOT NULL)
 THEN RAISE EXCEPTION 'São necessárias publicações válidas de pós-venda e comercial'; END IF;
 IF EXISTS(SELECT 1 FROM etl.execucao_carga WHERE status='executando')
 THEN RAISE EXCEPTION 'Aguarde a publicação comercial terminar'; END IF;
END $$;
DELETE FROM posvenda.dimensoes WHERE execucao_id IN (SELECT execucao_id FROM dimensoes_contexto);
WITH comercial AS (
 SELECT documento_doccom,tipopessoa_doccom,
  CASE WHEN count(DISTINCT pessoa_doccom)=1 THEN max(pessoa_doccom) END AS pessoa_id,
  count(DISTINCT pessoa_doccom)>1 AS conflito
 FROM staging.stg_documento_comissao
 WHERE principal_doccom='S' AND tipopessoa_doccom IN (0,1)
 GROUP BY documento_doccom,tipopessoa_doccom
)
INSERT INTO posvenda.dimensoes(execucao_id,categoria,registro_id,versao_id,comercial_execucao_id,atributos)
SELECT p.execucao_id,p.categoria,p.registro_id,'${AFTERSALES_DIMENSION_RUN_ID}'::uuid,ctx.comercial_id,
 jsonb_build_object(
  'regiao_uf',CASE u.regiao_uf WHEN 1 THEN 'CENTRO-OESTE' WHEN 2 THEN 'NORDESTE' WHEN 3 THEN 'NORTE' WHEN 4 THEN 'SUL' WHEN 5 THEN 'SUDESTE' WHEN 6 THEN 'EXTERIOR' END,
  'micro_regiao',reg.descricao_regiao,
  'tipo_entrega',CASE trim(d.entregarmercadoria_docfat) WHEN 'S' THEN 'ENTREGA' WHEN 'N' THEN 'RETIRA' END,
  'supervisor',CASE WHEN sup.pessoa_id IS NOT NULL THEN sup.pessoa_id::text||' - '||ps.razaosocial_pessoa END,
  'consultor',CASE WHEN con.pessoa_id IS NOT NULL THEN con.pessoa_id::text||' - '||pc.razaosocial_pessoa END,
  'conflito_comercial',COALESCE(con.conflito,false) OR COALESCE(sup.conflito,false),
  'grupo_cliente',CASE WHEN c.grupo_pessoa=0 THEN c.razaosocial_pessoa ELSE c.grupo_pessoa::text||' - '||gc.descricao_grupo END,
  'grupo_item',product.grupo_item::text||' - '||gi.descricao_grupo,
  'subgrupo',product.subgrupo_item::text||' - '||sg.descricao_subgrupo,
  'linha',product.linha_item::text||' - '||li.descricao_linha,
  'tipo_produto',product.tipoproduto_item::text||' - '||tp.descricao_tipoprod,
  'colecao',product.colecao_item::text||' - '||co.descricao_colecao,
  'classificacao',cl.descricao_classif,'origem',ori.descricao_origem,'orgao',org.descricao_orgao,
  'previsao_original',ped.dtprevisaofaturamento_docped::date::text,
  'peso_unitario',CASE WHEN COALESCE(det.pesobruto_item_detalhe,0)<>0 THEN det.pesobruto_item_detalhe ELSE product.pesobruto_item END,
  'volume_unitario',CASE WHEN COALESCE(det.volumem3_item_detalhe,0)<>0 THEN det.volumem3_item_detalhe WHEN product.volumem3_item>=0 AND product.volumem3_item<10 THEN product.volumem3_item END
 )
FROM posvenda.registro p
JOIN dimensoes_contexto ctx ON ctx.execucao_id=p.execucao_id
LEFT JOIN staging.stg_documento_fatura d ON d.codigo_docfat=p.pedido_id
LEFT JOIN posvenda_stage.documento_fatura event_doc ON event_doc.codigo_docfat=p.documento_id
LEFT JOIN staging.stg_pessoa c ON c.codigo_pessoa=p.cliente_id
LEFT JOIN staging.stg_pessoa_endereco a ON a.autoinc_pessoa_end=event_doc.localentrega_docfat
LEFT JOIN staging.stg_cidade city ON city.codigo_cidade=a.cidade_pessoa_end
LEFT JOIN staging.stg_uf u ON u.codigo_uf=city.uf_cidade
LEFT JOIN staging.stg_regiao reg ON reg.codigo_regiao=a.regiao_pessoa_end
LEFT JOIN comercial con ON con.documento_doccom=p.pedido_id AND con.tipopessoa_doccom=0
LEFT JOIN comercial sup ON sup.documento_doccom=p.pedido_id AND sup.tipopessoa_doccom=1
LEFT JOIN staging.stg_pessoa pc ON pc.codigo_pessoa=con.pessoa_id
LEFT JOIN staging.stg_pessoa ps ON ps.codigo_pessoa=sup.pessoa_id
LEFT JOIN staging.stg_grupo gc ON gc.codigo_grupo=c.grupo_pessoa
LEFT JOIN staging.stg_item product ON product.codigo_item=p.produto_id
LEFT JOIN staging.stg_grupo gi ON gi.codigo_grupo=product.grupo_item
LEFT JOIN staging.stg_subgrupo sg ON sg.codigo_subgrupo=product.subgrupo_item
LEFT JOIN staging.stg_linha li ON li.codigo_linha=product.linha_item
LEFT JOIN staging.stg_tipoproduto tp ON tp.codigo_tipoprod=product.tipoproduto_item
LEFT JOIN staging.stg_colecao co ON co.codigo_colecao=product.colecao_item
LEFT JOIN staging.stg_classificacao cl ON cl.codigo_classif=d.classificacao_docfat
LEFT JOIN staging.stg_origem ori ON ori.codigo_origem=d.origem_docfat
LEFT JOIN staging.stg_orgao org ON org.codigo_orgao=d.orgao_docfat
LEFT JOIN posvenda_stage.documento_pedido ped ON ped.documento_docped=p.pedido_id
LEFT JOIN posvenda_stage.documento_devolucaocancela can ON p.categoria='cancelamentos' AND can.autoinc_docdev=p.registro_id
LEFT JOIN posvenda_stage.documento_entrega_devcan dev ON p.categoria='devolucoes' AND dev.autoinc_docentdev=p.registro_id
LEFT JOIN posvenda_stage.documento_entrega ent ON ent.autoinc_docent=dev.autoincdocent_docentdev
LEFT JOIN staging.stg_documento_item_detalhe item ON item.autoinc_docitemdet=CASE p.categoria WHEN 'assistencias' THEN p.registro_id WHEN 'cancelamentos' THEN can.autoincitemdetdoc_docdev ELSE ent.autoincitemdetdoc_docent END
LEFT JOIN staging.stg_item_detalhe det ON det.autoinc_item_detalhe=item.autoincitemdetalhe_docitemdet;
DO $$ BEGIN
 IF (SELECT count(*) FROM posvenda.dimensoes d JOIN dimensoes_contexto c ON c.execucao_id=d.execucao_id)
 <> (SELECT count(*) FROM posvenda.registro r JOIN dimensoes_contexto c ON c.execucao_id=r.execucao_id)
 THEN RAISE EXCEPTION 'As dimensões devem preservar exatamente os registros publicados'; END IF;
END $$;
ANALYZE posvenda.dimensoes;
COMMIT;

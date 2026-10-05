SELECT
  original."codigo_pedido" AS "codigo_docfat",
  original."codigo_cliente" AS "cliente_docfat",
  original."razao_social" AS "razaosocial_pessoa",
  original."grupo_cliente" AS "grupo_cliente_descricao",
  original."consultor" AS "consultor_descricao",
  original."supervisor" AS "supervisor_descricao",
  original."data_emissao_pedido" AS "data_emissao_pedido",
  original."dia" AS "dia",
  original."mes" AS "mes",
  original."ano" AS "ano",
  original."nivel_de_servico" AS "nivel_de_servico",
  original."dt_previsao_faturamento" AS "data_previsao_faturamento",
  original."tipo_entrega" AS "tipo_entrega",
  original."valor_em_aberto" AS "valor_em_aberto",
  original."qtdeaberta_docitemdet" AS "qtdeaberta_docitemdet",
  original."peso_em_aberto" AS "peso_em_aberto",
  original."volume_m3_em_aberto" AS "volume_m3_em_aberto",
  original."uf" AS "sigla_uf",
  original."regiao_uf" AS "regiao_uf_descricao",
  original."micro_regiao" AS "descricao_regiao",
  original."cidade" AS "descricao_cidade",
  original."classificacao" AS "descricao_classif",
  original."origem" AS "descricao_origem",
  original."orgao" AS "descricao_orgao",
  original."status" AS "descricao_status",
  original."codigo_item" AS "codigo_item",
  original."descricao_item" AS "descricao_item",
  original."cor" AS "cor_descricao",
  original."grupo_item" AS "grupo_item_descricao",
  original."subgrupo" AS "subgrupo_descricao",
  original."tipo" AS "tipo_produto_descricao",
  original."colecao" AS "colecao_descricao",
  original."linha" AS "linha_descricao",
  original."vlrbrutoliquido_docitemdet" AS "vlrbrutoliquido_docitemdet",
  original."vlrunitariobruto_docitemdet" AS "vlrunitariobruto_docitemdet",
  original."vlrunitarioliquido_docitemdet" AS "vlrunitarioliquido_docitemdet",
  original."vlr_unit_bruliq" AS "valor_unitario_bruto_liquido",
  original."vlrliquido_docfat" AS "vlrliquido_docfat",
  original."data_emissao_pedido"::timestamp AS "data_emissao_pedido_tratada",
  original."dt_previsao_faturamento"::timestamp AS "data_previsao_faturamento_tratada",
  (COALESCE(original."valor_em_aberto"::double precision,0)::real)::text::double precision AS "valor_em_aberto_tratado",
  (COALESCE(original."peso_em_aberto"::double precision,0)::real)::text::double precision AS "peso_em_aberto_tratado",
  (COALESCE(original."qtdeaberta_docitemdet"::double precision,0)::real)::text::double precision AS "quantidade_em_aberto_tratada",
  ((CASE WHEN COALESCE(original."volume_m3_em_aberto"::double precision,0)::real>1000::real THEN COALESCE(original."volume_m3_em_aberto"::double precision,0)::real/1000::real ELSE COALESCE(original."volume_m3_em_aberto"::double precision,0)::real END))::text::double precision AS "volume_m3_em_aberto_tratado",
  (COALESCE(original."nivel_de_servico"::double precision,0)::real)::text::double precision AS "nivel_de_servico_tratado"
FROM (
select 
   DOCUMENTO_FATURA.CODIGO_DOCFAT CODIGO_PEDIDO,
   DOCUMENTO_FATURA.CLIENTE_DOCFAT CODIGO_CLIENTE,
   CLIENTE.RAZAOSOCIAL_PESSOA RAZAO_SOCIAL,
   case when CLIENTE.GRUPO_PESSOA = 0 then CLIENTE.RAZAOSOCIAL_PESSOA else CLIENTE.GRUPO_PESSOA || ' - ' || GRUPO_CLIENTE.DESCRICAO_GRUPO end as GRUPO_CLIENTE,
   COALESCE(COMISSAO_CON.PESSOA_DOCCOM || ' - ' || PESSOA_CON.RAZAOSOCIAL_PESSOA, 'INDEFINIDO') AS CONSULTOR,
   COALESCE(COMISSAO_SUP.PESSOA_DOCCOM || ' - ' || PESSOA_SUP.RAZAOSOCIAL_PESSOA, 'INDEFINIDO') AS SUPERVISOR,
   cast (DOCUMENTO_FATURA.DTEMISSAO_DOCFAT as date) DATA_EMISSAO_PEDIDO,
   EXTRACT(DAY FROM DOCUMENTO_FATURA.DTEMISSAO_DOCFAT) DIA,
   EXTRACT(MONTH FROM DOCUMENTO_FATURA.DTEMISSAO_DOCFAT) MES,
   EXTRACT(YEAR FROM DOCUMENTO_FATURA.DTEMISSAO_DOCFAT) ANO,
   (CURRENT_DATE - cast(DOCUMENTO_FATURA.DTEMISSAO_DOCFAT as date)) NIVEL_DE_SERVICO,
   cast(DOCUMENTO_PEDIDO.DTPREVISAOFATURAMENTO_DOCPED as date) DT_PREVISAO_FATURAMENTO,
   case trim(DOCUMENTO_FATURA.ENTREGARMERCADORIA_DOCFAT)
     when 'S' then 'ENTREGA'
     when 'N' then 'RETIRA'
     else 'RETIRA'
   end as TIPO_ENTREGA,
   (TRUNC(DOCUMENTO_ITEM_DETALHE.VLRBRUTOLIQUIDO_DOCITEMDET / DOCUMENTO_ITEM_DETALHE.QTDECHAPAS_DOCITEMDET, 6)) * DOCUMENTO_ITEM_DETALHE.QTDEABERTA_DOCITEMDET VALOR_EM_ABERTO,
   DOCUMENTO_ITEM_DETALHE.QTDEABERTA_DOCITEMDET,
   ((CASE WHEN coalesce(ITEM_DETALHE.PESOBRUTO_ITEM_DETALHE, 0) <> 0 THEN  ITEM_DETALHE.PESOBRUTO_ITEM_DETALHE ELSE  ITEM.PESOBRUTO_ITEM END) * DOCUMENTO_ITEM_DETALHE.QTDEABERTA_DOCITEMDET) PESO_EM_ABERTO,
   ((CASE WHEN coalesce(ITEM_DETALHE.VOLUMEM3_ITEM_DETALHE, 0) <> 0 THEN  ITEM_DETALHE.VOLUMEM3_ITEM_DETALHE ELSE  (CASE WHEN coalesce(ITEM.VOLUMEM3_ITEM, 0) < 10 THEN  coalesce(ITEM.VOLUMEM3_ITEM, 0) ELSE  0 END) END) * DOCUMENTO_ITEM_DETALHE.QTDEABERTA_DOCITEMDET) VOLUME_M3_EM_ABERTO,
   UF.SIGLA_UF UF,
   case UF.REGIAO_UF
     when 0 then 'INDEFINIDA'
     when 1 then 'CENTRO-OESTE'
     when 2 then 'NORDESTE'
     when 3 then 'NORTE'
     when 4 then 'SUL'
     when 5 then 'SUDESTE'
     when 6 then 'EXTERIOR'
   end as REGIAO_UF,
   REGIAO.descricao_regiao MICRO_REGIAO,
   CIDADE.descricao_cidade CIDADE,  
   CLASSIFICACAO.DESCRICAO_CLASSIF AS CLASSIFICACAO,
   ORIGEM.DESCRICAO_ORIGEM ORIGEM,
   ORGAO.DESCRICAO_ORGAO ORGAO,
   STATUS.DESCRICAO_STATUS STATUS,
   ITEM.CODIGO_ITEM AS CODIGO_ITEM,
   ITEM.DESCRICAO_ITEM AS DESCRICAO_ITEM,
   COR.CODIGO_COR || ' - ' || COR.DESCRICAO_COR AS COR, 
   ITEM.GRUPO_ITEM || ' - ' || GRUPO_ITEM.DESCRICAO_GRUPO GRUPO_ITEM,
   ITEM.SUBGRUPO_ITEM || ' - ' || SUBGRUPO.DESCRICAO_SUBGRUPO SUBGRUPO,
   ITEM.TIPOPRODUTO_ITEM || ' - ' || TIPOPRODUTO.DESCRICAO_TIPOPROD TIPO,
   ITEM.COLECAO_ITEM || ' - ' || COLECAO.DESCRICAO_COLECAO COLECAO,
   ITEM.LINHA_ITEM || ' - ' || LINHA.DESCRICAO_LINHA LINHA,
   DOCUMENTO_ITEM_DETALHE.VLRBRUTOLIQUIDO_DOCITEMDET,
   DOCUMENTO_ITEM_DETALHE.VLRUNITARIOBRUTO_DOCITEMDET,
   DOCUMENTO_ITEM_DETALHE.VLRUNITARIOLIQUIDO_DOCITEMDET,
   TRUNC(DOCUMENTO_ITEM_DETALHE.VLRBRUTOLIQUIDO_DOCITEMDET / DOCUMENTO_ITEM_DETALHE.QTDECHAPAS_DOCITEMDET, 6) VLR_UNIT_BRULIQ,
   DOCUMENTO_FATURA.VLRLIQUIDO_DOCFAT
 from staging.stg_documento_fatura DOCUMENTO_FATURA inner join staging.stg_documento_item DOCUMENTO_ITEM on (DOCUMENTO_ITEM.DOCUMENTO_DOCITEM              = DOCUMENTO_FATURA.CODIGO_DOCFAT) 
 inner join staging.stg_documento_item_detalhe DOCUMENTO_ITEM_DETALHE on (DOCUMENTO_ITEM_DETALHE.AUTOINCITEM_DOCITEMDET = DOCUMENTO_ITEM.AUTOINC_DOCITEM) 
 left  join staging.stg_documento_pedido DOCUMENTO_PEDIDO on (DOCUMENTO_PEDIDO.DOCUMENTO_DOCPED             = DOCUMENTO_FATURA.CODIGO_DOCFAT) 
 left  join staging.stg_documento_fiscal DOCUMENTO_FISCAL on (DOCUMENTO_FISCAL.DOCUMENTO_DOCFISCAL          = DOCUMENTO_FATURA.CODIGO_DOCFAT) 
 inner join staging.stg_orgao ORGAO on (ORGAO.CODIGO_ORGAO                            = DOCUMENTO_FATURA.ORGAO_DOCFAT) 
 inner join staging.stg_origem ORIGEM on (ORIGEM.CODIGO_ORIGEM                          = DOCUMENTO_FATURA.ORIGEM_DOCFAT) 
 inner join staging.stg_classificacao CLASSIFICACAO on (CLASSIFICACAO.CODIGO_CLASSIF                  = DOCUMENTO_FATURA.CLASSIFICACAO_DOCFAT) 
 inner join staging.stg_status STATUS on (STATUS.CODIGO_STATUS                          = DOCUMENTO_FATURA.STATUS_DOCFAT) 
 left  join staging.stg_pessoa CLIENTE on (CLIENTE.CODIGO_PESSOA                         = DOCUMENTO_FATURA.CLIENTE_DOCFAT)
 inner join staging.stg_grupo GRUPO_CLIENTE  on (GRUPO_CLIENTE.CODIGO_GRUPO                    = CLIENTE.GRUPO_PESSOA)           
 left  join staging.stg_documento_comissao COMISSAO_CON on (COMISSAO_CON.DOCUMENTO_DOCCOM         = DOCUMENTO_FATURA.CODIGO_DOCFAT and COMISSAO_CON.TIPOPESSOA_DOCCOM = 0 and COMISSAO_CON.PRINCIPAL_DOCCOM = 'S') 
 left  join staging.stg_pessoa PESSOA_CON   on (PESSOA_CON.CODIGO_PESSOA             = COMISSAO_CON.PESSOA_DOCCOM) 
 left  join staging.stg_documento_comissao COMISSAO_SUP on (COMISSAO_SUP.DOCUMENTO_DOCCOM         = DOCUMENTO_FATURA.CODIGO_DOCFAT and COMISSAO_SUP.TIPOPESSOA_DOCCOM = 1 and COMISSAO_SUP.PRINCIPAL_DOCCOM = 'S') 
 left  join staging.stg_pessoa PESSOA_SUP   on (PESSOA_SUP.CODIGO_PESSOA             = COMISSAO_SUP.PESSOA_DOCCOM) 
 left  join staging.stg_pessoa_endereco PESSOA_ENDERECO on (PESSOA_ENDERECO.AUTOINC_PESSOA_END            = DOCUMENTO_FATURA.LOCALENTREGA_DOCFAT) 
 left  join staging.stg_regiao REGIAO on (REGIAO.CODIGO_REGIAO                          = PESSOA_ENDERECO.REGIAO_PESSOA_END) 
 left  join staging.stg_cidade CIDADE on (CIDADE.CODIGO_CIDADE                          = PESSOA_ENDERECO.CIDADE_PESSOA_END) 
 left  join staging.stg_uf UF on (UF.CODIGO_UF                                  = CIDADE.UF_CIDADE)  
 inner join staging.stg_item ITEM on (ITEM.CODIGO_ITEM                              = DOCUMENTO_ITEM.ITEM_DOCITEM) 
 inner join staging.stg_grupo GRUPO_ITEM     on (GRUPO_ITEM.CODIGO_GRUPO                       = ITEM.GRUPO_ITEM)           
 inner join staging.stg_subgrupo SUBGRUPO on (SUBGRUPO.CODIGO_SUBGRUPO                      = ITEM.SUBGRUPO_ITEM)        
 inner join staging.stg_tipoproduto TIPOPRODUTO on (TIPOPRODUTO.CODIGO_TIPOPROD                   = ITEM.TIPOPRODUTO_ITEM)            
 inner join staging.stg_colecao COLECAO on (COLECAO.CODIGO_COLECAO                        = ITEM.COLECAO_ITEM)         
 inner join staging.stg_linha LINHA on (LINHA.CODIGO_LINHA                            = ITEM.LINHA_ITEM)           
 left  join staging.stg_item_detalhe ITEM_DETALHE on (ITEM_DETALHE.AUTOINC_ITEM_DETALHE             = DOCUMENTO_ITEM_DETALHE.AUTOINCITEMDETALHE_DOCITEMDET)
 left  join staging.stg_cor COR on (COR.CODIGO_COR                                = DOCUMENTO_ITEM_DETALHE.COR_DOCITEMDET) 
 where (DOCUMENTO_FATURA.DTEMISSAO_DOCFAT >= '2026-01-01')
   and (CLIENTE.GRUPO_PESSOA <> 1603)
   and (DOCUMENTO_FATURA.TIPO_DOCFAT                 = 1)
   and (DOCUMENTO_FATURA.OPCAO_DOCFAT                = 1)
   and (DOCUMENTO_FATURA.ENTREGA_DOCFAT              = 'N')
   and (DOCUMENTO_ITEM_DETALHE.QTDEABERTA_DOCITEMDET > 0)
   and (DOCUMENTO_ITEM.AUTOINC_DOCITEM               = DOCUMENTO_ITEM.COMPOSICAOITEM_DOCITEM)
   and (DOCUMENTO_ITEM.TIPO_DOCITEM                  in (1,4))
) original

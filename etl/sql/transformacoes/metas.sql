SELECT
  original."autoinc_metasven" AS "autoinc_metasven",
  original."empresa_metasven" AS "empresa_metasven",
  original."tipo_metasven" AS "tipo_metasven",
  original."tipodoc_metasven" AS "tipodoc_metasven",
  original."ano_metasven" AS "ano_metasven",
  original."codigo_metasven" AS "codigo_metasven",
  original."descricao" AS "razaosocial_pessoa",
  original."metaporlinha" AS "metaporlinha_consven",
  original."metaporgrupo" AS "metaporgrupo_consven",
  original."metaportipoproduto" AS "metaportipoproduto_consven",
  original."metaporregiao" AS "metaporregiao_consven",
  original."metaporunidadefabril" AS "metaporunidfabril_consven",
  original."metapororigem" AS "metapororigem_consven",
  original."metaporsupervisor" AS "metaporsupervisor_consven",
  original."metaporconsultor" AS "metaporconsultor_consven",
  original."meta_01_metasven" AS "meta_01_metasven",
  original."meta_02_metasven" AS "meta_02_metasven",
  original."meta_03_metasven" AS "meta_03_metasven",
  original."meta_04_metasven" AS "meta_04_metasven",
  original."meta_05_metasven" AS "meta_05_metasven",
  original."meta_06_metasven" AS "meta_06_metasven",
  original."meta_07_metasven" AS "meta_07_metasven",
  original."meta_08_metasven" AS "meta_08_metasven",
  original."meta_09_metasven" AS "meta_09_metasven",
  original."meta_10_metasven" AS "meta_10_metasven",
  original."meta_11_metasven" AS "meta_11_metasven",
  original."meta_12_metasven" AS "meta_12_metasven",
  original."datahorainclusao_metasven" AS "datahorainclusao_metasven",
  original."usuarioinclusao_metasven" AS "usuarioinclusao_metasven",
  original."datahoraalteracao_metasven" AS "datahoraalteracao_metasven",
  original."usuarioalteracao_metasven" AS "usuarioalteracao_metasven"
FROM (
select
    METAS_VENDAS.AUTOINC_METASVEN,
    METAS_VENDAS.EMPRESA_METASVEN,
    METAS_VENDAS.TIPO_METASVEN,
    METAS_VENDAS.TIPODOC_METASVEN,
    METAS_VENDAS.ANO_METASVEN,
    METAS_VENDAS.CODIGO_METASVEN,
    PESSOA.RAZAOSOCIAL_PESSOA as DESCRICAO,
    PESSOA_CONSULTORVENDAS.METAPORLINHA_CONSVEN as METAPORLINHA,
    PESSOA_CONSULTORVENDAS.METAPORGRUPO_CONSVEN as METAPORGRUPO,
    PESSOA_CONSULTORVENDAS.METAPORTIPOPRODUTO_CONSVEN as METAPORTIPOPRODUTO,
    PESSOA_CONSULTORVENDAS.METAPORREGIAO_CONSVEN as METAPORREGIAO,
    PESSOA_CONSULTORVENDAS.METAPORUNIDFABRIL_CONSVEN as METAPORUNIDADEFABRIL,
    PESSOA_CONSULTORVENDAS.METAPORORIGEM_CONSVEN as METAPORORIGEM,
    PESSOA_CONSULTORVENDAS.METAPORSUPERVISOR_CONSVEN as METAPORSUPERVISOR,
    PESSOA_CONSULTORVENDAS.METAPORCONSULTOR_CONSVEN as METAPORCONSULTOR,
    METAS_VENDAS.META_01_METASVEN,
    METAS_VENDAS.META_02_METASVEN,
    METAS_VENDAS.META_03_METASVEN,
    METAS_VENDAS.META_04_METASVEN,
    METAS_VENDAS.META_05_METASVEN,
    METAS_VENDAS.META_06_METASVEN,
    METAS_VENDAS.META_07_METASVEN,
    METAS_VENDAS.META_08_METASVEN,
    METAS_VENDAS.META_09_METASVEN,
    METAS_VENDAS.META_10_METASVEN,
    METAS_VENDAS.META_11_METASVEN,
    METAS_VENDAS.META_12_METASVEN,
    METAS_VENDAS.DATAHORAINCLUSAO_METASVEN,
    METAS_VENDAS.USUARIOINCLUSAO_METASVEN,
    METAS_VENDAS.DATAHORAALTERACAO_METASVEN,
    METAS_VENDAS.USUARIOALTERACAO_METASVEN
from staging.stg_metas_vendas METAS_VENDAS inner join staging.stg_pessoa PESSOA on PESSOA.CODIGO_PESSOA = METAS_VENDAS.CODIGO_METASVEN
left join staging.stg_pessoa_consultorvendas PESSOA_CONSULTORVENDAS on PESSOA_CONSULTORVENDAS.PESSOA_CONSVEN = PESSOA.CODIGO_PESSOA
where METAS_VENDAS.TIPO_METASVEN = 2
  and METAS_VENDAS.TIPODOC_METASVEN = 1
  and METAS_VENDAS.EMPRESA_METASVEN = 0

union all

select
    0 as AUTOINC_METASVEN,
    0 as EMPRESA_METASVEN,
    2 as TIPO_METASVEN,
    1 as TIPODOC_METASVEN,
    ANOS.ANO_METASVEN,
    PESSOA.CODIGO_PESSOA as CODIGO_METASVEN,
    PESSOA.RAZAOSOCIAL_PESSOA as DESCRICAO,
    PESSOA_CONSULTORVENDAS.METAPORLINHA_CONSVEN as METAPORLINHA,
    PESSOA_CONSULTORVENDAS.METAPORGRUPO_CONSVEN as METAPORGRUPO,
    PESSOA_CONSULTORVENDAS.METAPORTIPOPRODUTO_CONSVEN as METAPORTIPOPRODUTO,
    PESSOA_CONSULTORVENDAS.METAPORREGIAO_CONSVEN as METAPORREGIAO,
    PESSOA_CONSULTORVENDAS.METAPORUNIDFABRIL_CONSVEN as METAPORUNIDADEFABRIL,
    PESSOA_CONSULTORVENDAS.METAPORORIGEM_CONSVEN as METAPORORIGEM,
    PESSOA_CONSULTORVENDAS.METAPORSUPERVISOR_CONSVEN as METAPORSUPERVISOR,
    PESSOA_CONSULTORVENDAS.METAPORCONSULTOR_CONSVEN as METAPORCONSULTOR,
    0.00 as META_01_METASVEN,
    0.00 as META_02_METASVEN,
    0.00 as META_03_METASVEN,
    0.00 as META_04_METASVEN,
    0.00 as META_05_METASVEN,
    0.00 as META_06_METASVEN,
    0.00 as META_07_METASVEN,
    0.00 as META_08_METASVEN,
    0.00 as META_09_METASVEN,
    0.00 as META_10_METASVEN,
    0.00 as META_11_METASVEN,
    0.00 as META_12_METASVEN,
    LOCALTIMESTAMP as DATAHORAINCLUSAO_METASVEN,
    'DASHBOARD' as USUARIOINCLUSAO_METASVEN,
    LOCALTIMESTAMP as DATAHORAALTERACAO_METASVEN,
    'DASHBOARD' as USUARIOALTERACAO_METASVEN
from staging.stg_pessoa PESSOA cross join (
    select distinct MV_ANO.ANO_METASVEN
    from staging.stg_metas_vendas MV_ANO
    where MV_ANO.TIPO_METASVEN = 2
      and MV_ANO.TIPODOC_METASVEN = 1
      and MV_ANO.EMPRESA_METASVEN = 0
    union
    select cast(extract(year from current_date) as integer)
    
) ANOS
left join staging.stg_pessoa_consultorvendas PESSOA_CONSULTORVENDAS on PESSOA_CONSULTORVENDAS.PESSOA_CONSVEN = PESSOA.CODIGO_PESSOA
where PESSOA.CONSVENDAS_PESSOA = 'S'
  and PESSOA.CODIGO_PESSOA > 0
  and not exists (
      select MV.AUTOINC_METASVEN
      from staging.stg_metas_vendas MV
      where MV.TIPO_METASVEN = 2
        and MV.TIPODOC_METASVEN = 1
        and MV.ANO_METASVEN = ANOS.ANO_METASVEN
        and MV.EMPRESA_METASVEN = 0
        and MV.CODIGO_METASVEN = PESSOA.CODIGO_PESSOA
  )
) original

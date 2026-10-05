SELECT
  original."codigo_pessoa" AS "codigo_pessoa",
  original."razaosocial_pessoa" AS "razaosocial_pessoa",
  original."cliente_pessoa" AS "cliente_pessoa",
  original."grupo_pessoa" AS "grupo_pessoa",
  original."descricao_grupo" AS "descricao_grupo",
  original."grupo_cliente" AS "grupo_cliente_descricao"
FROM (
select 
    pessoa.codigo_pessoa,
    pessoa.razaosocial_pessoa,
    pessoa.cliente_pessoa,
    pessoa.grupo_pessoa,
    grupo.descricao_grupo,
    case when coalesce(pessoa.grupo_pessoa, 0) = 0 
         then coalesce(pessoa.razaosocial_pessoa, 'SEM NOME') 
         else pessoa.grupo_pessoa || ' - ' || coalesce(grupo.descricao_grupo, 'SEM GRUPO') 
    end as GRUPO_CLIENTE
 from staging.stg_pessoa PESSOA left join staging.stg_grupo GRUPO on (pessoa.grupo_pessoa = grupo.codigo_grupo)
 where 
    (
       (pessoa.cliente_pessoa = 'S')
    )
) original

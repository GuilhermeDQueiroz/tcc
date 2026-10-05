CREATE SCHEMA IF NOT EXISTS staging;

CREATE SCHEMA IF NOT EXISTS dw;

CREATE SCHEMA IF NOT EXISTS etl;

CREATE TABLE IF NOT EXISTS etl.execucao_carga (id uuid PRIMARY KEY, inicio timestamptz NOT NULL DEFAULT now(), fim timestamptz, status text NOT NULL CHECK(status IN ('executando','publicado','falhou')), origem text NOT NULL DEFAULT 'firebird/apache-hop', contagens jsonb);

CREATE TABLE IF NOT EXISTS staging.stg_carga (
  "codigo_carga" bigint,
  "descricao_carga" text,
  "transportador_carga" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_carga_documentos (
  "autoinc_cardoc" bigint,
  "carga_cardoc" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_carga_itens (
  "autoinccardoc_carite" bigint,
  "autoinc_carite" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_cidade (
  "codigo_cidade" bigint,
  "descricao_cidade" text,
  "uf_cidade" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_classificacao (
  "codigo_classif" bigint,
  "descricao_classif" text
);

CREATE TABLE IF NOT EXISTS staging.stg_colecao (
  "codigo_colecao" bigint,
  "descricao_colecao" text
);

CREATE TABLE IF NOT EXISTS staging.stg_cor (
  "codigo_cor" bigint,
  "descricao_cor" text
);

CREATE TABLE IF NOT EXISTS staging.stg_documento_comissao (
  "documento_doccom" bigint,
  "perc_venda_doccom" numeric,
  "pessoa_doccom" bigint,
  "principal_doccom" text,
  "tipopessoa_doccom" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_documento_entrega (
  "autoincitemdetdoc_docent" bigint,
  "autoinc_docent" bigint,
  "cargaitens_docent" bigint,
  "composicaoentrega_docent" bigint,
  "documento_docent" bigint,
  "familia_docent" bigint,
  "qtdechapas_docent" numeric,
  "tipo_docent" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_documento_fatura (
  "classificacao_docfat" bigint,
  "cliente_docfat" bigint,
  "codigo_docfat" bigint,
  "dtemissao_docfat" timestamp,
  "empresa_docfat" bigint,
  "entregarmercadoria_docfat" text,
  "entrega_docfat" text,
  "localentrega_docfat" bigint,
  "opcao_docfat" bigint,
  "orgao_docfat" bigint,
  "origem_docfat" bigint,
  "prazomedio_docfat" bigint,
  "status_docfat" bigint,
  "tipo_docfat" bigint,
  "transacao_docfat" bigint,
  "vlrliquido_docfat" numeric
);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='staging' AND table_name='stg_documento_fatura' AND column_name='dtemissao_docfat' AND data_type='date') THEN  ALTER TABLE staging.stg_documento_fatura ALTER COLUMN dtemissao_docfat TYPE timestamp USING dtemissao_docfat::timestamp; END IF; END $$;

CREATE TABLE IF NOT EXISTS staging.stg_documento_fiscal (
  "documento_docfiscal" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_documento_item (
  "autoinc_docitem" bigint,
  "composicaoitem_docitem" bigint,
  "documento_docitem" bigint,
  "item_docitem" bigint,
  "tipo_docitem" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_documento_item_detalhe (
  "acabamento_docitemdet" bigint,
  "autoincitemdetalhe_docitemdet" bigint,
  "autoincitem_docitemdet" bigint,
  "autoinc_docitemdet" bigint,
  "cor_docitemdet" bigint,
  "qtdeaberta_docitemdet" numeric,
  "qtdechapas_docitemdet" numeric,
  "variacao_docitemdet" bigint,
  "vlrbrutoliquido_docitemdet" numeric,
  "vlrunitariobruto_docitemdet" numeric,
  "vlrunitarioliquido_docitemdet" numeric
);

CREATE TABLE IF NOT EXISTS staging.stg_documento_pedido (
  "documento_docped" bigint,
  "dtprevisaofaturamento_docped" timestamp
);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='staging' AND table_name='stg_documento_pedido' AND column_name='dtprevisaofaturamento_docped' AND data_type='date') THEN  ALTER TABLE staging.stg_documento_pedido ALTER COLUMN dtprevisaofaturamento_docped TYPE timestamp USING dtprevisaofaturamento_docped::timestamp; END IF; END $$;

CREATE TABLE IF NOT EXISTS staging.stg_familia (
  "codigo_familia" bigint,
  "descricao_familia" text
);

CREATE TABLE IF NOT EXISTS staging.stg_grupo (
  "codigo_grupo" bigint,
  "descricao_grupo" text
);

CREATE TABLE IF NOT EXISTS staging.stg_item (
  "arquivo_item" bigint,
  "codigo_item" bigint,
  "colecao_item" bigint,
  "descricao_item" text,
  "grupo_item" bigint,
  "itensporvolume_item" bigint,
  "linha_item" bigint,
  "pesobruto_item" numeric,
  "quantvolume_item" bigint,
  "subgrupo_item" bigint,
  "tipoproduto_item" bigint,
  "volumem3_item" numeric
);

CREATE TABLE IF NOT EXISTS staging.stg_item_detalhe (
  "autoinc_item_detalhe" bigint,
  "pesobruto_item_detalhe" numeric,
  "volumem3_item_detalhe" numeric
);

CREATE TABLE IF NOT EXISTS staging.stg_linha (
  "codigo_linha" bigint,
  "descricao_linha" text
);

CREATE TABLE IF NOT EXISTS staging.stg_metas_vendas (
  "ano_metasven" bigint,
  "autoinc_metasven" bigint,
  "codigo_metasven" bigint,
  "datahoraalteracao_metasven" timestamp,
  "datahorainclusao_metasven" timestamp,
  "empresa_metasven" bigint,
  "meta_01_metasven" numeric,
  "meta_02_metasven" numeric,
  "meta_03_metasven" numeric,
  "meta_04_metasven" numeric,
  "meta_05_metasven" numeric,
  "meta_06_metasven" numeric,
  "meta_07_metasven" numeric,
  "meta_08_metasven" numeric,
  "meta_09_metasven" numeric,
  "meta_10_metasven" numeric,
  "meta_11_metasven" numeric,
  "meta_12_metasven" numeric,
  "tipodoc_metasven" bigint,
  "tipo_metasven" bigint,
  "usuarioalteracao_metasven" text,
  "usuarioinclusao_metasven" text
);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='staging' AND table_name='stg_metas_vendas' AND column_name='datahoraalteracao_metasven' AND data_type='date') THEN  ALTER TABLE staging.stg_metas_vendas ALTER COLUMN datahoraalteracao_metasven TYPE timestamp USING datahoraalteracao_metasven::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='staging' AND table_name='stg_metas_vendas' AND column_name='datahorainclusao_metasven' AND data_type='date') THEN  ALTER TABLE staging.stg_metas_vendas ALTER COLUMN datahorainclusao_metasven TYPE timestamp USING datahorainclusao_metasven::timestamp; END IF; END $$;

CREATE TABLE IF NOT EXISTS staging.stg_nota_fiscal_documentos (
  "autoincdoc_nfdocumentos" bigint,
  "numeronf_nfdocumentos" bigint,
  "origemdoc_nfdocumentos" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_orgao (
  "codigo_orgao" bigint,
  "descricao_orgao" text
);

CREATE TABLE IF NOT EXISTS staging.stg_origem (
  "codigo_origem" bigint,
  "descricao_origem" text
);

CREATE TABLE IF NOT EXISTS staging.stg_pessoa (
  "cliente_pessoa" text,
  "codigo_pessoa" bigint,
  "consvendas_pessoa" text,
  "endereco_pessoa" bigint,
  "grupo_pessoa" bigint,
  "nomefantasia_pessoa" text,
  "razaosocial_pessoa" text
);

CREATE TABLE IF NOT EXISTS staging.stg_pessoa_cliente (
  "pessoa_pessoa_cli" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_pessoa_consultorvendas (
  "metaporconsultor_consven" text,
  "metaporgrupo_consven" text,
  "metaporlinha_consven" text,
  "metapororigem_consven" text,
  "metaporregiao_consven" text,
  "metaporsupervisor_consven" text,
  "metaportipoproduto_consven" text,
  "metaporunidfabril_consven" text,
  "pessoa_consven" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_pessoa_endereco (
  "autoinc_pessoa_end" bigint,
  "cidade_pessoa_end" bigint,
  "regiao_pessoa_end" bigint
);

CREATE TABLE IF NOT EXISTS staging.stg_regiao (
  "codigo_regiao" bigint,
  "descricao_regiao" text
);

CREATE TABLE IF NOT EXISTS staging.stg_status (
  "codigo_status" bigint,
  "descricao_status" text
);

CREATE TABLE IF NOT EXISTS staging.stg_subgrupo (
  "codigo_subgrupo" bigint,
  "descricao_subgrupo" text
);

CREATE TABLE IF NOT EXISTS staging.stg_tipoproduto (
  "codigo_tipoprod" bigint,
  "descricao_tipoprod" text
);

CREATE TABLE IF NOT EXISTS staging.stg_uf (
  "codigo_uf" bigint,
  "regiao_uf" bigint,
  "sigla_uf" text
);

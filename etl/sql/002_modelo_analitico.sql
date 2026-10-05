BEGIN;

DROP VIEW IF EXISTS dw.pedidos_abertos;

DROP VIEW IF EXISTS dw.pedidos_emitidos;

DROP VIEW IF EXISTS dw.pedidos_faturados;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='codigo_pedido') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "codigo_pedido" TO "codigo_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='codigo_cliente') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "codigo_cliente" TO "cliente_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='razao_social') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "razao_social" TO "razaosocial_pessoa"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='grupo_cliente') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "grupo_cliente" TO "grupo_cliente_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='consultor') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "consultor" TO "consultor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='supervisor') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "supervisor" TO "supervisor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='dt_previsao_faturamento') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "dt_previsao_faturamento" TO "data_previsao_faturamento"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='uf') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "uf" TO "sigla_uf"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='regiao_uf') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "regiao_uf" TO "regiao_uf_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='micro_regiao') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "micro_regiao" TO "descricao_regiao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='cidade') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "cidade" TO "descricao_cidade"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='classificacao') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "classificacao" TO "descricao_classif"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='origem') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "origem" TO "descricao_origem"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='orgao') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "orgao" TO "descricao_orgao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='status') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "status" TO "descricao_status"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='cor') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "cor" TO "cor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='grupo_item') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "grupo_item" TO "grupo_item_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='subgrupo') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "subgrupo" TO "subgrupo_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='tipo') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "tipo" TO "tipo_produto_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='colecao') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "colecao" TO "colecao_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='linha') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "linha" TO "linha_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='vlr_unit_bruliq') THEN ALTER TABLE dw.carga_abertos RENAME COLUMN "vlr_unit_bruliq" TO "valor_unitario_bruto_liquido"; END IF; END $$;

ALTER TABLE IF EXISTS dw.carga_abertos ADD COLUMN IF NOT EXISTS "data_emissao_pedido_tratada" timestamp;

ALTER TABLE IF EXISTS dw.carga_abertos ADD COLUMN IF NOT EXISTS "data_previsao_faturamento_tratada" timestamp;

ALTER TABLE IF EXISTS dw.carga_abertos ADD COLUMN IF NOT EXISTS "valor_em_aberto_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_abertos ADD COLUMN IF NOT EXISTS "peso_em_aberto_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_abertos ADD COLUMN IF NOT EXISTS "quantidade_em_aberto_tratada" double precision;

ALTER TABLE IF EXISTS dw.carga_abertos ADD COLUMN IF NOT EXISTS "volume_m3_em_aberto_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_abertos ADD COLUMN IF NOT EXISTS "nivel_de_servico_tratado" double precision;

CREATE TABLE IF NOT EXISTS dw.carga_abertos ("codigo_docfat" bigint, "cliente_docfat" bigint, "razaosocial_pessoa" text, "grupo_cliente_descricao" text, "consultor_descricao" text, "supervisor_descricao" text, "data_emissao_pedido" date, "dia" bigint, "mes" bigint, "ano" bigint, "nivel_de_servico" bigint, "data_previsao_faturamento" date, "tipo_entrega" text, "valor_em_aberto" numeric, "qtdeaberta_docitemdet" numeric, "peso_em_aberto" numeric, "volume_m3_em_aberto" numeric, "sigla_uf" text, "regiao_uf_descricao" text, "descricao_regiao" text, "descricao_cidade" text, "descricao_classif" text, "descricao_origem" text, "descricao_orgao" text, "descricao_status" text, "codigo_item" bigint, "descricao_item" text, "cor_descricao" text, "grupo_item_descricao" text, "subgrupo_descricao" text, "tipo_produto_descricao" text, "colecao_descricao" text, "linha_descricao" text, "vlrbrutoliquido_docitemdet" numeric, "vlrunitariobruto_docitemdet" numeric, "vlrunitarioliquido_docitemdet" numeric, "valor_unitario_bruto_liquido" numeric, "vlrliquido_docfat" numeric, "data_emissao_pedido_tratada" timestamp, "data_previsao_faturamento_tratada" timestamp, "valor_em_aberto_tratado" double precision, "peso_em_aberto_tratado" double precision, "quantidade_em_aberto_tratada" double precision, "volume_m3_em_aberto_tratado" double precision, "nivel_de_servico_tratado" double precision);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='data_emissao_pedido_tratada' AND data_type='date') THEN  ALTER TABLE dw.carga_abertos ALTER COLUMN data_emissao_pedido_tratada TYPE timestamp USING data_emissao_pedido_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_abertos' AND column_name='data_previsao_faturamento_tratada' AND data_type='date') THEN  ALTER TABLE dw.carga_abertos ALTER COLUMN data_previsao_faturamento_tratada TYPE timestamp USING data_previsao_faturamento_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='codigo_pedido') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "codigo_pedido" TO "codigo_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='codigo_cliente') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "codigo_cliente" TO "cliente_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='razao_social') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "razao_social" TO "razaosocial_pessoa"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='grupo_cliente') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "grupo_cliente" TO "grupo_cliente_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='codigo_consultor') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "codigo_consultor" TO "pessoa_doccom"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='consultor') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "consultor" TO "consultor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='supervisor') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "supervisor" TO "supervisor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='dt_previsao_faturamento') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "dt_previsao_faturamento" TO "data_previsao_faturamento"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='valor_emitido') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "valor_emitido" TO "vlrbrutoliquido_docitemdet"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='quantidade_emitida') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "quantidade_emitida" TO "qtdechapas_docitemdet"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='uf') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "uf" TO "sigla_uf"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='regiao_uf') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "regiao_uf" TO "regiao_uf_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='micro_regiao') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "micro_regiao" TO "descricao_regiao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='cidade') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "cidade" TO "descricao_cidade"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='classificacao') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "classificacao" TO "descricao_classif"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='origem') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "origem" TO "descricao_origem"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='orgao') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "orgao" TO "descricao_orgao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='status') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "status" TO "descricao_status"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='cor') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "cor" TO "cor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='grupo_item') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "grupo_item" TO "grupo_item_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='subgrupo') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "subgrupo" TO "subgrupo_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='tipo') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "tipo" TO "tipo_produto_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='colecao') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "colecao" TO "colecao_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='linha') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "linha" TO "linha_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='vlr_unit_bruliq') THEN ALTER TABLE dw.carga_emitidos RENAME COLUMN "vlr_unit_bruliq" TO "valor_unitario_bruto_liquido"; END IF; END $$;

ALTER TABLE IF EXISTS dw.carga_emitidos ADD COLUMN IF NOT EXISTS "data_emissao_pedido_tratada" timestamp;

ALTER TABLE IF EXISTS dw.carga_emitidos ADD COLUMN IF NOT EXISTS "data_previsao_faturamento_tratada" timestamp;

ALTER TABLE IF EXISTS dw.carga_emitidos ADD COLUMN IF NOT EXISTS "valor_emitido_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_emitidos ADD COLUMN IF NOT EXISTS "peso_emitido_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_emitidos ADD COLUMN IF NOT EXISTS "quantidade_emitida_tratada" double precision;

ALTER TABLE IF EXISTS dw.carga_emitidos ADD COLUMN IF NOT EXISTS "volume_m3_emitido_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_emitidos ADD COLUMN IF NOT EXISTS "nivel_de_servico_tratado" double precision;

CREATE TABLE IF NOT EXISTS dw.carga_emitidos ("codigo_docfat" bigint, "cliente_docfat" bigint, "razaosocial_pessoa" text, "grupo_cliente_descricao" text, "pessoa_doccom" bigint, "consultor_descricao" text, "supervisor_descricao" text, "data_emissao_pedido" date, "dia" bigint, "mes" bigint, "ano" bigint, "nivel_de_servico" bigint, "data_previsao_faturamento" date, "tipo_entrega" text, "vlrbrutoliquido_docitemdet" numeric, "qtdechapas_docitemdet" numeric, "peso_emitido" numeric, "volume_m3_emitido" numeric, "sigla_uf" text, "regiao_uf_descricao" text, "descricao_regiao" text, "descricao_cidade" text, "descricao_classif" text, "descricao_origem" text, "descricao_orgao" text, "descricao_status" text, "codigo_item" bigint, "descricao_item" text, "cor_descricao" text, "grupo_item_descricao" text, "subgrupo_descricao" text, "tipo_produto_descricao" text, "colecao_descricao" text, "linha_descricao" text, "vlrunitariobruto_docitemdet" numeric, "vlrunitarioliquido_docitemdet" numeric, "valor_unitario_bruto_liquido" numeric, "vlrliquido_docfat" numeric, "data_emissao_pedido_tratada" timestamp, "data_previsao_faturamento_tratada" timestamp, "valor_emitido_tratado" double precision, "peso_emitido_tratado" double precision, "quantidade_emitida_tratada" double precision, "volume_m3_emitido_tratado" double precision, "nivel_de_servico_tratado" double precision);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='data_emissao_pedido_tratada' AND data_type='date') THEN  ALTER TABLE dw.carga_emitidos ALTER COLUMN data_emissao_pedido_tratada TYPE timestamp USING data_emissao_pedido_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_emitidos' AND column_name='data_previsao_faturamento_tratada' AND data_type='date') THEN  ALTER TABLE dw.carga_emitidos ALTER COLUMN data_previsao_faturamento_tratada TYPE timestamp USING data_previsao_faturamento_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='codigo_pedido') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "codigo_pedido" TO "codigo_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='codigo_cliente') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "codigo_cliente" TO "cliente_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='razao_social') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "razao_social" TO "razaosocial_pessoa"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='grupo_cliente') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "grupo_cliente" TO "grupo_cliente_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='consultor') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "consultor" TO "consultor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='supervisor') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "supervisor" TO "supervisor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='dt_previsao_faturamento') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "dt_previsao_faturamento" TO "data_previsao_faturamento"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='on_time') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "on_time" TO "entrega_no_prazo"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='quantidade_faturada') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "quantidade_faturada" TO "qtdechapas_docent"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='uf') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "uf" TO "sigla_uf"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='regiao_uf') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "regiao_uf" TO "regiao_uf_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='micro_regiao') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "micro_regiao" TO "descricao_regiao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='cidade') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "cidade" TO "descricao_cidade"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='classificacao') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "classificacao" TO "descricao_classif"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='origem') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "origem" TO "descricao_origem"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='orgao') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "orgao" TO "descricao_orgao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='status') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "status" TO "descricao_status"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='cor') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "cor" TO "cor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='grupo_item') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "grupo_item" TO "grupo_item_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='subgrupo') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "subgrupo" TO "subgrupo_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='tipo') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "tipo" TO "tipo_produto_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='colecao') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "colecao" TO "colecao_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='linha') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "linha" TO "linha_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='familia') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "familia" TO "familia_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='carga') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "carga" TO "carga_cardoc"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='entrega') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "entrega" TO "codigo_docfat_entrega"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='dt_fatura') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "dt_fatura" TO "dtemissao_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='notafiscal') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "notafiscal" TO "numeronf_nfdocumentos"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='vlr_unit_bruliq') THEN ALTER TABLE dw.carga_faturados RENAME COLUMN "vlr_unit_bruliq" TO "valor_unitario_bruto_liquido"; END IF; END $$;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "data_emissao_pedido_tratada" timestamp;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "data_faturamento_tratada" timestamp;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "data_previsao_faturamento_tratada" timestamp;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "valor_faturado_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "peso_faturado_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "quantidade_faturada_tratada" double precision;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "volume_m3_faturado_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "nivel_de_servico_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "entrega_no_prazo_tratado" double precision;

ALTER TABLE IF EXISTS dw.carga_faturados ADD COLUMN IF NOT EXISTS "dias_desvio_faturamento_tratado" double precision;

CREATE TABLE IF NOT EXISTS dw.carga_faturados ("codigo_docfat" bigint, "cliente_docfat" bigint, "razaosocial_pessoa" text, "grupo_cliente_descricao" text, "consultor_descricao" text, "supervisor_descricao" text, "data_emissao_pedido" date, "dia" bigint, "mes" bigint, "ano" bigint, "nivel_de_servico" bigint, "data_previsao_faturamento" date, "entrega_no_prazo" bigint, "dias_desvio_faturamento" bigint, "tipo_entrega" text, "valor_faturado" numeric, "qtdechapas_docent" numeric, "peso_faturado" numeric, "volume_m3_faturado" numeric, "sigla_uf" text, "regiao_uf_descricao" text, "descricao_regiao" text, "descricao_cidade" text, "descricao_classif" text, "descricao_origem" text, "descricao_orgao" text, "descricao_status" text, "codigo_item" bigint, "descricao_item" text, "cor_descricao" text, "grupo_item_descricao" text, "subgrupo_descricao" text, "tipo_produto_descricao" text, "colecao_descricao" text, "linha_descricao" text, "familia_descricao" text, "carga_cardoc" bigint, "descricao_carga" text, "codigo_docfat_entrega" bigint, "dtemissao_docfat" timestamp, "numeronf_nfdocumentos" bigint, "vlrbrutoliquido_docitemdet" numeric, "qtdeaberta_docitemdet" numeric, "vlrunitariobruto_docitemdet" numeric, "vlrunitarioliquido_docitemdet" numeric, "valor_unitario_bruto_liquido" numeric, "vlrliquido_docfat" numeric, "data_emissao_pedido_tratada" timestamp, "data_faturamento_tratada" timestamp, "data_previsao_faturamento_tratada" timestamp, "valor_faturado_tratado" double precision, "peso_faturado_tratado" double precision, "quantidade_faturada_tratada" double precision, "volume_m3_faturado_tratado" double precision, "nivel_de_servico_tratado" double precision, "entrega_no_prazo_tratado" double precision, "dias_desvio_faturamento_tratado" double precision);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='dtemissao_docfat' AND data_type='date') THEN  ALTER TABLE dw.carga_faturados ALTER COLUMN dtemissao_docfat TYPE timestamp USING dtemissao_docfat::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='data_emissao_pedido_tratada' AND data_type='date') THEN  ALTER TABLE dw.carga_faturados ALTER COLUMN data_emissao_pedido_tratada TYPE timestamp USING data_emissao_pedido_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='data_faturamento_tratada' AND data_type='date') THEN  ALTER TABLE dw.carga_faturados ALTER COLUMN data_faturamento_tratada TYPE timestamp USING data_faturamento_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_faturados' AND column_name='data_previsao_faturamento_tratada' AND data_type='date') THEN  ALTER TABLE dw.carga_faturados ALTER COLUMN data_previsao_faturamento_tratada TYPE timestamp USING data_previsao_faturamento_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_carteira' AND column_name='grupo_cliente') THEN ALTER TABLE dw.carga_carteira RENAME COLUMN "grupo_cliente" TO "grupo_cliente_descricao"; END IF; END $$;

CREATE TABLE IF NOT EXISTS dw.carga_carteira ("codigo_pessoa" bigint, "razaosocial_pessoa" text, "cliente_pessoa" text, "grupo_pessoa" bigint, "descricao_grupo" text, "grupo_cliente_descricao" text);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='descricao') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "descricao" TO "razaosocial_pessoa"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='metaporlinha') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "metaporlinha" TO "metaporlinha_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='metaporgrupo') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "metaporgrupo" TO "metaporgrupo_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='metaportipoproduto') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "metaportipoproduto" TO "metaportipoproduto_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='metaporregiao') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "metaporregiao" TO "metaporregiao_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='metaporunidadefabril') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "metaporunidadefabril" TO "metaporunidfabril_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='metapororigem') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "metapororigem" TO "metapororigem_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='metaporsupervisor') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "metaporsupervisor" TO "metaporsupervisor_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='metaporconsultor') THEN ALTER TABLE dw.carga_metas RENAME COLUMN "metaporconsultor" TO "metaporconsultor_consven"; END IF; END $$;

CREATE TABLE IF NOT EXISTS dw.carga_metas ("autoinc_metasven" bigint, "empresa_metasven" bigint, "tipo_metasven" bigint, "tipodoc_metasven" bigint, "ano_metasven" bigint, "codigo_metasven" bigint, "razaosocial_pessoa" text, "metaporlinha_consven" text, "metaporgrupo_consven" text, "metaportipoproduto_consven" text, "metaporregiao_consven" text, "metaporunidfabril_consven" text, "metapororigem_consven" text, "metaporsupervisor_consven" text, "metaporconsultor_consven" text, "meta_01_metasven" numeric, "meta_02_metasven" numeric, "meta_03_metasven" numeric, "meta_04_metasven" numeric, "meta_05_metasven" numeric, "meta_06_metasven" numeric, "meta_07_metasven" numeric, "meta_08_metasven" numeric, "meta_09_metasven" numeric, "meta_10_metasven" numeric, "meta_11_metasven" numeric, "meta_12_metasven" numeric, "datahorainclusao_metasven" timestamp, "usuarioinclusao_metasven" text, "datahoraalteracao_metasven" timestamp, "usuarioalteracao_metasven" text);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='datahorainclusao_metasven' AND data_type='date') THEN  ALTER TABLE dw.carga_metas ALTER COLUMN datahorainclusao_metasven TYPE timestamp USING datahorainclusao_metasven::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carga_metas' AND column_name='datahoraalteracao_metasven' AND data_type='date') THEN  ALTER TABLE dw.carga_metas ALTER COLUMN datahoraalteracao_metasven TYPE timestamp USING datahoraalteracao_metasven::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_cliente' AND column_name='codigo_cliente') THEN ALTER TABLE dw.dim_cliente RENAME COLUMN "codigo_cliente" TO "cliente_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_cliente' AND column_name='razao_social') THEN ALTER TABLE dw.dim_cliente RENAME COLUMN "razao_social" TO "razaosocial_pessoa"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_cliente' AND column_name='grupo_cliente') THEN ALTER TABLE dw.dim_cliente RENAME COLUMN "grupo_cliente" TO "grupo_cliente_descricao"; END IF; END $$;

CREATE TABLE IF NOT EXISTS dw.dim_cliente (id text PRIMARY KEY, "cliente_docfat" bigint, "razaosocial_pessoa" text, "grupo_cliente_descricao" text);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_comercial' AND column_name='consultor') THEN ALTER TABLE dw.dim_comercial RENAME COLUMN "consultor" TO "consultor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_comercial' AND column_name='supervisor') THEN ALTER TABLE dw.dim_comercial RENAME COLUMN "supervisor" TO "supervisor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_comercial' AND column_name='classificacao') THEN ALTER TABLE dw.dim_comercial RENAME COLUMN "classificacao" TO "descricao_classif"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_comercial' AND column_name='origem') THEN ALTER TABLE dw.dim_comercial RENAME COLUMN "origem" TO "descricao_origem"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_comercial' AND column_name='orgao') THEN ALTER TABLE dw.dim_comercial RENAME COLUMN "orgao" TO "descricao_orgao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_comercial' AND column_name='status') THEN ALTER TABLE dw.dim_comercial RENAME COLUMN "status" TO "descricao_status"; END IF; END $$;

CREATE TABLE IF NOT EXISTS dw.dim_comercial (id text PRIMARY KEY, "consultor_descricao" text, "supervisor_descricao" text, "descricao_origem" text, "descricao_orgao" text, "descricao_status" text, "descricao_classif" text, "tipo_entrega" text);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_geografia' AND column_name='uf') THEN ALTER TABLE dw.dim_geografia RENAME COLUMN "uf" TO "sigla_uf"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_geografia' AND column_name='regiao_uf') THEN ALTER TABLE dw.dim_geografia RENAME COLUMN "regiao_uf" TO "regiao_uf_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_geografia' AND column_name='micro_regiao') THEN ALTER TABLE dw.dim_geografia RENAME COLUMN "micro_regiao" TO "descricao_regiao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_geografia' AND column_name='cidade') THEN ALTER TABLE dw.dim_geografia RENAME COLUMN "cidade" TO "descricao_cidade"; END IF; END $$;

CREATE TABLE IF NOT EXISTS dw.dim_geografia (id text PRIMARY KEY, "sigla_uf" text, "regiao_uf_descricao" text, "descricao_regiao" text, "descricao_cidade" text);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_produto' AND column_name='cor') THEN ALTER TABLE dw.dim_produto RENAME COLUMN "cor" TO "cor_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_produto' AND column_name='grupo_item') THEN ALTER TABLE dw.dim_produto RENAME COLUMN "grupo_item" TO "grupo_item_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_produto' AND column_name='subgrupo') THEN ALTER TABLE dw.dim_produto RENAME COLUMN "subgrupo" TO "subgrupo_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_produto' AND column_name='tipo') THEN ALTER TABLE dw.dim_produto RENAME COLUMN "tipo" TO "tipo_produto_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_produto' AND column_name='colecao') THEN ALTER TABLE dw.dim_produto RENAME COLUMN "colecao" TO "colecao_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_produto' AND column_name='linha') THEN ALTER TABLE dw.dim_produto RENAME COLUMN "linha" TO "linha_descricao"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='dim_produto' AND column_name='familia') THEN ALTER TABLE dw.dim_produto RENAME COLUMN "familia" TO "familia_descricao"; END IF; END $$;

CREATE TABLE IF NOT EXISTS dw.dim_produto (id text PRIMARY KEY, "codigo_item" bigint, "descricao_item" text, "cor_descricao" text, "grupo_item_descricao" text, "subgrupo_descricao" text, "tipo_produto_descricao" text, "colecao_descricao" text, "linha_descricao" text, "familia_descricao" text);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_abertos' AND column_name='codigo_pedido') THEN ALTER TABLE dw.fato_abertos RENAME COLUMN "codigo_pedido" TO "codigo_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_abertos' AND column_name='dt_previsao_faturamento') THEN ALTER TABLE dw.fato_abertos RENAME COLUMN "dt_previsao_faturamento" TO "data_previsao_faturamento"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_abertos' AND column_name='vlr_unit_bruliq') THEN ALTER TABLE dw.fato_abertos RENAME COLUMN "vlr_unit_bruliq" TO "valor_unitario_bruto_liquido"; END IF; END $$;

ALTER TABLE IF EXISTS dw.fato_abertos ADD COLUMN IF NOT EXISTS "data_emissao_pedido_tratada" timestamp;

ALTER TABLE IF EXISTS dw.fato_abertos ADD COLUMN IF NOT EXISTS "data_previsao_faturamento_tratada" timestamp;

ALTER TABLE IF EXISTS dw.fato_abertos ADD COLUMN IF NOT EXISTS "valor_em_aberto_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_abertos ADD COLUMN IF NOT EXISTS "peso_em_aberto_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_abertos ADD COLUMN IF NOT EXISTS "quantidade_em_aberto_tratada" double precision;

ALTER TABLE IF EXISTS dw.fato_abertos ADD COLUMN IF NOT EXISTS "volume_m3_em_aberto_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_abertos ADD COLUMN IF NOT EXISTS "nivel_de_servico_tratado" double precision;

CREATE TABLE IF NOT EXISTS dw.fato_abertos (registro_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "codigo_docfat" bigint, "data_emissao_pedido" date, "dia" bigint, "mes" bigint, "ano" bigint, "nivel_de_servico" bigint, "data_previsao_faturamento" date, "valor_em_aberto" numeric, "qtdeaberta_docitemdet" numeric, "peso_em_aberto" numeric, "volume_m3_em_aberto" numeric, "vlrbrutoliquido_docitemdet" numeric, "vlrunitariobruto_docitemdet" numeric, "vlrunitarioliquido_docitemdet" numeric, "valor_unitario_bruto_liquido" numeric, "vlrliquido_docfat" numeric, "data_emissao_pedido_tratada" timestamp, "data_previsao_faturamento_tratada" timestamp, "valor_em_aberto_tratado" double precision, "peso_em_aberto_tratado" double precision, "quantidade_em_aberto_tratada" double precision, "volume_m3_em_aberto_tratado" double precision, "nivel_de_servico_tratado" double precision, cliente_id text NOT NULL REFERENCES dw.dim_cliente(id), comercial_id text NOT NULL REFERENCES dw.dim_comercial(id), geografia_id text NOT NULL REFERENCES dw.dim_geografia(id), produto_id text NOT NULL REFERENCES dw.dim_produto(id));

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_abertos' AND column_name='data_emissao_pedido_tratada' AND data_type='date') THEN DROP VIEW IF EXISTS dw.pedidos_abertos; ALTER TABLE dw.fato_abertos ALTER COLUMN data_emissao_pedido_tratada TYPE timestamp USING data_emissao_pedido_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_abertos' AND column_name='data_previsao_faturamento_tratada' AND data_type='date') THEN DROP VIEW IF EXISTS dw.pedidos_abertos; ALTER TABLE dw.fato_abertos ALTER COLUMN data_previsao_faturamento_tratada TYPE timestamp USING data_previsao_faturamento_tratada::timestamp; END IF; END $$;

CREATE OR REPLACE VIEW dw.pedidos_abertos AS SELECT f.registro_id, f."codigo_docfat", cliente."cliente_docfat", cliente."razaosocial_pessoa", cliente."grupo_cliente_descricao", comercial."consultor_descricao", comercial."supervisor_descricao", f."data_emissao_pedido", f."dia", f."mes", f."ano", f."nivel_de_servico", f."data_previsao_faturamento", comercial."tipo_entrega", f."valor_em_aberto", f."qtdeaberta_docitemdet", f."peso_em_aberto", f."volume_m3_em_aberto", geografia."sigla_uf", geografia."regiao_uf_descricao", geografia."descricao_regiao", geografia."descricao_cidade", comercial."descricao_classif", comercial."descricao_origem", comercial."descricao_orgao", comercial."descricao_status", produto."codigo_item", produto."descricao_item", produto."cor_descricao", produto."grupo_item_descricao", produto."subgrupo_descricao", produto."tipo_produto_descricao", produto."colecao_descricao", produto."linha_descricao", f."vlrbrutoliquido_docitemdet", f."vlrunitariobruto_docitemdet", f."vlrunitarioliquido_docitemdet", f."valor_unitario_bruto_liquido", f."vlrliquido_docfat", f."data_emissao_pedido_tratada", f."data_previsao_faturamento_tratada", f."valor_em_aberto_tratado", f."peso_em_aberto_tratado", f."quantidade_em_aberto_tratada", f."volume_m3_em_aberto_tratado", f."nivel_de_servico_tratado" FROM dw.fato_abertos f JOIN dw.dim_cliente cliente ON cliente.id=f.cliente_id JOIN dw.dim_comercial comercial ON comercial.id=f.comercial_id JOIN dw.dim_geografia geografia ON geografia.id=f.geografia_id JOIN dw.dim_produto produto ON produto.id=f.produto_id;

CREATE INDEX IF NOT EXISTS idx_abertos_data ON dw.fato_abertos(data_emissao_pedido);

CREATE INDEX IF NOT EXISTS idx_abertos_cliente ON dw.fato_abertos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_abertos_comercial ON dw.fato_abertos(comercial_id);

CREATE INDEX IF NOT EXISTS idx_abertos_geografia ON dw.fato_abertos(geografia_id);

CREATE INDEX IF NOT EXISTS idx_abertos_produto ON dw.fato_abertos(produto_id);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_emitidos' AND column_name='codigo_pedido') THEN ALTER TABLE dw.fato_emitidos RENAME COLUMN "codigo_pedido" TO "codigo_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_emitidos' AND column_name='codigo_consultor') THEN ALTER TABLE dw.fato_emitidos RENAME COLUMN "codigo_consultor" TO "pessoa_doccom"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_emitidos' AND column_name='dt_previsao_faturamento') THEN ALTER TABLE dw.fato_emitidos RENAME COLUMN "dt_previsao_faturamento" TO "data_previsao_faturamento"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_emitidos' AND column_name='valor_emitido') THEN ALTER TABLE dw.fato_emitidos RENAME COLUMN "valor_emitido" TO "vlrbrutoliquido_docitemdet"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_emitidos' AND column_name='quantidade_emitida') THEN ALTER TABLE dw.fato_emitidos RENAME COLUMN "quantidade_emitida" TO "qtdechapas_docitemdet"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_emitidos' AND column_name='vlr_unit_bruliq') THEN ALTER TABLE dw.fato_emitidos RENAME COLUMN "vlr_unit_bruliq" TO "valor_unitario_bruto_liquido"; END IF; END $$;

ALTER TABLE IF EXISTS dw.fato_emitidos ADD COLUMN IF NOT EXISTS "data_emissao_pedido_tratada" timestamp;

ALTER TABLE IF EXISTS dw.fato_emitidos ADD COLUMN IF NOT EXISTS "data_previsao_faturamento_tratada" timestamp;

ALTER TABLE IF EXISTS dw.fato_emitidos ADD COLUMN IF NOT EXISTS "valor_emitido_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_emitidos ADD COLUMN IF NOT EXISTS "peso_emitido_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_emitidos ADD COLUMN IF NOT EXISTS "quantidade_emitida_tratada" double precision;

ALTER TABLE IF EXISTS dw.fato_emitidos ADD COLUMN IF NOT EXISTS "volume_m3_emitido_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_emitidos ADD COLUMN IF NOT EXISTS "nivel_de_servico_tratado" double precision;

CREATE TABLE IF NOT EXISTS dw.fato_emitidos (registro_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "codigo_docfat" bigint, "pessoa_doccom" bigint, "data_emissao_pedido" date, "dia" bigint, "mes" bigint, "ano" bigint, "nivel_de_servico" bigint, "data_previsao_faturamento" date, "vlrbrutoliquido_docitemdet" numeric, "qtdechapas_docitemdet" numeric, "peso_emitido" numeric, "volume_m3_emitido" numeric, "vlrunitariobruto_docitemdet" numeric, "vlrunitarioliquido_docitemdet" numeric, "valor_unitario_bruto_liquido" numeric, "vlrliquido_docfat" numeric, "data_emissao_pedido_tratada" timestamp, "data_previsao_faturamento_tratada" timestamp, "valor_emitido_tratado" double precision, "peso_emitido_tratado" double precision, "quantidade_emitida_tratada" double precision, "volume_m3_emitido_tratado" double precision, "nivel_de_servico_tratado" double precision, cliente_id text NOT NULL REFERENCES dw.dim_cliente(id), comercial_id text NOT NULL REFERENCES dw.dim_comercial(id), geografia_id text NOT NULL REFERENCES dw.dim_geografia(id), produto_id text NOT NULL REFERENCES dw.dim_produto(id));

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_emitidos' AND column_name='data_emissao_pedido_tratada' AND data_type='date') THEN DROP VIEW IF EXISTS dw.pedidos_emitidos; ALTER TABLE dw.fato_emitidos ALTER COLUMN data_emissao_pedido_tratada TYPE timestamp USING data_emissao_pedido_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_emitidos' AND column_name='data_previsao_faturamento_tratada' AND data_type='date') THEN DROP VIEW IF EXISTS dw.pedidos_emitidos; ALTER TABLE dw.fato_emitidos ALTER COLUMN data_previsao_faturamento_tratada TYPE timestamp USING data_previsao_faturamento_tratada::timestamp; END IF; END $$;

CREATE OR REPLACE VIEW dw.pedidos_emitidos AS SELECT f.registro_id, f."codigo_docfat", cliente."cliente_docfat", cliente."razaosocial_pessoa", cliente."grupo_cliente_descricao", f."pessoa_doccom", comercial."consultor_descricao", comercial."supervisor_descricao", f."data_emissao_pedido", f."dia", f."mes", f."ano", f."nivel_de_servico", f."data_previsao_faturamento", comercial."tipo_entrega", f."vlrbrutoliquido_docitemdet", f."qtdechapas_docitemdet", f."peso_emitido", f."volume_m3_emitido", geografia."sigla_uf", geografia."regiao_uf_descricao", geografia."descricao_regiao", geografia."descricao_cidade", comercial."descricao_classif", comercial."descricao_origem", comercial."descricao_orgao", comercial."descricao_status", produto."codigo_item", produto."descricao_item", produto."cor_descricao", produto."grupo_item_descricao", produto."subgrupo_descricao", produto."tipo_produto_descricao", produto."colecao_descricao", produto."linha_descricao", f."vlrunitariobruto_docitemdet", f."vlrunitarioliquido_docitemdet", f."valor_unitario_bruto_liquido", f."vlrliquido_docfat", f."data_emissao_pedido_tratada", f."data_previsao_faturamento_tratada", f."valor_emitido_tratado", f."peso_emitido_tratado", f."quantidade_emitida_tratada", f."volume_m3_emitido_tratado", f."nivel_de_servico_tratado" FROM dw.fato_emitidos f JOIN dw.dim_cliente cliente ON cliente.id=f.cliente_id JOIN dw.dim_comercial comercial ON comercial.id=f.comercial_id JOIN dw.dim_geografia geografia ON geografia.id=f.geografia_id JOIN dw.dim_produto produto ON produto.id=f.produto_id;

CREATE INDEX IF NOT EXISTS idx_emitidos_data ON dw.fato_emitidos(data_emissao_pedido);

CREATE INDEX IF NOT EXISTS idx_emitidos_cliente ON dw.fato_emitidos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_emitidos_comercial ON dw.fato_emitidos(comercial_id);

CREATE INDEX IF NOT EXISTS idx_emitidos_geografia ON dw.fato_emitidos(geografia_id);

CREATE INDEX IF NOT EXISTS idx_emitidos_produto ON dw.fato_emitidos(produto_id);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='codigo_pedido') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "codigo_pedido" TO "codigo_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='dt_previsao_faturamento') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "dt_previsao_faturamento" TO "data_previsao_faturamento"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='on_time') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "on_time" TO "entrega_no_prazo"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='quantidade_faturada') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "quantidade_faturada" TO "qtdechapas_docent"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='carga') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "carga" TO "carga_cardoc"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='entrega') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "entrega" TO "codigo_docfat_entrega"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='dt_fatura') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "dt_fatura" TO "dtemissao_docfat"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='notafiscal') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "notafiscal" TO "numeronf_nfdocumentos"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='vlr_unit_bruliq') THEN ALTER TABLE dw.fato_faturados RENAME COLUMN "vlr_unit_bruliq" TO "valor_unitario_bruto_liquido"; END IF; END $$;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "data_emissao_pedido_tratada" timestamp;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "data_faturamento_tratada" timestamp;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "data_previsao_faturamento_tratada" timestamp;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "valor_faturado_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "peso_faturado_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "quantidade_faturada_tratada" double precision;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "volume_m3_faturado_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "nivel_de_servico_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "entrega_no_prazo_tratado" double precision;

ALTER TABLE IF EXISTS dw.fato_faturados ADD COLUMN IF NOT EXISTS "dias_desvio_faturamento_tratado" double precision;

CREATE TABLE IF NOT EXISTS dw.fato_faturados (registro_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "codigo_docfat" bigint, "data_emissao_pedido" date, "dia" bigint, "mes" bigint, "ano" bigint, "nivel_de_servico" bigint, "data_previsao_faturamento" date, "entrega_no_prazo" bigint, "dias_desvio_faturamento" bigint, "valor_faturado" numeric, "qtdechapas_docent" numeric, "peso_faturado" numeric, "volume_m3_faturado" numeric, "carga_cardoc" bigint, "descricao_carga" text, "codigo_docfat_entrega" bigint, "dtemissao_docfat" timestamp, "numeronf_nfdocumentos" bigint, "vlrbrutoliquido_docitemdet" numeric, "qtdeaberta_docitemdet" numeric, "vlrunitariobruto_docitemdet" numeric, "vlrunitarioliquido_docitemdet" numeric, "valor_unitario_bruto_liquido" numeric, "vlrliquido_docfat" numeric, "data_emissao_pedido_tratada" timestamp, "data_faturamento_tratada" timestamp, "data_previsao_faturamento_tratada" timestamp, "valor_faturado_tratado" double precision, "peso_faturado_tratado" double precision, "quantidade_faturada_tratada" double precision, "volume_m3_faturado_tratado" double precision, "nivel_de_servico_tratado" double precision, "entrega_no_prazo_tratado" double precision, "dias_desvio_faturamento_tratado" double precision, cliente_id text NOT NULL REFERENCES dw.dim_cliente(id), comercial_id text NOT NULL REFERENCES dw.dim_comercial(id), geografia_id text NOT NULL REFERENCES dw.dim_geografia(id), produto_id text NOT NULL REFERENCES dw.dim_produto(id));

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='dtemissao_docfat' AND data_type='date') THEN DROP VIEW IF EXISTS dw.pedidos_faturados; ALTER TABLE dw.fato_faturados ALTER COLUMN dtemissao_docfat TYPE timestamp USING dtemissao_docfat::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='data_emissao_pedido_tratada' AND data_type='date') THEN DROP VIEW IF EXISTS dw.pedidos_faturados; ALTER TABLE dw.fato_faturados ALTER COLUMN data_emissao_pedido_tratada TYPE timestamp USING data_emissao_pedido_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='data_faturamento_tratada' AND data_type='date') THEN DROP VIEW IF EXISTS dw.pedidos_faturados; ALTER TABLE dw.fato_faturados ALTER COLUMN data_faturamento_tratada TYPE timestamp USING data_faturamento_tratada::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='fato_faturados' AND column_name='data_previsao_faturamento_tratada' AND data_type='date') THEN DROP VIEW IF EXISTS dw.pedidos_faturados; ALTER TABLE dw.fato_faturados ALTER COLUMN data_previsao_faturamento_tratada TYPE timestamp USING data_previsao_faturamento_tratada::timestamp; END IF; END $$;

CREATE OR REPLACE VIEW dw.pedidos_faturados AS SELECT f.registro_id, f."codigo_docfat", cliente."cliente_docfat", cliente."razaosocial_pessoa", cliente."grupo_cliente_descricao", comercial."consultor_descricao", comercial."supervisor_descricao", f."data_emissao_pedido", f."dia", f."mes", f."ano", f."nivel_de_servico", f."data_previsao_faturamento", f."entrega_no_prazo", f."dias_desvio_faturamento", comercial."tipo_entrega", f."valor_faturado", f."qtdechapas_docent", f."peso_faturado", f."volume_m3_faturado", geografia."sigla_uf", geografia."regiao_uf_descricao", geografia."descricao_regiao", geografia."descricao_cidade", comercial."descricao_classif", comercial."descricao_origem", comercial."descricao_orgao", comercial."descricao_status", produto."codigo_item", produto."descricao_item", produto."cor_descricao", produto."grupo_item_descricao", produto."subgrupo_descricao", produto."tipo_produto_descricao", produto."colecao_descricao", produto."linha_descricao", produto."familia_descricao", f."carga_cardoc", f."descricao_carga", f."codigo_docfat_entrega", f."dtemissao_docfat", f."numeronf_nfdocumentos", f."vlrbrutoliquido_docitemdet", f."qtdeaberta_docitemdet", f."vlrunitariobruto_docitemdet", f."vlrunitarioliquido_docitemdet", f."valor_unitario_bruto_liquido", f."vlrliquido_docfat", f."data_emissao_pedido_tratada", f."data_faturamento_tratada", f."data_previsao_faturamento_tratada", f."valor_faturado_tratado", f."peso_faturado_tratado", f."quantidade_faturada_tratada", f."volume_m3_faturado_tratado", f."nivel_de_servico_tratado", f."entrega_no_prazo_tratado", f."dias_desvio_faturamento_tratado" FROM dw.fato_faturados f JOIN dw.dim_cliente cliente ON cliente.id=f.cliente_id JOIN dw.dim_comercial comercial ON comercial.id=f.comercial_id JOIN dw.dim_geografia geografia ON geografia.id=f.geografia_id JOIN dw.dim_produto produto ON produto.id=f.produto_id;

CREATE INDEX IF NOT EXISTS idx_faturados_data ON dw.fato_faturados(dtemissao_docfat);

CREATE INDEX IF NOT EXISTS idx_faturados_cliente ON dw.fato_faturados(cliente_id);

CREATE INDEX IF NOT EXISTS idx_faturados_comercial ON dw.fato_faturados(comercial_id);

CREATE INDEX IF NOT EXISTS idx_faturados_geografia ON dw.fato_faturados(geografia_id);

CREATE INDEX IF NOT EXISTS idx_faturados_produto ON dw.fato_faturados(produto_id);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='carteira_clientes' AND column_name='grupo_cliente') THEN ALTER TABLE dw.carteira_clientes RENAME COLUMN "grupo_cliente" TO "grupo_cliente_descricao"; END IF; END $$;

CREATE TABLE IF NOT EXISTS dw.carteira_clientes (LIKE dw.carga_carteira INCLUDING ALL);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='descricao') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "descricao" TO "razaosocial_pessoa"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='metaporlinha') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "metaporlinha" TO "metaporlinha_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='metaporgrupo') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "metaporgrupo" TO "metaporgrupo_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='metaportipoproduto') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "metaportipoproduto" TO "metaportipoproduto_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='metaporregiao') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "metaporregiao" TO "metaporregiao_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='metaporunidadefabril') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "metaporunidadefabril" TO "metaporunidfabril_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='metapororigem') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "metapororigem" TO "metapororigem_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='metaporsupervisor') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "metaporsupervisor" TO "metaporsupervisor_consven"; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='metaporconsultor') THEN ALTER TABLE dw.metas_consultores RENAME COLUMN "metaporconsultor" TO "metaporconsultor_consven"; END IF; END $$;

CREATE TABLE IF NOT EXISTS dw.metas_consultores (LIKE dw.carga_metas INCLUDING ALL);

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='datahorainclusao_metasven' AND data_type='date') THEN  ALTER TABLE dw.metas_consultores ALTER COLUMN datahorainclusao_metasven TYPE timestamp USING datahorainclusao_metasven::timestamp; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='metas_consultores' AND column_name='datahoraalteracao_metasven' AND data_type='date') THEN  ALTER TABLE dw.metas_consultores ALTER COLUMN datahoraalteracao_metasven TYPE timestamp USING datahoraalteracao_metasven::timestamp; END IF; END $$;

COMMIT;

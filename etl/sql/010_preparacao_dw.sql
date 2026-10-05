BEGIN;
INSERT INTO etl.execucao_carga(id,status,origem) VALUES ('${ETL_RUN_ID}', 'executando', 'staging/apache-hop');
TRUNCATE dw.carga_abertos;
TRUNCATE dw.carga_emitidos;
TRUNCATE dw.carga_faturados;
TRUNCATE dw.carga_carteira;
TRUNCATE dw.carga_metas;
COMMIT;

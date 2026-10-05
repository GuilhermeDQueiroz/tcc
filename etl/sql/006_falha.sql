UPDATE etl.execucao_carga SET status='falhou',fim=now() WHERE id='${ETL_RUN_ID}' AND status='executando';

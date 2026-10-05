DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM dw.carga_abertos) THEN RAISE EXCEPTION 'Base abertos vazia: publicação interrompida'; END IF;
IF NOT EXISTS(SELECT 1 FROM dw.carga_emitidos) THEN RAISE EXCEPTION 'Base emitidos vazia: publicação interrompida'; END IF;
IF NOT EXISTS(SELECT 1 FROM dw.carga_faturados) THEN RAISE EXCEPTION 'Base faturados vazia: publicação interrompida'; END IF;
IF NOT EXISTS(SELECT 1 FROM dw.carga_carteira) THEN RAISE EXCEPTION 'Base carteira vazia: publicação interrompida'; END IF;
IF NOT EXISTS(SELECT 1 FROM dw.carga_metas) THEN RAISE EXCEPTION 'Base metas vazia: publicação interrompida'; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS etl;
DO $$
DECLARE base text;
BEGIN
  FOREACH base IN ARRAY ARRAY['abertos','emitidos','faturados','carteira','metas'] LOOP
    IF to_regclass('staging.' || base) IS NOT NULL THEN
      IF to_regclass('etl.referencia_' || base) IS NOT NULL THEN
        RAISE EXCEPTION 'Referência % já existe; não sobrescrever', base;
      END IF;
      EXECUTE format('ALTER TABLE staging.%I SET SCHEMA etl',base);
      EXECUTE format('ALTER TABLE etl.%I RENAME TO %I',base,'referencia_' || base);
    END IF;
  END LOOP;
END $$;

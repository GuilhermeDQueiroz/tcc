"""Generate native Hop assets from the verified result schema and original SQL."""
from pathlib import Path
import json
import shutil
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
etl = root / 'etl'
source_schema = json.loads((etl / 'sql/fontes/consolidated-source-schema.json').read_text())
from dw_contract import create_contract
contract=create_contract(source_schema)
(etl/'contrato-colunas-dw.json').write_text(json.dumps(contract,indent=2,ensure_ascii=False),encoding='utf-8')
schema={document['query']:document['columns'] for document in contract['areas'].values()}
raw = json.loads((etl / 'sql/fontes/raw-source-schema.json').read_text())
from source_contract import to_postgres
areas = {'abertos':'QUERY_ABERTOS', 'emitidos':'QUERY_EMITIDOS', 'faturados':'QUERY_FATURADOS', 'carteira':'QUERY_CARTEIRA', 'metas':'QUERY_METAS_CONSULTORES'}
portal = root.parent / 'Portal-Corporativo/etl'
for folder in ['sql/transformacoes','sql/fontes','pipelines/extracao/dimensoes','pipelines/extracao/fatos','pipelines/transformacao-carregamento','scripts','workflows','metadata/rdbms','metadata/pipeline-run-configuration','metadata/workflow-run-configuration']:
    (etl / folder).mkdir(parents=True, exist_ok=True)

def xml_file(element, path):
    ET.indent(element)
    ET.ElementTree(element).write(path, encoding='utf-8', xml_declaration=True)

def add(parent, tag, text=''):
    element = ET.SubElement(parent, tag)
    element.text = str(text)
    return element

def pg_type(column):
    kind = column['type']
    if 'datetime.datetime' in kind: return 'timestamp'
    if 'datetime.date' in kind: return 'date'
    if "'int'" in kind: return 'bigint'
    if "'float'" in kind: return 'double precision'
    if 'Decimal' in kind: return 'numeric'
    return 'text'

def timestamp_migration(schema_name,table,column,view=None):
    drop=f'DROP VIEW IF EXISTS dw.{view};' if view else ''
    return f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='{schema_name}' AND table_name='{table}' AND column_name='{column}' AND data_type='date') THEN {drop} ALTER TABLE {schema_name}.{table} ALTER COLUMN {column} TYPE timestamp USING {column}::timestamp; END IF; END $$;"

ddl = ['CREATE SCHEMA IF NOT EXISTS staging;', 'CREATE SCHEMA IF NOT EXISTS dw;', 'CREATE SCHEMA IF NOT EXISTS etl;',
    "CREATE TABLE IF NOT EXISTS etl.execucao_carga (id uuid PRIMARY KEY, inicio timestamptz NOT NULL DEFAULT now(), fim timestamptz, status text NOT NULL CHECK(status IN ('executando','publicado','falhou')), origem text NOT NULL DEFAULT 'firebird/apache-hop', contagens jsonb);"]
for table, document in raw.items():
    columns = ',\n'.join(f'  "{c["name"].lower()}" {pg_type(c)}' for c in document['columns'])
    ddl.append(f'CREATE TABLE IF NOT EXISTS staging.stg_{table.lower()} (\n{columns}\n);')
    for column in document['columns']:
        if pg_type(column)=='timestamp':ddl.append(timestamp_migration('staging','stg_'+table.lower(),column['name'].lower()))
(etl/'sql/001_staging.sql').write_text('\n\n'.join(ddl)+'\n',encoding='utf-8')

old_dimensions = {
    'cliente':['codigo_cliente','razao_social','grupo_cliente'],
    'comercial':['consultor','supervisor','origem','orgao','status','classificacao','tipo_entrega'],
    'geografia':['uf','regiao_uf','micro_regiao','cidade'],
    'produto':['codigo_item','descricao_item','cor','grupo_item','subgrupo','tipo','colecao','linha','familia'],
}
renames={c['legacy'].lower():c['name'] for c in contract['areas']['faturados']['columns'] if c['kind'] not in ['numeric-treatment','date-treatment']}
dimensions={dim:[renames[c] for c in columns] for dim,columns in old_dimensions.items()}
types = {c['name'].lower():pg_type(c) for c in schema['QUERY_FATURADOS']}
dw = ['BEGIN;']+[f'DROP VIEW IF EXISTS dw.pedidos_{area};' for area in ['abertos','emitidos','faturados']]
def migrate_columns(table,columns):
    for c in columns:
        old=c['legacy'].lower();new=c['name']
        if old!=new and c['kind'] not in ['numeric-treatment','date-treatment']:
            dw.append(f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='dw' AND table_name='{table}' AND column_name='{old}') THEN ALTER TABLE dw.{table} RENAME COLUMN \"{old}\" TO \"{new}\"; END IF; END $$;")
    for c in columns:
        if c['kind'] in ['numeric-treatment','date-treatment']:
            dw.append(f'ALTER TABLE IF EXISTS dw.{table} ADD COLUMN IF NOT EXISTS "{c["name"]}" {pg_type(c)};')

for area,name in areas.items():
    migrate_columns('carga_'+area,schema[name])
    columns=', '.join(f'"{c["name"].lower()}" {pg_type(c)}' for c in schema[name])
    dw.append(f'CREATE TABLE IF NOT EXISTS dw.carga_{area} ({columns});')
    for column in schema[name]:
        if pg_type(column)=='timestamp':dw.append(timestamp_migration('dw','carga_'+area,column['name'].lower()))
publish = ['BEGIN;', 'SELECT pg_advisory_xact_lock(741083, 1);']
prepare = ['BEGIN;', "INSERT INTO etl.execucao_carga(id,status) VALUES ('${ETL_RUN_ID}', 'executando');"]
for table in raw:
    prepare.append(f'TRUNCATE staging.stg_{table.lower()};')
for area in areas:
    prepare.append(f'TRUNCATE dw.carga_{area};')
prepare.append('COMMIT;')
for area in ['abertos','emitidos','faturados']:
    publish.append(f'DELETE FROM dw.fato_{area};')
for dim, columns in dimensions.items():
    migrate_columns('dim_'+dim,[c for c in schema['QUERY_FATURADOS'] if c['name'] in columns])
    dw.append(f'CREATE TABLE IF NOT EXISTS dw.dim_{dim} (id text PRIMARY KEY, '+', '.join(f'"{c}" {types[c]}' for c in columns)+');')
    publish.append(f'DELETE FROM dw.dim_{dim};')
    unions = []
    for area in ['abertos','emitidos','faturados']:
        available = {c['name'].lower() for c in schema[areas[area]]}
        expressions = [f'"{c}"' if c in available else f'NULL::{types[c]}' for c in columns]
        unions.append(f'SELECT md5(jsonb_build_array({", ".join(expressions)})::text) AS id, '+', '.join(f'{v} AS "{c}"' for v,c in zip(expressions,columns))+f' FROM dw.carga_{area}')
    publish.append(f'INSERT INTO dw.dim_{dim} SELECT DISTINCT * FROM ('+' UNION ALL '.join(unions)+') src;')
for area in ['abertos','emitidos','faturados']:
    available = {c['name'].lower() for c in schema[areas[area]]}
    dimensional = {c for columns in dimensions.values() for c in columns}
    measures = [c for c in schema[areas[area]] if c['name'].lower() not in dimensional]
    fact_columns = [f'"{c["name"].lower()}" {pg_type(c)}' for c in measures]
    fact_columns += [f'{dim}_id text NOT NULL REFERENCES dw.dim_{dim}(id)' for dim in dimensions]
    migrate_columns('fato_'+area,measures)
    dw.append(f'CREATE TABLE IF NOT EXISTS dw.fato_{area} (registro_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, '+', '.join(fact_columns)+');')
    for column in measures:
        if pg_type(column)=='timestamp':dw.append(timestamp_migration('dw','fato_'+area,column['name'].lower(),'pedidos_'+area))
    keys = []
    for dim, columns in dimensions.items():
        expressions = [f'"{c}"' if c in available else f'NULL::{types[c]}' for c in columns]
        keys.append(f'md5(jsonb_build_array({", ".join(expressions)})::text)')
    names = [f'"{c["name"].lower()}"' for c in measures]
    publish.append(f'INSERT INTO dw.fato_{area} ('+', '.join(names+[d+'_id' for d in dimensions])+') SELECT '+', '.join(names+keys)+f' FROM dw.carga_{area};')
    projections = ['f.registro_id']
    for c in schema[areas[area]]:
        col = c['name'].lower()
        owner = next((d for d,cols in dimensions.items() if col in cols), None)
        projections.append(f'{owner if owner else "f"}."{col}"')
    joins = ' '.join(f'JOIN dw.dim_{d} {d} ON {d}.id=f.{d}_id' for d in dimensions)
    dw.append(f'CREATE OR REPLACE VIEW dw.pedidos_{area} AS SELECT '+', '.join(projections)+f' FROM dw.fato_{area} f {joins};')
    date_col = 'dtemissao_docfat' if area=='faturados' else 'data_emissao_pedido'
    dw.append(f'CREATE INDEX IF NOT EXISTS idx_{area}_data ON dw.fato_{area}({date_col});')
    for dim in dimensions:
        dw.append(f'CREATE INDEX IF NOT EXISTS idx_{area}_{dim} ON dw.fato_{area}({dim}_id);')
for area in ['carteira','metas']:
    name = 'carteira_clientes' if area=='carteira' else 'metas_consultores'
    migrate_columns(name,schema[areas[area]])
    dw.append(f'CREATE TABLE IF NOT EXISTS dw.{name} (LIKE dw.carga_{area} INCLUDING ALL);')
    for column in schema[areas[area]]:
        if pg_type(column)=='timestamp':dw.append(timestamp_migration('dw',name,column['name'].lower()))
    names=', '.join(f'"{c["name"]}"' for c in schema[areas[area]])
    publish += [f'DELETE FROM dw.{name};', f'INSERT INTO dw.{name} ({names}) SELECT {names} FROM dw.carga_{area};']
counts = ', '.join(f"'{a}', (SELECT count(*) FROM dw.carga_{a})" for a in areas)
publish.append(f"UPDATE etl.execucao_carga SET status='publicado',fim=now(),contagens=jsonb_build_object({counts}) WHERE id='${{ETL_RUN_ID}}' AND status='executando';")
publish += ['COMMIT;']
dw.append('COMMIT;')
(etl/'sql/002_modelo_analitico.sql').write_text('\n\n'.join(dw)+'\n',encoding='utf-8')
(etl/'sql/003_publicacao.sql').write_text('\n\n'.join(publish)+'\n',encoding='utf-8')
validation = "DO $$ BEGIN\n" + '\n'.join(f"IF NOT EXISTS(SELECT 1 FROM dw.carga_{a}) THEN RAISE EXCEPTION 'Base {a} vazia: publicação interrompida'; END IF;" for a in areas) + '\nEND $$;'
(etl/'sql/004_validacao.sql').write_text(validation+'\n',encoding='utf-8')
(etl/'sql/005_preparacao.sql').write_text('\n'.join(prepare)+'\n',encoding='utf-8')
prepare_dw=['BEGIN;',"INSERT INTO etl.execucao_carga(id,status,origem) VALUES ('${ETL_RUN_ID}', 'executando', 'staging/apache-hop');"]
prepare_dw += [f'TRUNCATE dw.carga_{area};' for area in areas]
prepare_dw.append('COMMIT;')
(etl/'sql/010_preparacao_dw.sql').write_text('\n'.join(prepare_dw)+'\n',encoding='utf-8')
(etl/'sql/006_falha.sql').write_text("UPDATE etl.execucao_carga SET status='falhou',fim=now() WHERE id='${ETL_RUN_ID}' AND status='executando';\n",encoding='utf-8')

for name in ['DADOS','DW']:
    doc = json.loads((portal/f'metadata/rdbms/{name}.example.json').read_text())
    if name=='DADOS':
        config=doc['rdbms']['FIREBIRD']
        config.update(hostname='${DB_FIREBIRD_HOST}',port='${DB_FIREBIRD_PORT}',databaseName='${DB_FIREBIRD_DB}',manualUrl='${DB_FIREBIRD_URL}')
    (etl/f'metadata/rdbms/{name}.json').write_text(json.dumps(doc,indent=2),encoding='utf-8')
for kind in ['pipeline','workflow']:
    shutil.copyfile(portal/f'metadata/{kind}-run-configuration/local.json',etl/f'metadata/{kind}-run-configuration/local.json')
(etl/'project-config.json').write_text(json.dumps({'metadataBaseFolder':'${PROJECT_HOME}/metadata','enforcingExecutionInHome':True,'config':{'variables':[]}},indent=2),encoding='utf-8')

from build_pipelines import build
build(etl, portal, raw, schema, areas)
from organize_hop import generate
generate(etl,raw)
print(f'ETL: {len(raw)} espelhos brutos, 5 transformações, publicação estrela e 5 workflows gerados.')

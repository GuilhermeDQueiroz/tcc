"""Validate lineage and native file references without connecting to databases."""
import json
import ast
import re
import xml.etree.ElementTree as ET
from source_contract import ROOT,QUERY_NAMES,raw_columns,queries,to_postgres
from dw_contract import transformation_sql

etl=ROOT/'etl'
inventory=json.loads((etl/'inventario-fontes.json').read_text(encoding='utf-8'))
ddl=(etl/'sql/001_staging.sql').read_text(encoding='utf-8')
source_metadata=json.loads((etl/'sql/fontes/raw-source-schema.json').read_text(encoding='utf-8'))
for table,document in source_metadata.items():
    for column in document['columns']:
        if 'datetime.datetime' in column['type']:
            assert f'"{column["name"].lower()}" timestamp' in ddl,column['name']
assert {item['source'] for item in inventory}==set(raw_columns()),'Tabelas de origem ausentes'
assert {item['source'] for item in inventory if not item['existedInPortal']}=={'METAS_VENDAS','PESSOA_CONSULTORVENDAS'}
for item in inventory:
    document=ET.parse(etl/item['pipeline']).getroot()
    inp=next(t for t in document.findall('transform') if t.findtext('type')=='TableInput')
    out=next(t for t in document.findall('transform') if t.findtext('type')=='TableOutput')
    assert inp.findtext('connection')=='DADOS'
    query=inp.findtext('sql').strip()
    assert re.fullmatch(r'SELECT [A-Z_0-9, ]+ FROM '+item['source'],query),query
    assert not re.search(r'\b(JOIN|DISTINCT|CASE|IIF|COALESCE|GROUP BY)\b',query,re.I)
    assert out.findtext('connection')=='DW' and out.findtext('schema')=='staging'
    assert out.findtext('table')==item['staging']
    assert out.findtext('ignore_errors')=='N'
    fields=out.findall('fields/field')
    assert {f.findtext('stream_name') for f in fields}==set(item['columns'])
source_queries=queries()
legacy_source=ROOT.parent/'legacy/scripts/extrator_firebird.py'
if legacy_source.is_file():
    for node in ast.parse(legacy_source.read_text(encoding='utf-8-sig')).body:
        if isinstance(node,ast.Assign):
            for target in node.targets:
                if isinstance(target,ast.Name) and target.id in source_queries:
                    assert ast.literal_eval(node.value).strip()==source_queries[target.id],'Consulta original alterada: '+target.id
for area,name in QUERY_NAMES.items():
    stem='carteira_clientes' if area=='carteira' else 'metas_consultores' if area=='metas' else 'pedidos_'+area
    document=ET.parse(etl/f'pipelines/transformacao-carregamento/load_{stem}.hpl').getroot()
    inp=next(t for t in document.findall('transform') if t.findtext('type')=='TableInput')
    out=next(t for t in document.findall('transform') if t.findtext('type')=='TableOutput')
    assert inp.findtext('connection')=='DW'
    assert inp.findtext('sql').strip()==transformation_sql(area).strip()
    assert inp.findtext('sql').strip()==(etl/f'sql/transformacoes/{area}.sql').read_text(encoding='utf-8').strip()
    assert out.findtext('connection')=='DW' and out.findtext('schema')=='dw'
    assert out.findtext('table')=='carga_'+area
    assert out.findtext('ignore_errors')=='N'
publication=(etl/'sql/003_publicacao.sql').read_text(encoding='utf-8')
assert 'FROM staging.' not in publication
for area in QUERY_NAMES:assert 'FROM dw.carga_'+area in publication
for path in (etl/'workflows').glob('*.hwf'):
    document=ET.parse(path).getroot()
    for action in document.findall('actions/action'):
        for tag in ['filename','sqlfilename']:
            ref=action.findtext(tag)
            if ref:assert (etl/ref.replace('${PROJECT_HOME}/','')).is_file(),ref
        if action.findtext('type') in ['PIPELINE','SQL','WORKFLOW','EVAL'] and action.findtext('name')!='Registrar falha':
            assert any(h.findtext('from')==action.findtext('name') and h.findtext('evaluation')=='N' for h in document.findall('hops/hop')),action.findtext('name')
pipeline=ET.parse(etl/'pipelines/transformacao-carregamento/load_modelo_analitico.hpl').getroot()
assert pipeline.findtext('transform/sql').strip()==publication.strip()
assert pipeline.findtext('transform/single_statement')=='Y'
for name in ['DADOS','DW']:
    data=json.loads((etl/f'metadata/rdbms/{name}.json').read_text(encoding='utf-8'))
    config=next(iter(data['rdbms'].values()))
    for key in ['hostname','databaseName','port','username','password']:assert config[key].startswith('${')
print('32 fontes brutas, 2 fontes acrescentadas, 5 transformações PostgreSQL e publicação atômica válidas.')

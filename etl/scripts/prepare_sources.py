"""Read SQL and result metadata only. Data extraction belongs to Apache Hop."""
import ast
import json
import os
from pathlib import Path
import fdb

root = Path(__file__).resolve().parents[2]
source = root.parent / 'legacy/scripts/extrator_firebird.py'
queries = {}
for node in ast.parse(source.read_text(encoding='utf-8-sig')).body:
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id.startswith('QUERY_'):
                queries[target.id] = ast.literal_eval(node.value).strip()

connection = fdb.connect(host=os.environ['FIREBIRD_HOST'], port=int(os.environ['FIREBIRD_PORT']),
    database=os.environ['FIREBIRD_DATABASE'], user=os.environ['FIREBIRD_USER'],
    password=os.environ['FIREBIRD_PASSWORD'], charset='ISO8859_1')
tpb = fdb.TPB()
tpb.access_mode = fdb.isc_tpb_read
tpb.lock_resolution = fdb.isc_tpb_nowait
connection.begin(tpb=tpb.render())
descriptions = {}
try:
    for name, query in queries.items():
        cursor = connection.cursor()
        prepared = cursor.prep(query)
        descriptions[name] = [dict(name=x[0], type=str(x[1]), length=x[3], precision=x[4], scale=x[5], nullable=x[6]) for x in prepared.description]
        cursor.close()
        print(name, len(descriptions[name]), 'colunas verificadas')
finally:
    connection.rollback()
    connection.close()
(root / '.local').mkdir(exist_ok=True)
(root / '.local/source-schema.json').write_text(json.dumps(descriptions, indent=2), encoding='utf-8')
(root / 'etl/sql/fontes').mkdir(parents=True, exist_ok=True)
for name, query in queries.items():
    (root / 'etl/sql/fontes' / f'{name}.sql').write_text(query + '\n', encoding='utf-8')

(root/'etl/sql/fontes/consolidated-source-schema.json').write_text(json.dumps(descriptions,indent=2),encoding='utf-8')

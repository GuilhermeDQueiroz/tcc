"""Inspect result metadata only; Apache Hop extracts the actual ERP records."""
import json
import os
import fdb
from source_contract import ROOT,raw_columns

connection=fdb.connect(host=os.environ['FIREBIRD_HOST'],port=int(os.environ['FIREBIRD_PORT']),
    database=os.environ['FIREBIRD_DATABASE'],user=os.environ['FIREBIRD_USER'],
    password=os.environ['FIREBIRD_PASSWORD'],charset='ISO8859_1')
tpb=fdb.TPB();tpb.access_mode=fdb.isc_tpb_read
connection.begin(tpb=tpb.render())
metadata={}
try:
    for table,columns in raw_columns().items():
        query='SELECT '+', '.join(columns)+' FROM '+table
        cursor=connection.cursor()
        prepared=cursor.prep(query)
        metadata[table]={'sql':query,'columns':[dict(name=x[0],type=str(x[1]),length=x[3],precision=x[4],scale=x[5],nullable=x[6]) for x in prepared.description]}
        cursor.close()
        print(table,len(columns),'colunas originais verificadas',flush=True)
finally:
    connection.rollback();connection.close()
(ROOT/'.local/raw-source-schema.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')

(ROOT/'etl/sql/fontes/raw-source-schema.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')

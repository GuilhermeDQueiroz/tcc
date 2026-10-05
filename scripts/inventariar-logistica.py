"""Inspect a local Firebird copy in a read-only transaction; no ETL extraction."""
import argparse
import datetime
import json
import os
from pathlib import Path
import sys

import fdb

ROOT = Path(__file__).resolve().parents[1]
TABLES = {
    'CARGA', 'CARGA_DOCUMENTOS', 'CARGA_ITENS', 'DOCUMENTO_FATURA',
    'DOCUMENTO_PEDIDO', 'DOCUMENTO_ITEM', 'DOCUMENTO_ITEM_DETALHE',
    'DOCUMENTO_ENTREGA', 'NOTA_FISCAL_DOCUMENTOS',
    'ITEM', 'ITEM_DETALHE', 'PESSOA', 'PESSOA_ENDERECO', 'CIDADE', 'UF', 'STATUS',
}


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--host', default='localhost', choices=['localhost', '127.0.0.1'])
    parser.add_argument('--port', type=int, default=3050)
    parser.add_argument('--client', default=r'C:\Program Files\Firebird\Firebird_5_0\fbclient.dll')
    args = parser.parse_args()
    for key in ['FIREBIRD_USER', 'FIREBIRD_PASSWORD']:
        if not os.environ.get(key):
            raise SystemExit('Credenciais devem ser fornecidas no ambiente: ' + key)
    fdb.load_api(args.client)
    connection = fdb.connect(host=args.host, port=args.port, database=args.database,
                             user=os.environ['FIREBIRD_USER'], password=os.environ['FIREBIRD_PASSWORD'],
                             charset='ISO8859_1')
    transaction = fdb.TPB()
    transaction.access_mode = fdb.isc_tpb_read
    transaction.isolation_level = fdb.isc_tpb_concurrency
    connection.begin(tpb=transaction.render())
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT TRIM(RDB$RELATION_NAME) FROM RDB$RELATIONS WHERE COALESCE(RDB$SYSTEM_FLAG,0)=0 AND RDB$VIEW_BLR IS NULL ORDER BY 1")
        relations = [row[0] for row in cursor.fetchall()]
        selected = [name for name in relations if name in TABLES or any(part in name for part in ['ENTREGA', 'RECOLH', 'CONFER', 'COLETA'])]
        result = {'source': 'local-firebird-copy', 'databaseFile': str(Path(args.database).resolve()),
                  'inspectedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'engineVersion': connection.version, 'readOnly': True, 'relations': relations, 'tables': {}}
        for table in selected:
            cursor.execute("""SELECT TRIM(rf.RDB$FIELD_NAME), f.RDB$FIELD_TYPE, f.RDB$FIELD_SUB_TYPE,
                f.RDB$FIELD_LENGTH, f.RDB$FIELD_SCALE, f.RDB$FIELD_PRECISION,
                COALESCE(rf.RDB$NULL_FLAG, f.RDB$NULL_FLAG, 0), rf.RDB$DESCRIPTION
                FROM RDB$RELATION_FIELDS rf JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME=rf.RDB$FIELD_SOURCE
                WHERE rf.RDB$RELATION_NAME=? ORDER BY rf.RDB$FIELD_POSITION""", (table,))
            fields = [dict(zip(['name', 'typeCode', 'subtype', 'length', 'scale', 'precision', 'notNull', 'description'], row)) for row in cursor.fetchall()]
            cursor.execute("""SELECT TRIM(c.RDB$CONSTRAINT_NAME), TRIM(c.RDB$CONSTRAINT_TYPE),
                TRIM(s.RDB$FIELD_NAME), s.RDB$FIELD_POSITION
                FROM RDB$RELATION_CONSTRAINTS c JOIN RDB$INDEX_SEGMENTS s ON s.RDB$INDEX_NAME=c.RDB$INDEX_NAME
                WHERE c.RDB$RELATION_NAME=? ORDER BY c.RDB$CONSTRAINT_NAME, s.RDB$FIELD_POSITION""", (table,))
            constraints = [dict(zip(['name', 'type', 'field', 'position'], row)) for row in cursor.fetchall()]
            result['tables'][table] = {'fields': fields, 'constraints': constraints}
            print(table + ': ' + str(len(fields)) + ' campos; ' + str(len(constraints)) + ' segmentos de chave')
        output = ROOT / '.local' / 'logistica-origem-schema.json'
        output.parent.mkdir(exist_ok=True)
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        print('Inventário salvo: ' + str(output))
    finally:
        connection.rollback()
        connection.close()


if __name__ == '__main__':
    main()

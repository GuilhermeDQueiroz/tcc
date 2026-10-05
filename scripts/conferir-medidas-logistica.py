"""Read-only independent aggregate evidence for cubage, gross weight and money."""
import datetime
import json
import os
from pathlib import Path
import sys
import fdb

ROOT=Path(__file__).resolve().parents[1]
def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if os.environ.get('FIREBIRD_HOST') not in ['localhost','127.0.0.1']:raise SystemExit('Use a cópia local.')
    fdb.load_api(r'C:\Program Files\Firebird\Firebird_5_0\fbclient.dll')
    connection=fdb.connect(host='localhost',port=3050,database=os.environ['FIREBIRD_DATABASE'],user=os.environ['FIREBIRD_USER'],password=os.environ['FIREBIRD_PASSWORD'],charset='ISO8859_1')
    tpb=fdb.TPB();tpb.access_mode=fdb.isc_tpb_read;tpb.isolation_level=fdb.isc_tpb_concurrency;connection.begin(tpb=tpb.render())
    try:
        cursor=connection.cursor()
        cursor.execute("""WITH measures AS (
          SELECT i.QTDEABERTA_DOCITEMDET AS QOPEN,COALESCE(i.QTDECARGA_DOCITEMDET,0)-COALESCE(i.QTDECARGAFAT_DOCITEMDET,0) AS QLOAD,
            TRUNC(i.VLRBRUTOLIQUIDO_DOCITEMDET/NULLIF(i.QTDECHAPAS_DOCITEMDET,0),6) AS PRICE,
            CASE WHEN v.PESOBRUTO_ITEM_DETALHE>0 THEN v.PESOBRUTO_ITEM_DETALHE WHEN m.PESOBRUTO_ITEM>0 THEN m.PESOBRUTO_ITEM ELSE NULL END AS KG,
            CASE WHEN v.VOLUMEM3_ITEM_DETALHE>0 THEN v.VOLUMEM3_ITEM_DETALHE WHEN m.VOLUMEM3_ITEM>0 AND m.VOLUMEM3_ITEM<10 THEN m.VOLUMEM3_ITEM ELSE NULL END AS M3,
            p.DTPREVISAOFATURAMENTO_DOCPED AS FORECAST
          FROM DOCUMENTO_FATURA d JOIN DOCUMENTO_ITEM di ON di.DOCUMENTO_DOCITEM=d.CODIGO_DOCFAT
          JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINCITEM_DOCITEMDET=di.AUTOINC_DOCITEM
          LEFT JOIN ITEM m ON m.CODIGO_ITEM=i.ITEM_DOCITEMDET
          LEFT JOIN ITEM_DETALHE v ON v.AUTOINC_ITEM_DETALHE=i.AUTOINCITEMDETALHE_DOCITEMDET
          LEFT JOIN DOCUMENTO_PEDIDO p ON p.DOCUMENTO_DOCPED=d.CODIGO_DOCFAT
          WHERE d.DTEMISSAO_DOCFAT>='2026-01-01' AND d.DTEMISSAO_DOCFAT<'2026-10-01'
          AND d.TIPO_DOCFAT=1 AND d.OPCAO_DOCFAT=1 AND d.ENTREGA_DOCFAT='N'
          AND di.AUTOINC_DOCITEM=di.COMPOSICAOITEM_DOCITEM AND di.TIPO_DOCITEM IN (1,4) AND i.QTDEABERTA_DOCITEMDET>0)
          SELECT COUNT(*) AS ITEMS,SUM(QOPEN*KG) AS WEIGHT_OPEN,SUM(QLOAD*KG) AS WEIGHT_LOAD,SUM((QOPEN-QLOAD)*KG) AS WEIGHT_FREE,
            SUM(QOPEN*M3) AS CUBE_OPEN,SUM(QLOAD*M3) AS CUBE_LOAD,SUM((QOPEN-QLOAD)*M3) AS CUBE_FREE,
            SUM(QLOAD*PRICE) AS VALUE_LOAD,SUM((QOPEN-QLOAD)*PRICE) AS VALUE_FREE,
            SUM(CASE WHEN M3 IS NULL THEN 1 ELSE 0 END) AS MISSING_CUBE,
            SUM(CASE WHEN KG IS NULL THEN 1 ELSE 0 END) AS MISSING_WEIGHT,
            SUM(CASE WHEN FORECAST IS NULL THEN 1 ELSE 0 END) AS MISSING_FORECAST
          FROM measures""")
        result=dict(zip([column[0] for column in cursor.description],cursor.fetchone()))
        report={'source':'read-only-real-firebird-aggregate','startDate':'2026-01-01','referenceDate':'2026-09-30','inspectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'measures':result}
        (ROOT/'.local/logistica-medidas-origem.json').write_text(json.dumps(report,indent=2,default=str,ensure_ascii=False),encoding='utf-8')
        print(json.dumps(report,default=str,ensure_ascii=False))
    finally:connection.rollback();connection.close()
if __name__=='__main__':main()

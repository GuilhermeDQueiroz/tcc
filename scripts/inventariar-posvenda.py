"""Read-only metadata and aggregates from the anonymized TCC Firebird copy."""
import datetime,json,os,sys
from pathlib import Path
import fdb

sys.stdout.reconfigure(encoding='utf-8',errors='replace')
root=Path(__file__).resolve().parents[1]
source=Path(r'C:\Users\desenvolvimento\Downloads\DADOSMC\DADOS.FDB')
fdb.load_api(r'C:\Program Files\Firebird\Firebird_5_0\fbclient.dll')
con=fdb.connect(host='localhost',port=3050,database=str(source),user=os.environ['FIREBIRD_USER'],password=os.environ['FIREBIRD_PASSWORD'],charset='ISO8859_1',isolation_level=fdb.ISOLATION_LEVEL_READ_COMMITED_RO)
report={'readOnly':True,'inspectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':str(source),'schema':{}}
def query(sql,params=()):
    cur=con.cursor();cur.execute(sql,params)
    return [dict(zip([c[0].lower() for c in cur.description],row)) for row in cur.fetchall()]
def save():
    (root/'.local/posvenda-inventario.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
try:
    actual=query('SELECT MON$DATABASE_NAME AS NAME FROM MON$DATABASE')[0]['name']
    if os.path.normcase(actual)!=os.path.normcase(str(source)):raise RuntimeError('Unexpected database')
    tables=query("SELECT TRIM(RDB$RELATION_NAME) AS NAME FROM RDB$RELATIONS WHERE COALESCE(RDB$SYSTEM_FLAG,0)=0 ORDER BY 1")
    selected=[r['name'] for r in tables if any(s in r['name'] for s in ['ASSIST','DEVOL','DEVCAN','DOCENTDEV','CANCEL','RECOLH','MOTIVO']) or r['name'] in ['DOCUMENTO_FATURA','DOCUMENTO_ITEM','DOCUMENTO_ITEM_DETALHE','DOCUMENTO_ENTREGA','DOCUMENTO_PEDIDO','TRANSACAO','ORIGEM','ORGAO','STATUS','NOTA_FISCAL_DOCUMENTOS']]
    for table in selected:
        report['schema'][table]=query('''SELECT TRIM(rf.RDB$FIELD_NAME) AS NAME,TRIM(rf.RDB$FIELD_SOURCE) AS DOMAIN,rf.RDB$DESCRIPTION AS DESCRIPTION,f.RDB$DESCRIPTION AS DOMAIN_DESCRIPTION,f.RDB$FIELD_TYPE AS TYPE_CODE,f.RDB$FIELD_SUB_TYPE AS SUBTYPE,f.RDB$FIELD_SCALE AS SCALE,f.RDB$FIELD_PRECISION AS NUM_PRECISION FROM RDB$RELATION_FIELDS rf JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME=rf.RDB$FIELD_SOURCE WHERE rf.RDB$RELATION_NAME=? ORDER BY rf.RDB$FIELD_POSITION''',(table,))
    save();print('Metadata:',', '.join(selected),flush=True)
    report['types']=query("SELECT TIPO_DOCFAT,OPCAO_DOCFAT,ENTREGA_DOCFAT,COUNT(*) AS DOCUMENTS,MIN(DTEMISSAO_DOCFAT) AS FIRST_DATE,MAX(DTEMISSAO_DOCFAT) AS LAST_DATE FROM DOCUMENTO_FATURA WHERE DTEMISSAO_DOCFAT>='2025-01-01' GROUP BY 1,2,3 ORDER BY 1,2,3")
    save();print(json.dumps(report['types'],default=str),flush=True)
    report['documentStatus']=query("SELECT d.TIPO_DOCFAT,d.OPCAO_DOCFAT,s.DESCRICAO_STATUS,COUNT(*) AS DOCUMENTS FROM DOCUMENTO_FATURA d LEFT JOIN STATUS s ON s.CODIGO_STATUS=d.STATUS_DOCFAT WHERE d.DTEMISSAO_DOCFAT>='2025-01-01' GROUP BY 1,2,3 ORDER BY 1,2,4 DESC")
    report['orgao']=query("SELECT d.TIPO_DOCFAT,d.OPCAO_DOCFAT,o.DESCRICAO_ORGAO,COUNT(*) AS DOCUMENTS FROM DOCUMENTO_FATURA d LEFT JOIN ORGAO o ON o.CODIGO_ORGAO=d.ORGAO_DOCFAT WHERE d.DTEMISSAO_DOCFAT>='2025-01-01' GROUP BY 1,2,3 ORDER BY 1,2,4 DESC")
    report['cancellations']=query("SELECT d.TIPO_DOCFAT,d.OPCAO_DOCFAT,COUNT(DISTINCT d.CODIGO_DOCFAT) AS DOCUMENTS,COUNT(*) AS ITEMS,SUM(i.QTDECANCELADO_DOCITEMDET) AS QUANTITY,SUM(i.QTDEABERTA_DOCITEMDET) AS OPEN_QUANTITY FROM DOCUMENTO_FATURA d JOIN DOCUMENTO_ITEM di ON di.DOCUMENTO_DOCITEM=d.CODIGO_DOCFAT JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINCITEM_DOCITEMDET=di.AUTOINC_DOCITEM WHERE d.DTEMISSAO_DOCFAT>='2025-01-01' AND di.AUTOINC_DOCITEM=di.COMPOSICAOITEM_DOCITEM AND di.TIPO_DOCITEM IN (1,4) AND i.QTDECANCELADO_DOCITEMDET>0 GROUP BY 1,2 ORDER BY 1,2")
    report['eventLinks']=query("SELECT e.TIPO_DOCFAT,e.OPCAO_DOCFAT,o.TIPO_DOCFAT AS ORIGINAL_TYPE,o.OPCAO_DOCFAT AS ORIGINAL_OPTION,o.ENTREGA_DOCFAT AS ORIGINAL_DELIVERY,COUNT(*) AS RECORDS,SUM(v.QUANTIDADE_DOCDEV) AS QUANTITY FROM DOCUMENTO_DEVOLUCAOCANCELA v JOIN DOCUMENTO_FATURA e ON e.CODIGO_DOCFAT=v.DOCUMENTO_DOCDEV LEFT JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINC_DOCITEMDET=v.AUTOINCITEMDETDOC_DOCDEV LEFT JOIN DOCUMENTO_ITEM di ON di.AUTOINC_DOCITEM=i.AUTOINCITEM_DOCITEMDET LEFT JOIN DOCUMENTO_FATURA o ON o.CODIGO_DOCFAT=di.DOCUMENTO_DOCITEM WHERE e.DTEMISSAO_DOCFAT>='2025-01-01' AND e.DTEMISSAO_DOCFAT<'2026-10-01' GROUP BY 1,2,3,4,5 ORDER BY 1,2,3,4,5")
    save();print('Aggregate inventory completed',flush=True);print(json.dumps(report['eventLinks'],default=str),flush=True)
finally:con.rollback();con.close()

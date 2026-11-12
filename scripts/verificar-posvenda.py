"""Read-only Firebird -> published PostgreSQL -> API reconciliation."""
import datetime,json,os,sys,urllib.parse,urllib.request
from decimal import Decimal
from pathlib import Path
import fdb,psycopg2

sys.stdout.reconfigure(encoding='utf-8',errors='replace')
root=Path(__file__).resolve().parents[1]
publication=json.loads((root/'.local/posvenda-publicacao.json').read_text(encoding='utf-8'))
source=Path(publication['sourceFile']).resolve(strict=True)
expected=Path(r'C:\Users\desenvolvimento\Downloads\DADOSMC\DADOS.FDB').resolve(strict=True)
if source!=expected:raise SystemExit('A validação exige a cópia anonimizada do TCC.')
fb=fdb.connect(host=os.environ.get('FIREBIRD_HOST','localhost'),port=int(os.environ.get('FIREBIRD_PORT','3050')),database=str(source),user=os.environ['FIREBIRD_USER'],password=os.environ['FIREBIRD_PASSWORD'],charset='ISO8859_1',isolation_level=fdb.ISOLATION_LEVEL_READ_COMMITED_RO)
pg=psycopg2.connect(host='127.0.0.1',port=5434,dbname='dados',user=os.environ['PG_USER'],password=os.environ['PG_PASSWORD'])
pg.set_session(readonly=True,isolation_level='REPEATABLE READ')
def aggregate(connection,sql,params):
 cur=connection.cursor();cur.execute(sql,params);return cur.fetchone()
def near(a,b):assert abs(Decimal(str(a or 0))-Decimal(str(b or 0)))<Decimal('0.01'),(a,b)
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'source':str(source),'runId':publication['runId'],'checks':[]}
try:
 assert os.path.normcase(aggregate(fb,'SELECT MON$DATABASE_NAME FROM MON$DATABASE',())[0])==os.path.normcase(str(expected))
 start,end=publication['startDate'],publication['referenceDate']
 joins='''FROM DOCUMENTO_FATURA d JOIN DOCUMENTO_ITEM di ON di.DOCUMENTO_DOCITEM=d.CODIGO_DOCFAT JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINCITEM_DOCITEMDET=di.AUTOINC_DOCITEM LEFT JOIN PESSOA c ON c.CODIGO_PESSOA=d.CLIENTE_DOCFAT'''
 common="d.ENTREGA_DOCFAT='N' AND d.DTEMISSAO_DOCFAT>=? AND d.DTEMISSAO_DOCFAT<DATEADD(1 DAY TO CAST(? AS DATE)) AND di.AUTOINC_DOCITEM=di.COMPOSICAOITEM_DOCITEM AND di.TIPO_DOCITEM IN (1,4) AND (c.GRUPO_PESSOA<>1603 OR c.GRUPO_PESSOA IS NULL)"
 cases=[('assistencias','abertas','i.QTDEABERTA_DOCITEMDET','i.QTDEABERTA_DOCITEMDET*i.VLRBRUTOLIQUIDO_DOCITEMDET/NULLIF(i.QTDECHAPAS_DOCITEMDET,0)',common+" AND d.TIPO_DOCFAT=2 AND d.OPCAO_DOCFAT=1 AND i.QTDEABERTA_DOCITEMDET>0"),('assistencias','emitidas','i.QTDECHAPAS_DOCITEMDET','i.VLRBRUTOLIQUIDO_DOCITEMDET',common+" AND d.TIPO_DOCFAT=2 AND d.OPCAO_DOCFAT=1"),('assistencias','faturadas','i.QTDEFATURADO_DOCITEMDET','i.QTDEFATURADO_DOCITEMDET*i.VLRBRUTOLIQUIDO_DOCITEMDET/NULLIF(i.QTDECHAPAS_DOCITEMDET,0)',common+" AND d.TIPO_DOCFAT=2 AND d.OPCAO_DOCFAT=1 AND i.QTDEFATURADO_DOCITEMDET>0")]
 for area,view,quantity,value,where in cases:
  origin=aggregate(fb,f'SELECT COUNT(*),COUNT(DISTINCT d.CODIGO_DOCFAT),SUM({quantity}),SUM({value}) '+joins+' WHERE '+where,(start,end))
  target_quantity={'abertas':'quantidade_aberta','emitidas':'quantidade','faturadas':'quantidade_faturada'}[view]
  target_value={'abertas':'valor_aberto','emitidas':'valor','faturadas':'quantidade_faturada*valor_unitario'}[view]
  target=aggregate(pg,f'SELECT count(*),count(DISTINCT documento_id),sum({target_quantity}),sum({target_value}) FROM posvenda.registro WHERE execucao_id=%s AND categoria=%s'+(' AND quantidade_aberta>0' if view=='abertas' else ' AND quantidade_faturada>0' if view=='faturadas' else ''),(publication['runId'],area))
  assert origin[:2]==target[:2],(area,origin,target)
  near(origin[2],target[2]);near(origin[3],target[3])
  url='http://127.0.0.1:3002/api/v1/posvenda/'+area+('?view='+view if view else '')
  with urllib.request.urlopen(url,timeout=90) as response:data=json.load(response)
  assert data['dataVersion'].split(':')[0]==publication['runId'];assert data['total']==origin[0]
  metrics={m['id']:m['value'] for m in data['metrics']}
  assert metrics['posvenda.documents']==origin[1];near(metrics['posvenda.quantity'],origin[2]);near(metrics['posvenda.value'],origin[3])
  report['checks'].append({'area':area,'view':view,'rows':origin[0],'documents':origin[1],'quantity':str(origin[2]),'value':str(origin[3])})
 origin=aggregate(fb,'''SELECT COUNT(*),COUNT(DISTINCT e.CODIGO_DOCFAT),COUNT(DISTINCT d.CODIGO_DOCFAT),SUM(v.QUANTIDADE_DOCDEV),SUM(v.QUANTIDADE_DOCDEV*i.VLRBRUTOLIQUIDO_DOCITEMDET/NULLIF(i.QTDECHAPAS_DOCITEMDET,0))
 FROM DOCUMENTO_DEVOLUCAOCANCELA v JOIN DOCUMENTO_FATURA e ON e.CODIGO_DOCFAT=v.DOCUMENTO_DOCDEV
 JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINC_DOCITEMDET=v.AUTOINCITEMDETDOC_DOCDEV
 JOIN DOCUMENTO_ITEM di ON di.AUTOINC_DOCITEM=i.AUTOINCITEM_DOCITEMDET
 JOIN DOCUMENTO_FATURA d ON d.CODIGO_DOCFAT=di.DOCUMENTO_DOCITEM LEFT JOIN PESSOA c ON c.CODIGO_PESSOA=d.CLIENTE_DOCFAT
 WHERE e.TIPO_DOCFAT IN (1,2) AND e.OPCAO_DOCFAT=2 AND e.ENTREGA_DOCFAT='N' AND d.TIPO_DOCFAT=e.TIPO_DOCFAT AND d.OPCAO_DOCFAT=1 AND d.ENTREGA_DOCFAT='N'
 AND e.DTEMISSAO_DOCFAT>=? AND e.DTEMISSAO_DOCFAT<DATEADD(1 DAY TO CAST(? AS DATE))
 AND di.AUTOINC_DOCITEM=di.COMPOSICAOITEM_DOCITEM AND di.TIPO_DOCITEM IN (1,4) AND v.QUANTIDADE_DOCDEV>0 AND (c.GRUPO_PESSOA<>1603 OR c.GRUPO_PESSOA IS NULL)''',(start,end))
 target=aggregate(pg,"SELECT count(*),count(DISTINCT documento_id),count(DISTINCT pedido_id),sum(quantidade),sum(valor) FROM posvenda.registro WHERE execucao_id=%s AND categoria='cancelamentos'",(publication['runId'],))
 assert origin[:3]==target[:3],(origin,target);near(origin[3],target[3]);near(origin[4],target[4])
 with urllib.request.urlopen('http://127.0.0.1:3002/api/v1/posvenda/cancelamentos',timeout=90) as response:data=json.load(response)
 metrics={m['id']:m['value'] for m in data['metrics']}
 order_card=next(m for m in data['metrics'] if m['id']=='posvenda.orders')
 assert data['total']==origin[0];assert order_card['supplementary'][0]['value']==origin[1];assert metrics['posvenda.orders']==origin[2]
 near(metrics['posvenda.quantity'],origin[3]);near(metrics['posvenda.value'],origin[4])
 report['checks'].append({'area':'cancelamentos','rows':origin[0],'documents':origin[1],'orders':origin[2],'quantity':str(origin[3]),'value':str(origin[4])})
 for kind in ('Venda','Assistência'):
  scoped=aggregate(pg,"SELECT count(*),count(DISTINCT documento_id),count(DISTINCT pedido_id),sum(quantidade),sum(valor) FROM posvenda.registro WHERE execucao_id=%s AND categoria='cancelamentos' AND modalidade=%s",(publication['runId'],kind))
  with urllib.request.urlopen('http://127.0.0.1:3002/api/v1/posvenda/cancelamentos?kind='+urllib.parse.quote(kind),timeout=90) as response:data=json.load(response)
  cards={m['id']:m for m in data['metrics']}
  assert data['total']==scoped[0] and cards['posvenda.orders']['supplementary'][0]['value']==scoped[1] and cards['posvenda.orders']['value']==scoped[2]
  near(cards['posvenda.quantity']['value'],scoped[3]);near(cards['posvenda.value']['value'],scoped[4])
  report['checks'].append({'area':'cancelamentos','kind':kind,'rows':scoped[0],'documents':scoped[1],'origins':scoped[2],'quantity':str(scoped[3]),'value':str(scoped[4])})
 origin=aggregate(fb,'''SELECT COUNT(*),COUNT(DISTINCT d.CODIGO_DOCFAT),SUM(v.QTDECHAPAS_DOCENTDEV),SUM(v.QTDECHAPAS_DOCENTDEV*i.VLRBRUTOLIQUIDO_DOCITEMDET/NULLIF(i.QTDECHAPAS_DOCITEMDET,0))
 FROM DOCUMENTO_FATURA d JOIN DOCUMENTO_ENTREGA_DEVCAN v ON v.DOCUMENTO_DOCENTDEV=d.CODIGO_DOCFAT
 JOIN DOCUMENTO_ENTREGA t ON t.AUTOINC_DOCENT=v.AUTOINCDOCENT_DOCENTDEV
 JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINC_DOCITEMDET=t.AUTOINCITEMDETDOC_DOCENT
 JOIN DOCUMENTO_ITEM di ON di.AUTOINC_DOCITEM=i.AUTOINCITEM_DOCITEMDET
 JOIN DOCUMENTO_FATURA o ON o.CODIGO_DOCFAT=di.DOCUMENTO_DOCITEM
 LEFT JOIN PESSOA c ON c.CODIGO_PESSOA=d.CLIENTE_DOCFAT
 WHERE d.TIPO_DOCFAT IN (1,2) AND d.OPCAO_DOCFAT=4 AND d.ENTREGA_DOCFAT='N'
 AND v.OPCAODOCUMENTO_DOCENTDEV=4 AND t.TIPO_DOCENT=1 AND v.QTDECHAPAS_DOCENTDEV>0
 AND d.DTEMISSAO_DOCFAT>=? AND d.DTEMISSAO_DOCFAT<DATEADD(1 DAY TO CAST(? AS DATE))
 AND di.AUTOINC_DOCITEM=di.COMPOSICAOITEM_DOCITEM AND di.TIPO_DOCITEM IN (1,4) AND (c.GRUPO_PESSOA<>1603 OR c.GRUPO_PESSOA IS NULL)''',(start,end))
 target=aggregate(pg,"SELECT count(*),count(DISTINCT documento_id),sum(quantidade),sum(valor) FROM posvenda.registro WHERE execucao_id=%s AND categoria='devolucoes'",(publication['runId'],))
 assert origin[:2]==target[:2],('devolucoes',origin,target);near(origin[2],target[2]);near(origin[3],target[3])
 with urllib.request.urlopen('http://127.0.0.1:3002/api/v1/posvenda/devolucoes',timeout=90) as response:data=json.load(response)
 metrics={m['id']:m['value'] for m in data['metrics']}
 order_card=next(m for m in data['metrics'] if m['id']=='posvenda.orders')
 assert data['total']==origin[0];assert order_card['supplementary'][0]['value']==origin[1];near(metrics['posvenda.quantity'],origin[2]);near(metrics['posvenda.value'],origin[3])
 report['checks'].append({'area':'devolucoes','rows':origin[0],'documents':origin[1],'quantity':str(origin[2]),'value':str(origin[3])})
 analysis_checks=[]
 for area,view in [('assistencias','abertas'),('assistencias','emitidas'),('assistencias','faturadas'),('cancelamentos',None),('devolucoes',None)]:
  suffix='?dimension=uf&granularity=week'+('&view='+view if view else '')
  with urllib.request.urlopen('http://127.0.0.1:3002/api/v1/posvenda/'+area+suffix,timeout=90) as response:data=json.load(response)
  q='quantidade_aberta' if view=='abertas' else 'quantidade_faturada' if view=='faturadas' else 'quantidade'
  v='valor_aberto' if view=='abertas' else 'quantidade_faturada*valor_unitario' if view=='faturadas' else 'valor'
  where='execucao_id=%s AND categoria=%s'+(' AND quantidade_aberta>0' if view=='abertas' else ' AND quantidade_faturada>0' if view=='faturadas' else '')
  with pg.cursor() as c:
   c.execute(f"SELECT COALESCE(NULLIF(btrim(uf),''),'Não informado'),count(DISTINCT documento_id),sum({q}),sum({v}) FROM posvenda.registro WHERE {where} GROUP BY 1",(publication['runId'],area))
   grouped=c.fetchall()
   actual={row['label']:row for row in data['analysis']['table']['rows']}
   assert len(grouped)==len(actual)
   for label,documents,quantity,value in grouped:
    assert actual[label]['documents']==documents;near(actual[label]['quantity'],quantity)
    if value is None:assert actual[label]['value'] is None
    else:near(actual[label]['value'],value)
   c.execute(f"SELECT date_trunc('week',data)::date::text,sum({q}) FROM posvenda.registro WHERE {where} GROUP BY 1",(publication['runId'],area))
   weeks=dict(c.fetchall())
   trend=data['series'][0]['rows']
   series_quantity='quantity' if view in ('abertas','faturadas') or area in ('cancelamentos','devolucoes') else 'value'
   for row in trend:near(row[series_quantity],weeks.get(row['period'],0))
   assert set(weeks).issubset({row['period'] for row in trend})
  analysis_checks.append({'area':area,'view':view,'dimensions':len(grouped),'weeklyPeriods':len(trend)})
 report['analysisChecks']=analysis_checks
 report['status']='passed'
 (root/'.local/posvenda-verificacao.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False,indent=2))
finally:fb.rollback();fb.close();pg.rollback();pg.close()

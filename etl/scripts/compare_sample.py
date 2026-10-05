"""Read-only comparison of real August data against the original extractor.

This is a verification oracle, never the production extraction path.
Private dataframes remain in .local; the shareable report contains no ERP rows.
"""
import argparse
import ast
from collections import Counter
import csv
import datetime as dt
from decimal import Decimal
import hashlib
import json
import io
import numbers
import os
from pathlib import Path
import sys
import warnings

import fdb
import pandas as pd
import psycopg2
from psycopg2 import sql
from source_contract import ROOT, QUERY_NAMES

VIEWS={'abertos':'pedidos_abertos','emitidos':'pedidos_emitidos',
       'faturados':'pedidos_faturados','carteira':'carteira_clientes','metas':'metas_consultores'}
KEYS={a:'CODIGO_PEDIDO' for a in ['abertos','emitidos','faturados']}
KEYS.update(carteira='CODIGO_PESSOA',metas='CODIGO_METASVEN')
GENERATED_META_DATES={'DATAHORAINCLUSAO_METASVEN','DATAHORAALTERACAO_METASVEN'}


def original_contract():
    source=ROOT.parent/'legacy/scripts/extrator_firebird.py'
    content=source.read_text(encoding='utf-8-sig')
    module=ast.parse(content)
    queries={}
    for node in module.body:
        if isinstance(node,ast.Assign):
            for target in node.targets:
                if isinstance(target,ast.Name) and target.id in QUERY_NAMES.values():
                    queries[target.id]=ast.literal_eval(node.value).strip()
    extraction=next(n for n in module.body if isinstance(n,ast.FunctionDef) and n.name=='extract_data')
    contracts={}
    for call in ast.walk(extraction):
        if isinstance(call,ast.Call) and isinstance(call.func,ast.Name) and call.func.id=='extract_query':
            name=call.args[1].id
            area=next(a for a,q in QUERY_NAMES.items() if q==name)
            contracts[area]={'table':ast.literal_eval(call.args[2]),
                             'dates':ast.literal_eval(call.args[3]),
                             'numbers':ast.literal_eval(call.args[4]) if len(call.args)>4 else {}}
    functions=[next(n for n in module.body if isinstance(n,ast.FunctionDef) and n.name==name) for name in ['get_pg_type','extract_query']]
    code=compile(ast.Module(body=functions,type_ignores=[]),str(source),'exec')
    return queries,contracts,code,hashlib.sha256(content.encode('utf-8')).hexdigest()


def processed_with_original(raw,contract,code):
    """Run the unmodified original function, intercepting only IO boundaries."""
    captured=[]
    class PandasOracle:
        def read_sql(self,query,connection):return raw.copy(deep=True)
        def __getattr__(self,name):return getattr(pd,name)
    namespace={'pd':PandasOracle(),'write_to_postgres':lambda frame,table:captured.append(frame)}
    exec(code,namespace)
    namespace['extract_query'](None,'',contract['table'],contract['dates'],contract['numbers'])
    assert len(captured)==1
    return captured[0]


def original_csv_values(frame,code):
    """Reproduce the original COPY payload, including float32 CSV formatting."""
    namespace={'pd':pd}
    exec(code,namespace)
    kinds={c:namespace['get_pg_type'](frame[c],c) for c in frame.columns}
    buffer=io.StringIO()
    frame.to_csv(buffer,sep='\t',header=False,index=False,na_rep='\\N')
    buffer.seek(0)
    rows=[]
    for row in csv.reader(buffer,delimiter='\t',quotechar='"'):
        values=[]
        for column,value in zip(frame.columns,row):
            kind=kinds[column]
            if value=='\\N':value=None
            elif kind=='BIGINT':value=int(value)
            elif kind=='DOUBLE PRECISION':value=float(value)
            elif kind=='TIMESTAMP':value=pd.Timestamp(value)
            elif kind=='BOOLEAN':value=value=='True'
            values.append(value)
        rows.append(values)
    return pd.DataFrame(rows,columns=frame.columns),kinds


def cast_dw_to_original_types(frame,kinds):
    """Compare values across compatible SQL types; retain every missing column."""
    result=frame.copy()
    for column in result.columns:
        kind=kinds[column]
        if kind=='TEXT':
            result[column]=result[column].map(lambda v:None if pd.isna(v) else str(v))
        elif kind=='TIMESTAMP':result[column]=pd.to_datetime(result[column])
        elif kind=='DOUBLE PRECISION':result[column]=pd.to_numeric(result[column]).astype('float64')
    return result


def right_trim_diagnostic(frame):
    result=frame.copy()
    for column in result.columns:
        if result[column].dtype==object or pd.api.types.is_string_dtype(result[column]):
            result[column]=result[column].map(lambda v:v.rstrip(' ') if isinstance(v,str) else v)
    return result


def canonical(value):
    if value is None or pd.isna(value):return ('null',)
    if hasattr(value,'item') and not isinstance(value,(dt.date,dt.datetime)):value=value.item()
    if isinstance(value,(dt.date,dt.datetime,pd.Timestamp)):
        return ('date',pd.Timestamp(value).isoformat())
    if isinstance(value,bool):return ('bool',value)
    if isinstance(value,numbers.Integral):return ('number',Decimal(int(value)))
    if isinstance(value,numbers.Real):return ('number',Decimal.from_float(float(value)))
    if isinstance(value,Decimal):return ('number',value)
    if isinstance(value,str):return ('text',value)
    raise TypeError('Tipo não contemplado na comparação: '+type(value).__name__)


def row_bag(frame,columns,mask_generated=False):
    positions={c:i for i,c in enumerate(frame.columns)}
    bag=Counter()
    for row in frame.itertuples(index=False,name=None):
        generated=(mask_generated and 'AUTOINC_METASVEN' in positions and row[positions['AUTOINC_METASVEN']]==0)
        bag[tuple(('runtime-current_timestamp',) if generated and c in GENERATED_META_DATES
                  else canonical(row[positions[c]]) for c in columns)]+=1
    return bag


def compare(reference,actual,mask_generated=False):
    columns=[c for c in reference.columns if c in actual.columns]
    left=row_bag(reference,columns,mask_generated)
    right=row_bag(actual,columns,mask_generated)
    missing=sum((left-right).values());extra=sum((right-left).values())
    differing=[]
    for column in columns:
        a=row_bag(reference,[column],mask_generated);b=row_bag(actual,[column],mask_generated)
        if a!=b:differing.append({'column':column,'referenceOnlyValues':sum((a-b).values()),'dwOnlyValues':sum((b-a).values())})
    absent=[c for c in reference.columns if c not in actual.columns]
    return {'equal':not missing and not extra and not absent,'comparedColumns':len(columns),
            'referenceOnlyRows':missing,'dwOnlyRows':extra,'missingColumns':absent,
            'differingColumnDistributions':differing}


def summary(raw,actual,contract,code):
    expected=processed_with_original(raw,contract,code)
    projected=processed_with_original(actual,contract,code)
    shared=[c for c in raw.columns if c in actual.columns]
    duplicate_count=lambda frame:len(frame)-len(row_bag(frame,list(frame.columns)))
    mask=contract['table']=='metas_consultores'
    csv_expected,kinds=original_csv_values(expected,code)
    csv_projected,_=original_csv_values(projected,code)
    legacy_actual=actual.copy()
    volumes=[source for source in contract['numbers'] if 'VOLUME_M3' in source]
    for source in volumes:
        treated=contract['numbers'][source]
        if treated in actual.columns:legacy_actual[source]=actual[treated]
    raw_volumes=compare(raw[volumes],actual[[c for c in volumes if c in actual.columns]])
    return {'firebirdRows':len(raw),'dwRows':len(actual),'comparisonPreservesDuplicates':True,
            'firebirdDuplicateRows':duplicate_count(raw),'dwDuplicateRows':duplicate_count(actual),
            'firebirdNullCells':int(raw.isna().sum().sum()),'dwNullCells':int(actual.isna().sum().sum()),
            'missingExtractorColumns':[c for c in expected.columns if c not in actual.columns],
            'rawSQL':compare(raw[shared],actual[shared]),
            'rawSQLIgnoringGeneratedMetaTimestamps':compare(raw[shared],actual[shared],mask),
            'diagnosticRawAfterRightTrimText':compare(right_trim_diagnostic(raw[shared]),right_trim_diagnostic(actual[shared]),mask),
            'extractorOutputVsActualDW':compare(expected,legacy_actual,mask),
            'extractorCsvOutputVsActualDW':compare(csv_expected,cast_dw_to_original_types(legacy_actual,kinds),mask),
            'preservedRawVolumes':raw_volumes,
            'diagnosticAfterApplyingOriginalFunctionToBoth':compare(expected,projected,mask),
            'diagnosticAfterOriginalFunctionAndCsvToBoth':compare(csv_expected,csv_projected,mask),
            'generatedMetaTimestampRows':int((raw['AUTOINC_METASVEN']==0).sum()) if mask else 0}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--year',type=int,default=2026)
    parser.add_argument('--month',type=int,default=8)
    parser.add_argument('--from-cache',action='store_true')
    args=parser.parse_args()
    start=dt.date(args.year,args.month,1)
    end=dt.date(args.year+1,1,1) if args.month==12 else dt.date(args.year,args.month+1,1)
    queries,contracts,code,source_hash=original_contract()
    cache=ROOT/f'.local/sample-{args.year}-{args.month:02d}'
    cache.mkdir(parents=True,exist_ok=True)
    context_file=cache/'context.json'
    if args.from_cache:
        context=json.loads(context_file.read_text(encoding='utf-8'))
        assert context['extractorSha256']==source_hash,'Extrator alterado após a captura.'
    else:
        if os.environ.get('PG_HOST','localhost') not in ['localhost','127.0.0.1','::1'] or os.environ.get('PG_PORT','5434')!='5434' or os.environ.get('PG_DATABASE','dados')!='dados':
            raise SystemExit('A comparação exige dados local na porta 5434.')
        pg=psycopg2.connect(host='localhost',port=5434,dbname='dados',user=os.environ['PG_USER'],password=os.environ['PG_PASSWORD'],connect_timeout=10)
        pg.set_session(isolation_level='REPEATABLE READ',readonly=True)
        fb=None
        try:
            fb=fdb.connect(host=os.environ.get('FIREBIRD_HOST','192.168.254.251'),port=int(os.environ.get('FIREBIRD_PORT','3056')),
                database=os.environ.get('FIREBIRD_DATABASE',r'C:\Tek-System\Dados\DADOSMC.FDB'),
                user=os.environ['FIREBIRD_USER'],password=os.environ['FIREBIRD_PASSWORD'],charset='ISO8859_1')
            tpb=fdb.TPB();tpb.access_mode=fdb.isc_tpb_read;tpb.isolation_level=fdb.isc_tpb_concurrency
            fb.begin(tpb=tpb.render())
            with pg.cursor() as cursor:
                cursor.execute("SELECT id::text,fim,current_date FROM etl.execucao_carga WHERE status='publicado' ORDER BY fim DESC LIMIT 1")
                run_id,published_at,pg_date=cursor.fetchone()
            cursor=fb.cursor();cursor.execute("SELECT CURRENT_DATE,RDB$GET_CONTEXT('SYSTEM','SNAPSHOT_NUMBER') FROM RDB$DATABASE")
            fb_date,fb_snapshot=cursor.fetchone();cursor.close()
            context={'runId':run_id,'controlTransactionTimestamp':published_at.isoformat(),'referenceCapturedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
                     'firebirdSnapshot':fb_snapshot,'firebirdCurrentDate':fb_date.isoformat(),'postgresCurrentDate':pg_date.isoformat(),
                     'extractorSha256':source_hash}
            clients=set()
            column_contract=json.loads((ROOT/'etl/contrato-colunas-dw.json').read_text(encoding='utf-8'))
            for area in QUERY_NAMES:
                print('Consultando amostra real de '+area+'...',flush=True)
                if area in ['abertos','emitidos','faturados']:
                    date_column='DT_FATURA' if area=='faturados' else 'DATA_EMISSAO_PEDIDO'
                    predicate=f'q.{date_column} >= ? AND q.{date_column} < ?'
                    target_date=next(c['name'] for c in column_contract['areas'][area]['columns'] if c['legacy']==date_column)
                    pg_predicate=f'{target_date} >= %s AND {target_date} < %s'
                    parameters=(start,end)
                elif area=='carteira':
                    assert clients,'Nenhum cliente encontrado no período.'
                    values=sorted(clients)
                    predicate='q.CODIGO_PESSOA IN ('+','.join('?' for _ in values)+')'
                    pg_predicate='codigo_pessoa IN ('+','.join('%s' for _ in values)+')'
                    parameters=tuple(values)
                else:
                    predicate='q.ANO_METASVEN = ?';pg_predicate='ano_metasven = %s';parameters=(args.year,)
                query='SELECT q.* FROM ('+queries[QUERY_NAMES[area]].rstrip(';')+') q WHERE '+predicate
                (cache/f'firebird-{area}.sql').write_text(query+'\n',encoding='utf-8')
                reference=pd.read_sql_query(query,fb,params=parameters,coerce_float=True)
                columns=[sql.SQL('{} AS {}').format(sql.Identifier(c['name']),sql.Identifier(c['legacy'].lower())) for c in column_contract['areas'][area]['columns']]
                pg_query=sql.SQL('SELECT {} FROM dw.{} WHERE '+pg_predicate).format(sql.SQL(',').join(columns),sql.Identifier(VIEWS[area])).as_string(pg)
                (cache/f'dw-{area}.sql').write_text(pg_query+'\n',encoding='utf-8')
                actual=pd.read_sql_query(pg_query,pg,params=parameters,coerce_float=True)
                actual.columns=actual.columns.str.upper()
                if area in ['abertos','emitidos','faturados']:
                    clients.update(int(v) for v in reference['CODIGO_CLIENTE'].dropna())
                    clients.update(int(v) for v in actual['CODIGO_CLIENTE'].dropna())
                reference.to_pickle(cache/f'firebird-{area}.pkl')
                actual.to_pickle(cache/f'dw-{area}.pkl')
                print(f'{area}: Firebird {len(reference)} linhas; DW {len(actual)} linhas.',flush=True)
            context_file.write_text(json.dumps(context,indent=2),encoding='utf-8')
        finally:
            if fb is not None:fb.rollback();fb.close()
            pg.rollback();pg.close()
    report={'mode':'sample','synthetic':False,'sameSourceSnapshot':False,'fullEquivalenceProven':False,
            'postgresPort':5434,'database':'dados','period':{'start':start.isoformat(),'endExclusive':end.isoformat()},
            'context':context,'areas':{},
            'limits':['Recorte temporal; não comprova a base inteira.',
                      'Firebird atual e DW publicado anteriormente; alterações no ERP podem causar diferenças.',
                      'Timestamps CURRENT_TIMESTAMP das metas sem cadastro são comparados estritamente e também isolados no diagnóstico.',
                      'Aplicar a função original aos dois lados é apenas diagnóstico, não processamento produtivo pelo Hop.']}
    for area in QUERY_NAMES:
        raw=pd.read_pickle(cache/f'firebird-{area}.pkl')
        actual=pd.read_pickle(cache/f'dw-{area}.pkl')
        result=summary(raw,actual,contracts[area],code)
        if area in ['abertos','emitidos']:
            columns=[c for c in raw.columns if c!='STATUS']
            result['diagnosticRawIgnoringStatusAndPadding']=compare(right_trim_diagnostic(raw[columns]),right_trim_diagnostic(actual[columns]))
        result['selectedKeys']=len(set(raw[KEYS[area]].dropna()).union(actual[KEYS[area]].dropna()))
        result['filterColumn']='DT_FATURA' if area=='faturados' else 'DATA_EMISSAO_PEDIDO' if area in ['abertos','emitidos'] else 'CODIGO_PESSOA (clientes do período)' if area=='carteira' else 'ANO_METASVEN'
        volume_column=next((c for c in raw.columns if c.startswith('VOLUME_M3')),None)
        result['volumeScaleCorrectionRows']=int((raw[volume_column]>1000).sum()) if volume_column else 0
        report['areas'][area]=result
        print(f"{area}: SQL {'igual' if result['rawSQL']['equal'] else 'divergente'}; colunas derivadas ausentes: {len(result['missingExtractorColumns'])}.",flush=True)
    (ROOT/'.local/extractor-sample.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Relatório agregado salvo em .local/extractor-sample.json; amostras privadas em '+str(cache),flush=True)


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8',errors='replace')
    warnings.filterwarnings('ignore',message='pandas only supports SQLAlchemy')
    main()

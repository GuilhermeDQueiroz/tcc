"""Read-only August oracle: real staging SQL → original extractor versus native DW."""
import argparse
import json
import os
import warnings
from decimal import Decimal
import pandas as pd
import psycopg2
from source_contract import ROOT, queries, to_postgres
from dw_contract import transformation_sql
from compare_sample import original_contract, processed_with_original, original_csv_values, compare, cast_dw_to_original_types

def verify(sql_only=False):
    contract=json.loads((ROOT/'etl/contrato-colunas-dw.json').read_text(encoding='utf-8'))
    _,rules,code,_=original_contract()
    connection=psycopg2.connect(host='localhost',port=5434,dbname='dados',user=os.environ['PG_USER'],password=os.environ['PG_PASSWORD'],connect_timeout=10)
    connection.set_session(readonly=True,isolation_level='REPEATABLE READ')
    report={'synthetic':False,'mode':'sample','period':'2026-08','reference':'existing real staging + unmodified original extract_query and CSV serialization', 'firebirdReextracted':False,'fullEquivalenceProven':False,'persistedDW':not sql_only,'areas':{},
            'limits':['Temporal sample, not full Firebird equivalence.','Generated metas CURRENT_TIMESTAMP fields are masked only in fallback rows AUTOINC_METASVEN=0.','No volume >1000 case occurs in this August sample; its scale branch is not exercised by real records.']}
    views={'abertos':'pedidos_abertos','emitidos':'pedidos_emitidos','faturados':'pedidos_faturados','carteira':'carteira_clientes','metas':'metas_consultores'}
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT CURRENT_DATE');report['calculationDate']=str(cursor.fetchone()[0])
            cursor.execute("SELECT id,origem FROM etl.execucao_carga WHERE status='publicado' ORDER BY inicio DESC LIMIT 1")
            row=cursor.fetchone();report.update(runId=str(row[0]),loadOrigin=row[1])
            clients=set()
            for area,document in contract['areas'].items():
                if area in ['abertos','emitidos','faturados']:
                    olddate='dt_fatura' if area=='faturados' else 'data_emissao_pedido'
                    newdate='dtemissao_docfat' if area=='faturados' else olddate
                    oldwhere=f"{olddate}>=DATE '2026-08-01' AND {olddate}<DATE '2026-09-01'"
                    newwhere=f"{newdate}>=DATE '2026-08-01' AND {newdate}<DATE '2026-09-01'"
                elif area=='metas':oldwhere=newwhere='ano_metasven=2026'
                else:
                    identifiers=','.join(str(int(x)) for x in sorted(clients))
                    assert identifiers,'Amostra de clientes vazia'
                    oldwhere=newwhere=f'codigo_pessoa IN ({identifiers})'
                reference_sql=to_postgres(queries()[document['query']]).strip().rstrip(';')
                with warnings.catch_warnings():
                    warnings.filterwarnings('ignore',message='pandas only supports SQLAlchemy')
                    raw=pd.read_sql_query(f'SELECT * FROM ({reference_sql}) base WHERE {oldwhere}',connection,coerce_float=True)
                raw.columns=raw.columns.str.upper()
                if area in ['abertos','emitidos','faturados']:clients.update(raw['CODIGO_CLIENTE'].dropna().astype(int))
                expected,kinds=original_csv_values(processed_with_original(raw,rules[area],code),code)
                target=f'({transformation_sql(area,contract)})' if sql_only else 'dw.'+views[area]
                cursor.execute(f'SELECT * FROM {target} base WHERE {newwhere}')
                actual=pd.DataFrame(cursor.fetchall(),columns=[c[0] for c in cursor.description])
                mapping={c['legacy']:c['name'] for c in document['columns']}
                volumes=[source for source in rules[area]['numbers'] if 'VOLUME_M3' in source]
                raw_actual=pd.DataFrame({source:pd.to_numeric(actual[mapping[source]]).astype('float64') for source in volumes})
                raw_expected=raw[volumes].astype('float64')
                preserved_volumes=compare(raw_expected,raw_actual)
                assert preserved_volumes['equal'],area+': volume anterior ao tratamento alterado'
                # The original function replaces the calculated volume as well as adding CLEAN.
                for source,treated in rules[area]['numbers'].items():
                    if 'VOLUME_M3' in source:mapping[source]=mapping[treated]
                mapped=pd.DataFrame({old:actual[new] for old,new in mapping.items()})
                mapped=cast_dw_to_original_types(mapped,kinds)
                result=compare(expected,mapped,mask_generated=area=='metas')
                helpers=[c['legacy'] for c in document['columns'] if c['kind']=='numeric-treatment']
                result['rows']=len(actual)
                result['preservedRawVolumes']=preserved_volumes
                result['volumeScaleCorrectionRows']=sum(int((raw[c]>1000).sum()) for c in volumes)
                result['excludedGeneratedTimestampFields']=sorted(['DATAHORAINCLUSAO_METASVEN','DATAHORAALTERACAO_METASVEN']) if area=='metas' else []
                result['generatedTimestampRows']=int((raw['AUTOINC_METASVEN']==0).sum()) if area=='metas' else 0
                result['numericTreatments']=compare(expected[helpers],mapped[helpers]) if helpers else None
                report['areas'][area]=result
                assert result['equal'],f'{area}: divergências {result}'
                print(f'{area}: {len(actual)} linhas, {result["comparedColumns"]} campos, zero divergências (staging → DW)',flush=True)
                if area in ['emitidos','faturados']:
                    field='VALOR_EMITIDO_CLEAN' if area=='emitidos' else 'VALOR_FATURADO_CLEAN'
                    total=lambda frame:sum((Decimal(str(v)) for v in frame[field] if pd.notna(v)),Decimal(0))
                    report['areas'][area]['legacyFinancialTotal']=str(total(expected))
                    report['areas'][area]['dwFinancialTotal']=str(total(mapped))
                    assert total(expected)==total(mapped)
        name='dw-treatment-sql-probe.json' if sql_only else 'dw-treatment-sample.json'
        (ROOT/'.local'/name).write_text(json.dumps(report,indent=2),encoding='utf-8')
        return report
    finally:connection.rollback();connection.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--sql-only',action='store_true')
    args=parser.parse_args();verify(args.sql_only)

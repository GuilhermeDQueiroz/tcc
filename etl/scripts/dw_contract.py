"""Persisted DW names and native SQL; original aliases stay inside the reference query."""
import ast
import json
from source_contract import ROOT, QUERY_NAMES, queries, to_postgres

COPIES = {
    'CODIGO_PEDIDO':'codigo_docfat', 'CODIGO_CLIENTE':'cliente_docfat',
    'RAZAO_SOCIAL':'razaosocial_pessoa', 'UF':'sigla_uf',
    'MICRO_REGIAO':'descricao_regiao', 'CIDADE':'descricao_cidade',
    'CLASSIFICACAO':'descricao_classif', 'ORIGEM':'descricao_origem',
    'ORGAO':'descricao_orgao', 'STATUS':'descricao_status',
}
DERIVED = {
    'GRUPO_CLIENTE':'grupo_cliente_descricao', 'CONSULTOR':'consultor_descricao',
    'SUPERVISOR':'supervisor_descricao', 'REGIAO_UF':'regiao_uf_descricao',
    'COR':'cor_descricao', 'GRUPO_ITEM':'grupo_item_descricao',
    'SUBGRUPO':'subgrupo_descricao', 'TIPO':'tipo_produto_descricao',
    'COLECAO':'colecao_descricao', 'LINHA':'linha_descricao', 'FAMILIA':'familia_descricao',
    'DT_PREVISAO_FATURAMENTO':'data_previsao_faturamento',
    'ON_TIME':'entrega_no_prazo', 'VLR_UNIT_BRULIQ':'valor_unitario_bruto_liquido',
}
CALCULATED = set(DERIVED) | {
    'DATA_EMISSAO_PEDIDO','DIA','MES','ANO','NIVEL_DE_SERVICO','TIPO_ENTREGA',
    'VALOR_EM_ABERTO','PESO_EM_ABERTO','VOLUME_M3_EM_ABERTO',
    'PESO_EMITIDO','VOLUME_M3_EMITIDO','VALOR_FATURADO','PESO_FATURADO',
    'VOLUME_M3_FATURADO','DIAS_DESVIO_FATURAMENTO',
}

def processing_rules():
    module=ast.parse((ROOT.parent/'legacy/scripts/extrator_firebird.py').read_text(encoding='utf-8-sig'))
    extraction=next(n for n in module.body if isinstance(n,ast.FunctionDef) and n.name=='extract_data')
    result={}
    for call in ast.walk(extraction):
        if isinstance(call,ast.Call) and isinstance(call.func,ast.Name) and call.func.id=='extract_query':
            area=next(a for a,q in QUERY_NAMES.items() if q==call.args[1].id)
            result[area]={'dates':ast.literal_eval(call.args[3]),'numbers':ast.literal_eval(call.args[4]) if len(call.args)>4 else {}}
    return result

def create_contract(source_schema):
    rules=processing_rules()
    areas={}
    for area,query in QUERY_NAMES.items():
        copies=dict(COPIES) if area in ['abertos','emitidos','faturados'] else {}
        if area=='emitidos':copies.update(CODIGO_CONSULTOR='pessoa_doccom',VALOR_EMITIDO='vlrbrutoliquido_docitemdet',QUANTIDADE_EMITIDA='qtdechapas_docitemdet')
        if area=='faturados':copies.update(QUANTIDADE_FATURADA='qtdechapas_docent',CARGA='carga_cardoc',ENTREGA='codigo_docfat_entrega',DT_FATURA='dtemissao_docfat',NOTAFISCAL='numeronf_nfdocumentos')
        if area=='metas':
            copies['DESCRICAO']='razaosocial_pessoa'
            for name in ['METAPORLINHA','METAPORGRUPO','METAPORTIPOPRODUTO','METAPORREGIAO','METAPORORIGEM','METAPORSUPERVISOR','METAPORCONSULTOR']:
                copies[name]=name.lower()+'_consven'
            copies['METAPORUNIDADEFABRIL']='metaporunidfabril_consven'
        columns=[]
        for source in source_schema[query]:
            old=source['name']
            derived=old in CALCULATED
            name=copies.get(old,DERIVED.get(old,old.lower()))
            column=dict(source,name=name,legacy=old,kind='calculated' if derived else 'copied')
            if not derived:column['sourceColumn']=name.removesuffix('_entrega').upper()
            if old=='ENTREGA':column['context']='DOCUMENTO_FATURA ENTREGA; pedido utiliza CODIGO_DOCFAT na mesma consulta'
            columns.append(column)
        for date in rules[area]['dates']:
            base=next(c['name'] for c in columns if c['legacy']==date)
            name='data_faturamento_tratada' if date=='DT_FATURA' else base+'_tratada'
            columns.append({'legacy':date+'_DATE','name':name,'type':"<class 'datetime.datetime'>",'kind':'date-treatment','input':date})
        for source,target in rules[area]['numbers'].items():
            name=DERIVED.get(source,source.lower())+'_tratado'
            if source=='QTDEABERTA_DOCITEMDET':name='quantidade_em_aberto_tratada'
            if source.startswith('QUANTIDADE_'):name=source.lower()+'_tratada'
            columns.append({'legacy':target,'name':name,'type':"<class 'float'>",'kind':'numeric-treatment','input':source,'volumeScale': 'VOLUME_M3' in target})
        assert len({c['name'] for c in columns})==len(columns),area
        areas[area]={'query':query,'columns':columns}
    return {'version':2,'naming':'original source names (PostgreSQL lowercase); derived Portuguese snake_case',
            'numericTreatment':'Float32, optional volume correction, shortest decimal text, Double Precision (legacy CSV)', 'areas':areas}

def transformation_sql(area,contract=None):
    if contract is None:contract=json.loads((ROOT/'etl/contrato-colunas-dw.json').read_text(encoding='utf-8'))
    document=contract['areas'][area]
    projections=[]
    for column in document['columns']:
        source=column.get('input',column['legacy']).lower()
        expr=f'original."{source}"'
        if column['kind']=='date-treatment':expr+='::timestamp'
        elif column['kind']=='numeric-treatment':
            expr=f'COALESCE({expr}::double precision,0)::real'
            if column['volumeScale']:expr=f'(CASE WHEN {expr}>1000::real THEN {expr}/1000::real ELSE {expr} END)'
            expr=f'({expr})::text::double precision'
        projections.append(f'  {expr} AS "{column["name"]}"')
    original=to_postgres(queries()[document['query']]).strip().rstrip(';')
    return 'SELECT\n'+',\n'.join(projections)+'\nFROM (\n'+original+'\n) original'

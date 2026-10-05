"""Build native Hop raw extraction for the first logistics delivery.

Metadata is inspected separately; ERP rows are read and written exclusively by Hop.
Order/item sources are scoped to eligible open items; supporting catalogs retain raw fields.
"""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    'DOCUMENTO_FATURA': ['CODIGO_DOCFAT','EMPRESA_DOCFAT','DTEMISSAO_DOCFAT','TIPO_DOCFAT','OPCAO_DOCFAT','ENTREGA_DOCFAT','DATAENTREGA_DOCFAT','DTSAIDA_DOCFAT','CLIENTE_DOCFAT','LOCALENTREGA_DOCFAT','STATUS_DOCFAT','ENTREGARMERCADORIA_DOCFAT'],
    'DOCUMENTO_ITEM': ['AUTOINC_DOCITEM','DOCUMENTO_DOCITEM','COMPOSICAOITEM_DOCITEM','TIPO_DOCITEM'],
    'DOCUMENTO_ITEM_DETALHE': ['AUTOINC_DOCITEMDET','AUTOINCITEM_DOCITEMDET','DOCUMENTO_DOCITEMDET','ITEM_DOCITEMDET','QTDECHAPAS_DOCITEMDET','QTDEABERTA_DOCITEMDET','QTDEFATURADO_DOCITEMDET','QTDECANCELADO_DOCITEMDET','QTDECARGA_DOCITEMDET','QTDECARGAFAT_DOCITEMDET','VLRBRUTOLIQUIDO_DOCITEMDET','AUTOINCITEMDETALHE_DOCITEMDET'],
    'DOCUMENTO_PEDIDO': ['DOCUMENTO_DOCPED','DTPREVISAOFATURAMENTO_DOCPED','DTPROMESSAENTREGA_DOCPED'],
    'CARGA_ITENS': ['AUTOINC_CARITE','AUTOINCCARDOC_CARITE','AUTOINCITEMDETDOC_CARITE','QTDECHAPAS_CARITE','QTDEFATURADO_CARITE','QTDEABERTA_CARITE'],
    'CARGA_DOCUMENTOS': ['AUTOINC_CARDOC','CARGA_CARDOC','DOCUMENTO_CARDOC','DTPREVISAOFATURAMENTO_CARDOC'],
    'CARGA': ['CODIGO_CARGA','EMPRESA_CARGA','DTEMISSAO_CARGA','DATAINICIO_SEPARACAO_CARGA','DATA_SEPARACAO_CARGA','DATAINICIO_CONFERENCIA_CARGA','DATA_CONFERENCIA_CARGA','DATAHORAFECHAMENTO_CARGA','DATAHORALIB_SAIDA_CARGA','DESCRICAO_CARGA','DTPREVISAOFATURAMENTO_CARGA'],
    'ITEM': ['CODIGO_ITEM','DESCRICAO_ITEM','PESOBRUTO_ITEM','VOLUMEM3_ITEM'],
    'ITEM_DETALHE': ['AUTOINC_ITEM_DETALHE','PESOBRUTO_ITEM_DETALHE','VOLUMEM3_ITEM_DETALHE'],
    'PESSOA': ['CODIGO_PESSOA','RAZAOSOCIAL_PESSOA'],
    'PESSOA_ENDERECO': ['AUTOINC_PESSOA_END','CIDADE_PESSOA_END','LATITUDE_PESSOA_END','LONGITUDE_PESSOA_END'],
    'CIDADE': ['CODIGO_CIDADE','DESCRICAO_CIDADE','UF_CIDADE'],
    'UF': ['CODIGO_UF','SIGLA_UF','REGIAO_UF'],
    'STATUS': ['CODIGO_STATUS','DESCRICAO_STATUS'],
}
POPULATION = """d.DTEMISSAO_DOCFAT >= '${LOGISTICS_START_DATE}' AND d.DTEMISSAO_DOCFAT < DATEADD(1 DAY TO CAST('${LOGISTICS_REFERENCE_DATE}' AS DATE))
AND d.TIPO_DOCFAT=1 AND d.OPCAO_DOCFAT=1 AND d.ENTREGA_DOCFAT='N'
AND di.AUTOINC_DOCITEM=di.COMPOSICAOITEM_DOCITEM AND di.TIPO_DOCITEM IN (1,4)
AND i.QTDEABERTA_DOCITEMDET>0"""
ITEMS = """SELECT i.AUTOINC_DOCITEMDET FROM DOCUMENTO_FATURA d
JOIN DOCUMENTO_ITEM di ON di.DOCUMENTO_DOCITEM=d.CODIGO_DOCFAT
JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINCITEM_DOCITEMDET=di.AUTOINC_DOCITEM WHERE """ + POPULATION
ORDERS = "SELECT d.CODIGO_DOCFAT FROM DOCUMENTO_FATURA d JOIN DOCUMENTO_ITEM di ON di.DOCUMENTO_DOCITEM=d.CODIGO_DOCFAT JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINCITEM_DOCITEMDET=di.AUTOINC_DOCITEM WHERE " + POPULATION
ALLOCATIONS = 'SELECT ci.AUTOINC_CARITE FROM CARGA_ITENS ci WHERE ci.AUTOINCITEMDETDOC_CARITE IN (' + ITEMS + ')'
LOAD_DOCS = 'SELECT cd.AUTOINC_CARDOC FROM CARGA_DOCUMENTOS cd WHERE cd.AUTOINC_CARDOC IN (SELECT ci.AUTOINCCARDOC_CARITE FROM CARGA_ITENS ci WHERE ci.AUTOINC_CARITE IN (' + ALLOCATIONS + '))'
PREDICATES = {
    'DOCUMENTO_FATURA': 'CODIGO_DOCFAT IN (' + ORDERS + ')',
    'DOCUMENTO_ITEM': 'AUTOINC_DOCITEM IN (SELECT i.AUTOINCITEM_DOCITEMDET FROM DOCUMENTO_ITEM_DETALHE i WHERE i.AUTOINC_DOCITEMDET IN (' + ITEMS + '))',
    'DOCUMENTO_ITEM_DETALHE': 'AUTOINC_DOCITEMDET IN (' + ITEMS + ')',
    'DOCUMENTO_PEDIDO': 'DOCUMENTO_DOCPED IN (' + ORDERS + ')',
    'CARGA_ITENS': 'AUTOINC_CARITE IN (' + ALLOCATIONS + ')',
    'CARGA_DOCUMENTOS': 'AUTOINC_CARDOC IN (' + LOAD_DOCS + ')',
    'CARGA': 'CODIGO_CARGA IN (SELECT cd.CARGA_CARDOC FROM CARGA_DOCUMENTOS cd WHERE cd.AUTOINC_CARDOC IN (' + LOAD_DOCS + '))',
    'ITEM': 'CODIGO_ITEM IN (SELECT i.ITEM_DOCITEMDET FROM DOCUMENTO_ITEM_DETALHE i WHERE i.AUTOINC_DOCITEMDET IN ('+ITEMS+'))',
    'ITEM_DETALHE': 'AUTOINC_ITEM_DETALHE IN (SELECT i.AUTOINCITEMDETALHE_DOCITEMDET FROM DOCUMENTO_ITEM_DETALHE i WHERE i.AUTOINC_DOCITEMDET IN ('+ITEMS+'))',
    'PESSOA': 'CODIGO_PESSOA IN (SELECT d.CLIENTE_DOCFAT FROM DOCUMENTO_FATURA d WHERE d.CODIGO_DOCFAT IN ('+ORDERS+'))',
    'PESSOA_ENDERECO': 'AUTOINC_PESSOA_END IN (SELECT d.LOCALENTREGA_DOCFAT FROM DOCUMENTO_FATURA d WHERE d.CODIGO_DOCFAT IN ('+ORDERS+'))',
    'CIDADE': '1=1', 'UF':'1=1', 'STATUS':'1=1',
}


def pg_type(field):
    code, scale = field['typeCode'], field.get('scale') or 0
    if scale < 0 or field.get('subtype') in (1,2):
        return f"numeric({field.get('precision') or 18},{abs(scale)})"
    return {7:'smallint',8:'integer',16:'bigint',26:'numeric(38,0)',10:'real',27:'double precision',12:'date',13:'time',35:'timestamp without time zone',14:'text',37:'text',23:'boolean'}[code]


def main():
    metadata = json.loads((ROOT/'.local/logistica-origem-schema.json').read_text(encoding='utf-8'))['tables']
    pipeline_dir = ROOT/'etl/pipelines/logistica'; pipeline_dir.mkdir(parents=True,exist_ok=True)
    sql_dir = ROOT/'etl/sql/logistica'; sql_dir.mkdir(parents=True,exist_ok=True)
    ddl = ['CREATE SCHEMA IF NOT EXISTS logistica_stage;', 'CREATE SCHEMA IF NOT EXISTS logistica;',
           "CREATE TABLE IF NOT EXISTS logistica.execucao (id uuid PRIMARY KEY, inicio timestamptz NOT NULL DEFAULT now(), fim timestamptz, status text NOT NULL CHECK(status IN ('executando','publicado','falhou')), data_inicio date NOT NULL, data_referencia date NOT NULL, origem text NOT NULL, contagens jsonb);",
           'CREATE TABLE IF NOT EXISTS logistica.publicacao (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), execucao_id uuid NOT NULL REFERENCES logistica.execucao(id));']
    contract = []
    for table, columns in SOURCES.items():
        fields = {field['name']:field for field in metadata[table]['fields']}
        types = [pg_type(fields[column]) for column in columns]
        name = table.lower()
        ddl.append('CREATE TABLE IF NOT EXISTS logistica_stage.'+name+' ('+', '.join(column.lower()+' '+kind for column,kind in zip(columns,types))+', PRIMARY KEY ('+columns[0].lower()+'));')
        # Additive migration keeps published facts readable while new staging is loaded.
        ddl.extend('ALTER TABLE logistica_stage.'+name+' ADD COLUMN IF NOT EXISTS '+column.lower()+' '+kind+';' for column,kind in zip(columns,types))
        root = ET.parse(ROOT/'etl/pipelines/extracao/fatos/ext_carga.hpl').getroot()
        root.find('info/name').text = 'ext_logistica_'+name
        root.find('info/description').text = 'Campos brutos de '+table+' no recorte de pedidos abertos; sem cálculo de indicadores.'
        for transform in root.findall('transform'):
            if transform.findtext('type') == 'TableInput':
                transform.find('sql').text = 'SELECT '+', '.join(columns)+' FROM '+table+' WHERE '+PREDICATES[table]
            else:
                transform.find('schema').text = 'logistica_stage'; transform.find('table').text = name
                mappings = transform.find('fields'); mappings.clear()
                for column in columns:
                    item = ET.SubElement(mappings,'field')
                    ET.SubElement(item,'column_name').text = column.lower(); ET.SubElement(item,'stream_name').text = column
        ET.indent(root,space='  ')
        ET.ElementTree(root).write(pipeline_dir/('ext_logistica_'+name+'.hpl'),encoding='utf-8',xml_declaration=True)
        contract.append({'source':table,'staging':'logistica_stage.'+name,'columns':dict(zip(columns,types))})
    ddl.append("INSERT INTO logistica.execucao(id,status,data_inicio,data_referencia,origem) VALUES ('${ETL_RUN_ID}','executando','${LOGISTICS_START_DATE}','${LOGISTICS_REFERENCE_DATE}','Cópia local anonimizada / Apache Hop');")
    ddl.append('TRUNCATE '+', '.join('logistica_stage.'+table.lower() for table in SOURCES)+';')
    (sql_dir/'001_preparar.sql').write_text('\n'.join(ddl)+'\n',encoding='utf-8')
    (ROOT/'etl/logistica-fontes.json').write_text(json.dumps(contract,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    workflow = ET.Element('workflow'); ET.SubElement(workflow,'name').text = 'logistica_local'
    ET.SubElement(workflow,'name_sync_with_filename').text = 'Y'
    ET.SubElement(workflow,'description').text = 'Formação de cargas: extração nativa de cópia local e publicação isolada, validada e atômica.'
    actions = ET.SubElement(workflow,'actions'); hops = ET.SubElement(workflow,'hops')
    steps = [('Start','SPECIAL',None),('Preparar logística','SQL','sql/logistica/001_preparar.sql')]
    steps += [('Extrair '+table,'PIPELINE','pipelines/logistica/ext_logistica_'+table.lower()+'.hpl') for table in SOURCES]
    steps += [('Validar e publicar logística','SQL','sql/logistica/002_publicar.sql'),('Success','SUCCESS',None)]
    for index,(name,kind,file) in enumerate(steps+[('Abortar','ABORT',None)]):
        action = ET.SubElement(actions,'action')
        for key,value in {'name':name,'type':kind,'parallel':'N','xloc':str(80+index*180),'yloc':'160'}.items(): ET.SubElement(action,key).text=value
        if kind=='SPECIAL': ET.SubElement(action,'repeat').text='N'
        if kind=='ABORT': ET.SubElement(action,'message').text='Publicação logística interrompida. Versão anterior preservada.'
        if file:
            settings = {'connection':'DW','sqlfromfile':'Y','sqlfilename':'${PROJECT_HOME}/'+file,'sqlfilename_encoding':'UTF-8','useVariableSubstitution':'Y','sendOneStatement':'Y'} if kind=='SQL' else {'filename':'${PROJECT_HOME}/'+file,'run_configuration':'local','wait_until_finished':'Y','params_from_previous':'N','exec_per_row':'N'}
            for key,value in settings.items(): ET.SubElement(action,key).text=value
    for index,(name,kind,_) in enumerate(steps[:-1]):
        for success,target in [(True,steps[index+1][0])]+([] if kind=='SPECIAL' else [(False,'Abortar')]):
            hop = ET.SubElement(hops,'hop')
            for key,value in {'from':name,'to':target,'enabled':'Y','evaluation':'Y' if success else 'N','unconditional':'Y' if kind=='SPECIAL' else 'N'}.items(): ET.SubElement(hop,key).text=value
    ET.indent(workflow,space='  ')
    ET.ElementTree(workflow).write(ROOT/'etl/workflows/logistica_local.hwf',encoding='utf-8',xml_declaration=True)
    print(f'Gerados: {len(SOURCES)} pipelines Hop, workflow, DDL e contrato de fontes logísticas.')


if __name__ == '__main__': main()

"""Build native Hop raw extraction and staging-to-DW transformations."""
import json
import xml.etree.ElementTree as ET
from source_contract import to_postgres
from dw_contract import transformation_sql


FACTS={'CARGA','CARGA_DOCUMENTOS','CARGA_ITENS','DOCUMENTO_COMISSAO','DOCUMENTO_ENTREGA',
       'DOCUMENTO_FATURA','DOCUMENTO_FISCAL','DOCUMENTO_ITEM','DOCUMENTO_ITEM_DETALHE',
       'DOCUMENTO_PEDIDO','NOTA_FISCAL_DOCUMENTOS','METAS_VENDAS'}

def build(etl,portal,raw,schema,areas):
    template=ET.parse(portal/'pipelines/extracao/fatos/ext_documento_fatura.hpl').getroot()

    def pipeline(name,query,input_connection,output_schema,table,columns,description,path):
        document=ET.fromstring(ET.tostring(template))
        document.find('info/name').text=name
        document.find('info/description').text=description
        for transform in document.findall('transform'):
            if transform.findtext('type')=='TableInput':
                transform.find('sql').text=query
                transform.find('connection').text=input_connection
            else:
                transform.find('schema').text=output_schema
                transform.find('table').text=table
                transform.find('truncate').text='N'
                transform.find('auto_update_table_structure').text='N'
                transform.find('specify_fields').text='Y'
                fields=transform.find('fields');fields.clear()
                for column in columns:
                    field=ET.SubElement(fields,'field')
                    ET.SubElement(field,'column_name').text=column.lower()
                    ET.SubElement(field,'stream_name').text=column if input_connection=='DADOS' else column.lower()
        # Name the actual endpoints; the output template also references them in hops.
        names={}
        for transform in document.findall('transform'):
            old=transform.findtext('name')
            if transform.findtext('type')=='TableInput':new='Ler Firebird (dados brutos)' if input_connection=='DADOS' else 'Ler staging (joins e cálculos)'
            else:new='Gravar staging (dados brutos)' if output_schema=='staging' else 'Gravar DW (dados transformados)'
            names[old]=new;transform.find('name').text=new
        for hop in document.findall('order/hop'):
            for tag in ['from','to']:hop.find(tag).text=names[hop.findtext(tag)]
        path.parent.mkdir(parents=True,exist_ok=True)
        ET.indent(document);ET.ElementTree(document).write(path,encoding='utf-8',xml_declaration=True)

    inventory=[]
    for table,source in raw.items():
        kind='fatos' if table in FACTS else 'dimensoes'
        name='ext_'+table.lower()
        path=etl/f'pipelines/extracao/{kind}/{name}.hpl'
        exists=(portal/f'pipelines/extracao/{kind}/{name}.hpl').is_file()
        inventory.append({'source':table,'staging':'stg_'+table.lower(),'pipeline':str(path.relative_to(etl)).replace('\\','/'),'existedInPortal':exists,'columns':[c['name'] for c in source['columns']]})
        pipeline(name,source['sql'],'DADOS','staging','stg_'+table.lower(),
                 [c['name'] for c in source['columns']],
                 f'Espelho bruto de {table}; sem joins, cálculos ou deduplicação.',path)
    for area,query_name in areas.items():
        original=(etl/f'sql/fontes/{query_name}.sql').read_text(encoding='utf-8').strip()
        query=transformation_sql(area)
        (etl/f'sql/transformacoes/{area}.sql').write_text(query+'\n',encoding='utf-8')
        name='load_'+('carteira_clientes' if area=='carteira' else 'metas_consultores' if area=='metas' else 'pedidos_'+area)
        pipeline(name,query,'DW','dw','carga_'+area,[c['name'] for c in schema[query_name]],
                 f'Consulta original {query_name} adaptada para PostgreSQL: staging → dw.carga_{area}.',
                 etl/f'pipelines/transformacao-carregamento/{name}.hpl')
    # Remove only obsolete generated pipelines inside this project's ETL.
    for path in (etl/'pipelines/extracao').rglob('extrair_*.hpl'):path.unlink()
    (etl/'inventario-fontes.json').write_text(json.dumps(inventory,indent=2,ensure_ascii=False),encoding='utf-8')

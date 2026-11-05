"""Generate isolated native Hop extraction using inspected Firebird metadata."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
SOURCES={
 'DOCUMENTO_FATURA':['CODIGO_DOCFAT','EMPRESA_DOCFAT','CLIENTE_DOCFAT','DTEMISSAO_DOCFAT','TIPO_DOCFAT','OPCAO_DOCFAT','ENTREGA_DOCFAT','LOCALENTREGA_DOCFAT','STATUS_DOCFAT','MOTIVO_DOCFAT'],
 'DOCUMENTO_ITEM':['AUTOINC_DOCITEM','DOCUMENTO_DOCITEM','COMPOSICAOITEM_DOCITEM','TIPO_DOCITEM','ITEM_DOCITEM','MOTIVO_DOCITEM','TIPOASSISTENCIA_DOCITEM'],
 'DOCUMENTO_ITEM_DETALHE':['AUTOINC_DOCITEMDET','AUTOINCITEM_DOCITEMDET','QTDECHAPAS_DOCITEMDET','QTDEABERTA_DOCITEMDET','QTDEFATURADO_DOCITEMDET','QTDECANCELADO_DOCITEMDET','VLRBRUTOLIQUIDO_DOCITEMDET','COR_DOCITEMDET'],
 'DOCUMENTO_DEVOLUCAOCANCELA':['AUTOINC_DOCDEV','DOCUMENTO_DOCDEV','AUTOINCITEMDETDOC_DOCDEV','QUANTIDADE_DOCDEV','MOTIVODEVOLUCAO_DOCDEV'],
 'DOCUMENTO_ENTREGA_DEVCAN':['AUTOINC_DOCENTDEV','DOCUMENTO_DOCENTDEV','AUTOINCDOCENT_DOCENTDEV','OPCAODOCUMENTO_DOCENTDEV','QTDECHAPAS_DOCENTDEV','MOTIVO_DOCENTDEV'],
 'DOCUMENTO_ENTREGA':['AUTOINC_DOCENT','DOCUMENTO_DOCENT','AUTOINCITEMDETDOC_DOCENT','TIPO_DOCENT'],
 'DOCUMENTO_PEDIDO':['DOCUMENTO_DOCPED','DTPREVISAOFATURAMENTO_DOCPED'],
 'MOTIVO':['CODIGO_MOTIVO','DESCRICAO_MOTIVO','TIPO_MOTIVO'],
 'PESSOA':['CODIGO_PESSOA','RAZAOSOCIAL_PESSOA','GRUPO_PESSOA'],
 'PESSOA_ENDERECO':['AUTOINC_PESSOA_END','CIDADE_PESSOA_END'],
 'ITEM':['CODIGO_ITEM','DESCRICAO_ITEM'],
 'CIDADE':['CODIGO_CIDADE','DESCRICAO_CIDADE','UF_CIDADE'],
 'UF':['CODIGO_UF','SIGLA_UF'],
 'STATUS':['CODIGO_STATUS','DESCRICAO_STATUS'],
}
BOUNDS="DTEMISSAO_DOCFAT >= '${AFTERSALES_START_DATE}' AND DTEMISSAO_DOCFAT < DATEADD(1 DAY TO CAST('${AFTERSALES_REFERENCE_DATE}' AS DATE))"
BASE=BOUNDS+" AND ENTREGA_DOCFAT='N' AND ((TIPO_DOCFAT=2 AND OPCAO_DOCFAT=1) OR (TIPO_DOCFAT IN (1,2) AND OPCAO_DOCFAT IN (2,4)))"
EVENTS='SELECT CODIGO_DOCFAT FROM DOCUMENTO_FATURA WHERE '+BASE
ORIGINALS='SELECT di.DOCUMENTO_DOCITEM FROM DOCUMENTO_DEVOLUCAOCANCELA v JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINC_DOCITEMDET=v.AUTOINCITEMDETDOC_DOCDEV JOIN DOCUMENTO_ITEM di ON di.AUTOINC_DOCITEM=i.AUTOINCITEM_DOCITEMDET WHERE v.DOCUMENTO_DOCDEV IN ('+EVENTS+')'
RETURN_ORIGINALS='SELECT di.DOCUMENTO_DOCITEM FROM DOCUMENTO_ENTREGA_DEVCAN v JOIN DOCUMENTO_ENTREGA t ON t.AUTOINC_DOCENT=v.AUTOINCDOCENT_DOCENTDEV JOIN DOCUMENTO_ITEM_DETALHE i ON i.AUTOINC_DOCITEMDET=t.AUTOINCITEMDETDOC_DOCENT JOIN DOCUMENTO_ITEM di ON di.AUTOINC_DOCITEM=i.AUTOINCITEM_DOCITEMDET WHERE v.DOCUMENTO_DOCENTDEV IN ('+EVENTS+')'
DOCS='SELECT CODIGO_DOCFAT FROM DOCUMENTO_FATURA WHERE CODIGO_DOCFAT IN ('+EVENTS+') OR CODIGO_DOCFAT IN ('+ORIGINALS+') OR CODIGO_DOCFAT IN ('+RETURN_ORIGINALS+')'
PREDICATES={
 'DOCUMENTO_FATURA':'CODIGO_DOCFAT IN ('+DOCS+')',
 'DOCUMENTO_ITEM':'DOCUMENTO_DOCITEM IN ('+DOCS+')',
 'DOCUMENTO_ITEM_DETALHE':'AUTOINCITEM_DOCITEMDET IN (SELECT AUTOINC_DOCITEM FROM DOCUMENTO_ITEM WHERE DOCUMENTO_DOCITEM IN ('+DOCS+'))',
 'DOCUMENTO_DEVOLUCAOCANCELA':'DOCUMENTO_DOCDEV IN ('+EVENTS+')',
 'DOCUMENTO_ENTREGA_DEVCAN':'DOCUMENTO_DOCENTDEV IN ('+EVENTS+')',
 'DOCUMENTO_ENTREGA':'AUTOINC_DOCENT IN (SELECT AUTOINCDOCENT_DOCENTDEV FROM DOCUMENTO_ENTREGA_DEVCAN WHERE DOCUMENTO_DOCENTDEV IN ('+EVENTS+'))',
 'DOCUMENTO_PEDIDO':'DOCUMENTO_DOCPED IN ('+DOCS+')',
 'PESSOA':'CODIGO_PESSOA IN (SELECT CLIENTE_DOCFAT FROM DOCUMENTO_FATURA WHERE CODIGO_DOCFAT IN ('+DOCS+'))',
 'PESSOA_ENDERECO':'AUTOINC_PESSOA_END IN (SELECT LOCALENTREGA_DOCFAT FROM DOCUMENTO_FATURA WHERE CODIGO_DOCFAT IN ('+DOCS+'))',
}
def main():
 inventory=json.loads((ROOT/'.local/posvenda-inventario.json').read_text(encoding='utf-8-sig'))['schema']
 logistics=json.loads((ROOT/'.local/logistica-origem-schema.json').read_text(encoding='utf-8'))['tables']
 raw=json.loads((ROOT/'etl/sql/fontes/raw-source-schema.json').read_text(encoding='utf-8'))
 from build_logistica import pg_type
 ddl=['CREATE SCHEMA IF NOT EXISTS posvenda_stage;','CREATE SCHEMA IF NOT EXISTS posvenda;',
  "CREATE TABLE IF NOT EXISTS posvenda.execucao(id uuid PRIMARY KEY,inicio timestamptz DEFAULT now(),fim timestamptz,status text NOT NULL CHECK(status IN ('executando','publicado','falhou')),data_inicio date NOT NULL,data_referencia date NOT NULL,origem text NOT NULL,contagens jsonb);",
  'CREATE TABLE IF NOT EXISTS posvenda.publicacao(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),execucao_id uuid NOT NULL REFERENCES posvenda.execucao(id));']
 contract=[]
 pipeline_dir=ROOT/'etl/pipelines/posvenda';pipeline_dir.mkdir(parents=True,exist_ok=True)
 sql_dir=ROOT/'etl/sql/posvenda';sql_dir.mkdir(parents=True,exist_ok=True)
 for table,columns in SOURCES.items():
  if table in inventory:
   fields={f['name']:{'typeCode':f['type_code'],'scale':f['scale'],'subtype':f['subtype'],'precision':f['num_precision']} for f in inventory[table]}
   types=[pg_type(fields[c]) for c in columns]
  elif table in logistics:
   fields={f['name']:f for f in logistics[table]['fields']};types=[pg_type(fields[c]) for c in columns]
   # GRUPO_PESSOA is outside the earlier logistics projection; use inspected commercial metadata.
  else:
   fields={f['name']:f for f in raw[table]['columns']}
   types=['bigint' if 'int' in fields[c]['type'] else 'text' for c in columns]
  ddl.append('CREATE TABLE IF NOT EXISTS posvenda_stage.'+table.lower()+' ('+', '.join(c.lower()+' '+t for c,t in zip(columns,types))+', PRIMARY KEY ('+columns[0].lower()+'));')
  pipeline=ET.parse(ROOT/'etl/pipelines/extracao/fatos/ext_carga.hpl').getroot()
  pipeline.find('info/name').text='ext_posvenda_'+table.lower()
  pipeline.find('info/description').text='Espelho bruto do recorte de pós-venda de '+table+'; indicadores calculados no PostgreSQL.'
  for transform in pipeline.findall('transform'):
   if transform.findtext('type')=='TableInput':transform.find('sql').text='SELECT '+', '.join(columns)+' FROM '+table+' WHERE '+PREDICATES.get(table,'1=1')
   else:
    transform.find('schema').text='posvenda_stage';transform.find('table').text=table.lower()
    mappings=transform.find('fields');mappings.clear()
    for c in columns:
     field=ET.SubElement(mappings,'field');ET.SubElement(field,'column_name').text=c.lower();ET.SubElement(field,'stream_name').text=c
  ET.indent(pipeline,space='  ');ET.ElementTree(pipeline).write(pipeline_dir/('ext_posvenda_'+table.lower()+'.hpl'),encoding='utf-8',xml_declaration=True)
  contract.append({'source':table,'staging':'posvenda_stage.'+table.lower(),'columns':dict(zip(columns,types))})
 ddl += ["INSERT INTO posvenda.execucao(id,status,data_inicio,data_referencia,origem) VALUES ('${ETL_RUN_ID}','executando','${AFTERSALES_START_DATE}','${AFTERSALES_REFERENCE_DATE}','Cópia local anonimizada / Apache Hop');",'TRUNCATE '+', '.join('posvenda_stage.'+t.lower() for t in SOURCES)+';']
 (sql_dir/'001_preparar.sql').write_text('\n'.join(ddl)+'\n',encoding='utf-8')
 (ROOT/'etl/posvenda-fontes.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 workflow=ET.parse(ROOT/'etl/workflows/logistica_local.hwf').getroot()
 workflow.find('name').text='posvenda_local';workflow.find('description').text='Assistências, cancelamentos de venda e devoluções; publicação isolada e atômica.'
 actions=workflow.find('actions');actions.clear();hops=workflow.find('hops');hops.clear()
 steps=[('Start','SPECIAL',None),('Preparar pós-venda','SQL','sql/posvenda/001_preparar.sql')]+[('Extrair '+t,'PIPELINE','pipelines/posvenda/ext_posvenda_'+t.lower()+'.hpl') for t in SOURCES]+[('Validar e publicar','SQL','sql/posvenda/002_publicar.sql'),('Success','SUCCESS',None)]
 for index,(name,kind,file) in enumerate(steps+[('Abortar','ABORT',None)]):
  action=ET.SubElement(actions,'action')
  settings={'name':name,'type':kind,'parallel':'N','xloc':str(80+index*180),'yloc':'160'}
  if kind=='SPECIAL':settings['repeat']='N'
  if kind=='ABORT':settings['message']='Carga pós-venda interrompida. Publicação anterior preservada.'
  if file:settings.update({'connection':'DW','sqlfromfile':'Y','sqlfilename':'${PROJECT_HOME}/'+file,'sqlfilename_encoding':'UTF-8','useVariableSubstitution':'Y','sendOneStatement':'Y'} if kind=='SQL' else {'filename':'${PROJECT_HOME}/'+file,'run_configuration':'local','wait_until_finished':'Y','params_from_previous':'N','exec_per_row':'N'})
  for k,v in settings.items():ET.SubElement(action,k).text=v
 for index,(name,kind,_) in enumerate(steps[:-1]):
  for success,target in [(True,steps[index+1][0])]+([] if kind=='SPECIAL' else [(False,'Abortar')]):
   hop=ET.SubElement(hops,'hop')
   for k,v in {'from':name,'to':target,'enabled':'Y','evaluation':'Y' if success else 'N','unconditional':'Y' if kind=='SPECIAL' else 'N'}.items():ET.SubElement(hop,k).text=v
 ET.indent(workflow,space='  ');ET.ElementTree(workflow).write(ROOT/'etl/workflows/posvenda_local.hwf',encoding='utf-8',xml_declaration=True)
 print('Generated native aftersales extraction:',len(SOURCES),'sources')

if __name__=='__main__':main()

"""Native Hop workflows and publication pipeline in the Portal folder layout."""
import xml.etree.ElementTree as ET


def generate(etl,raw):
    def add(parent, key, value=''):
        item = ET.SubElement(parent,key)
        item.text = str(value)
        return item

    def write(element,path):
        ET.indent(element)
        path.parent.mkdir(parents=True,exist_ok=True)
        ET.ElementTree(element).write(path,encoding='utf-8',xml_declaration=True)

    def sql_step(name,filename):
        return (name,'SQL',dict(connection='DW',sqlfromfile='Y',sqlfilename='${PROJECT_HOME}/sql/'+filename,sqlfilename_encoding='UTF-8',useVariableSubstitution='Y',sendOneStatement='Y'))

    def file_step(name,kind,filename):
        return (name,kind,dict(filename='${PROJECT_HOME}/'+filename,run_configuration='local',wait_until_finished='Y',params_from_previous='N',exec_per_row='N'))

    publication=ET.Element('pipeline')
    info=add(publication,'info')
    add(info,'name','load_modelo_analitico')
    add(info,'description','Publicação atômica: staging → dimensões e fatos dw. SQL idêntico a sql/003_publicacao.sql.')
    add(info,'pipeline_type','Normal');add(info,'size_rowset',10000)
    add(publication,'order')
    transform=add(publication,'transform')
    for key,value in {'name':'Publicar dimensões e fatos em uma transação','type':'ExecSql','copies':1,'connection':'DW','sql':(etl/'sql/003_publicacao.sql').read_text(encoding='utf-8').strip(),'execute_each_row':'N','single_statement':'Y','replace_variables':'Y','set_params':'N'}.items():add(transform,key,value)
    gui=add(transform,'GUI');add(gui,'xloc',360);add(gui,'yloc',180)
    write(publication,etl/'pipelines/transformacao-carregamento/load_modelo_analitico.hpl')

    def workflow_file(name,description,steps,record_failure=False):
        workflow=ET.Element('workflow')
        add(workflow,'name',name);add(workflow,'name_sync_with_filename','Y');add(workflow,'description',description)
        actions=add(workflow,'actions');hops=add(workflow,'hops')
        def action(label,kind,props,x,y):
            item=add(actions,'action')
            for k,v in dict(name=label,type=kind,parallel='N',xloc=x,yloc=y,**props).items():add(item,k,v)
        def hop(a,b,evaluation='Y',unconditional='N'):
            item=add(hops,'hop')
            for k,v in dict(from_=a,to=b,enabled='Y',evaluation=evaluation,unconditional=unconditional).items():add(item,k.rstrip('_'),v)
        action('Start','SPECIAL',dict(repeat='N',schedulerType=0),60,160)
        for i,(label,kind,props) in enumerate(steps):
            action(label,kind,props,240+(i%5)*200,160+(i//5)*150)
        action('Success','SUCCESS',{},240+(len(steps)%5)*200,160+(len(steps)//5)*150)
        failure='Registrar falha' if record_failure else 'Abortar'
        if record_failure:
            label,kind,props=sql_step('Registrar falha','006_falha.sql')
            action(label,kind,props,650,360+(len(steps)//5)*150)
        action('Abortar','ABORT',dict(message='Carga interrompida; consulte o log. Publicação é transacional.'),850,360+(len(steps)//5)*150)
        hop('Start',steps[0][0],unconditional='Y')
        for current,next_step in zip(steps,steps[1:]+[('Success','SUCCESS',{})]):
            hop(current[0],next_step[0]);hop(current[0],failure,'N')
        if record_failure:hop('Registrar falha','Abortar',unconditional='Y')
        write(workflow,etl/f'workflows/{name}.hwf')

    from build_pipelines import FACTS
    for kind in ['dimensoes','fatos']:
        tables=[t for t in raw if (t in FACTS)==(kind=='fatos')]
        workflow_file('wf_extracao_'+kind,'Extração de tabelas brutas do Firebird para staging',[
            file_step('Extrair '+table,'PIPELINE',f'pipelines/extracao/{kind}/ext_{table.lower()}.hpl') for table in tables])
    workflow_file('wf_load','Validação e publicação atômica do modelo analítico',[
        sql_step('Preparar índices e estatísticas','008_indices_staging.sql')
    ]+[
        file_step('Transformar '+a,'PIPELINE','pipelines/transformacao-carregamento/load_'+n+'.hpl')
        for a,n in {'abertos':'pedidos_abertos','emitidos':'pedidos_emitidos','faturados':'pedidos_faturados','carteira':'carteira_clientes','metas':'metas_consultores'}.items()
    ]+[
        sql_step('Validar bases transformadas','004_validacao.sql'),
        file_step('Publicar modelo analítico','PIPELINE','pipelines/transformacao-carregamento/load_modelo_analitico.hpl')])
    workflow_file('main','Carga diária completa: dimensões, fatos e publicação',[
        ('Identificar execução','EVAL',dict(script='if (java.lang.System.getProperty("HOP_PLATFORM_RUNTIME") == "GUI" || !parent_workflow.getVariable("ETL_RUN_ID")) { parent_workflow.setVariable("ETL_RUN_ID", java.util.UUID.randomUUID().toString()); } true;')),
        sql_step('Preservar referência curada','007_preservar_referencia.sql'),
        sql_step('Criar staging','001_staging.sql'),sql_step('Criar modelo','002_modelo_analitico.sql'),
        sql_step('Preparar carga','005_preparacao.sql'),
        file_step('wf_extracao_dimensoes','WORKFLOW','workflows/wf_extracao_dimensoes.hwf'),
        file_step('wf_extracao_fatos','WORKFLOW','workflows/wf_extracao_fatos.hwf'),
        file_step('wf_load','WORKFLOW','workflows/wf_load.hwf'),
    ],record_failure=True)
    workflow_file('reprocessar_dw','Reprocessar somente DW a partir do staging bruto existente, sem conexão ao Firebird',[
        ('Identificar execução','EVAL',dict(script='if (java.lang.System.getProperty("HOP_PLATFORM_RUNTIME") == "GUI" || !parent_workflow.getVariable("ETL_RUN_ID")) { parent_workflow.setVariable("ETL_RUN_ID", java.util.UUID.randomUUID().toString()); } true;')),
        sql_step('Atualizar modelo e nomes','002_modelo_analitico.sql'),
        sql_step('Preparar somente DW','010_preparacao_dw.sql'),
        file_step('wf_load','WORKFLOW','workflows/wf_load.hwf'),
    ],record_failure=True)

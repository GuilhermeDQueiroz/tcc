"""Execute the original research groupby and totals on the real published rows."""
import ast
import hashlib
import json
import math
from pathlib import Path
import numpy as np
import pandas as pd

root=Path(__file__).resolve().parents[1]
path=root.parent/'legacy/views/pedidos_em_aberto.py'
source=path.read_text(encoding='utf-8-sig')
tree=ast.parse(source)
frame=pd.DataFrame(json.loads((root/'.local/normalized-abertos.json').read_text(encoding='utf-8-sig')))
for field in ['PESO_EM_ABERTO_CLEAN','VOLUME_M3_EM_ABERTO_CLEAN','QTDEABERTA_DOCITEMDET_CLEAN','NIVEL_DE_SERVICO_CLEAN']:
    frame[field]=frame[field].astype('float32')
nodes=[next(node for node in ast.walk(tree) if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id==name for target in node.targets)) for name in ['df_grouped','tot_ped_aberto']]
def capture(data):
    scope={'df_det_source':data,'pd':pd}
    for node in nodes:exec(compile(ast.Module(body=[node],type_ignores=[]),str(path),'exec'),scope)
    return {'rows':scope['df_grouped'].to_dict(orient='records'),'total':scope['tot_ped_aberto']}
def clean(value):
    if isinstance(value,dict):return {key:clean(item) for key,item in value.items()}
    if isinstance(value,list):return [clean(item) for item in value]
    if isinstance(value,np.generic):value=value.item()
    return None if isinstance(value,float) and not math.isfinite(value) else value
version=json.loads((root/'.local/domain-reference.json').read_text(encoding='utf-8-sig'))['version']
report={'version':version,'synthetic':False,'sourceFile':str(path),'sourceLines':[node.lineno for node in nodes],'sourceSha256':hashlib.sha256(source.encode()).hexdigest(),'all':capture(frame),'filters':[]}
for key in ['SUPERVISOR','CONSULTOR','STATUS']:
    value=frame[key].dropna().iloc[0]
    report['filters'].append({'key':key,'value':value,'expected':capture(frame[frame[key].astype(str)==str(value)])})
(root/'.local/open-orders-reference.json').write_text(json.dumps(clean(report),ensure_ascii=False,indent=2),encoding='utf-8')
print(f"Original research: {len(report['all']['rows'])} actual orders, three actual filter selections; publication {version}")

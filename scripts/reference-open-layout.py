"""Execute the original inline monthly-delivery groupby on the actual DW rows.
Read-only reference generation; not an extractor or runtime data source.
"""
import ast
import hashlib
import json
from pathlib import Path
import pandas as pd

root = Path(__file__).resolve().parents[1]
source_path = root.parent / 'legacy/views/pedidos_em_aberto.py'
chart_path = root.parent / 'legacy/views/pedidos_em_aberto_charts.py'
source = source_path.read_text(encoding='utf-8-sig')
tree = ast.parse(source)
chart_tree = ast.parse(chart_path.read_text(encoding='utf-8-sig'))
months = next(ast.literal_eval(node.value) for node in chart_tree.body
              if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'MONTH_NAMES' for t in node.targets))
frame = pd.DataFrame(json.loads((root / '.local/normalized-abertos.json').read_text(encoding='utf-8-sig')))
frame['DATA_EMISSAO_PEDIDO_DATE'] = pd.to_datetime(frame['DATA_EMISSAO_PEDIDO_DATE'])
scope = {'df_abertos': frame, 'dt_series': frame['DATA_EMISSAO_PEDIDO_DATE'], 'MONTH_NAMES': months}
for field in ['Mes_Sort', 'Mes_Grupo']:
    node = next(node for node in ast.walk(tree) if isinstance(node, ast.Assign)
                and any(isinstance(t, ast.Subscript) and isinstance(t.slice, ast.Constant) and t.slice.value == field for t in node.targets)
                and not isinstance(node.value, ast.Constant))
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(source_path), 'exec'), scope)
node = next(node for node in ast.walk(tree) if isinstance(node, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == 'entrega_pivot' for t in node.targets))
exec(compile(ast.Module(body=[node], type_ignores=[]), str(source_path), 'exec'), scope)
publication = json.loads((root / '.local/domain-reference.json').read_text(encoding='utf-8-sig'))
report = {'version': publication['version'], 'source': 'original legacy AST / actual PostgreSQL DW',
          'synthetic': False, 'sourceFile': str(source_path), 'sourceLine': node.lineno,
          'sourceSha256': hashlib.sha256(source.encode()).hexdigest(),
          'rows': scope['entrega_pivot'].to_dict(orient='records')}
(root / '.local/open-layout-reference.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Original groupby: {len(report['rows'])} real monthly-delivery groups, publication {report['version']}")

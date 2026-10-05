"""Read-only real-data oracle: execute original functions, including post-card math.

Original bodies are compiled from AST. Only clocks and terminal table presentation
are intercepted; no mathematical expression is copied or reimplemented.
Private JSON outputs never form a runtime data source for the application.
"""
import argparse
import ast
import calendar
import datetime
import hashlib
import html
import json
import math
import mmap
from pathlib import Path
import re
import sys
import types
import typing
import warnings
import traceback

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reference_legacy import State, real_snapshot

warnings.filterwarnings('ignore', category=FutureWarning)
REFERENCE_DATE = datetime.date(2026, 10, 1)


def normalize(value):
    if isinstance(value, pd.DataFrame): return [normalize(row) for row in value.to_dict('records')]
    if isinstance(value, pd.Series): return {str(key): normalize(item) for key, item in value.items()}
    if value is pd.NaT or value is pd.NA: return None
    if isinstance(value, (datetime.date, datetime.datetime, pd.Timestamp)): return value.isoformat()
    if isinstance(value, dict):
        if 'node_id' in value and 'children' in value:
            if 'NS' not in value and 'NivelServico' in value: value['NS'] = value['NivelServico']
            keys = {'node_id','parent_id','col_name','name','level','children','Valor','Peso','Volume_M3','Qtde','NS','OTIF','Grupos_Atendidos','Qtd_Pedidos','Diff_Raw','Valor_Prev','% Part','Ticket','R$/Ton'}
            value = {key: item for key, item in value.items() if key in keys}
        return {str(key): normalize(item) for key, item in value.items() if not callable(item)}
    if isinstance(value, (list, tuple)): return [normalize(item) for item in value]
    if isinstance(value, set): return sorted(normalize(item) for item in value)
    if isinstance(value, np.ndarray): return normalize(value.tolist())
    if isinstance(value, np.generic): return normalize(value.item())
    if isinstance(value, float) and not math.isfinite(value): return None
    if isinstance(value, (str, int, float, bool)) or value is None: return value
    return None


def compact_existing_report(path):
    """Stream individual fields; never decode a complete oversized legacy report."""
    token = re.compile(rb'"(?:[^"\\]|\\.)*"|[{}\[\]]')
    def white(data, position):
        while data[position:position+1] in (b' ', b'\n', b'\r', b'\t'): position += 1
        return position
    def end_value(data, position):
        position = white(data, position)
        first = data[position:position+1]
        if first == b'"': return token.match(data, position).end()
        if first not in (b'{', b'['):
            return re.compile(rb'[,}\]]').search(data, position).start()
        depth = 0
        for match in token.finditer(data, position):
            char = data[match.start():match.start()+1]
            if char in (b'{', b'['): depth += 1
            elif char in (b'}', b']'):
                depth -= 1
                if depth == 0: return match.end()
        raise ValueError('Incomplete private oracle JSON')
    def fields(data, position):
        position = white(data, position) + 1
        while True:
            position = white(data, position)
            if data[position:position+1] == b'}': return
            key_match = token.match(data, position)
            key = json.loads(data[position:key_match.end()])
            start = white(data, key_match.end()) + 1
            start = white(data, start)
            end = end_value(data, start)
            yield key, start, end
            position = white(data, end)
            if data[position:position+1] == b',': position += 1
    report = {}; captures = {}
    with path.open('rb') as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
        for key, start, end in fields(data, 0):
            if key != 'captures': report[key] = json.loads(data[start:end]); continue
            for capture_key, capture_start, capture_end in fields(data, start):
                if data[capture_start:capture_start+1] != b'{':
                    captures[capture_key] = json.loads(data[capture_start:capture_end]); continue
                values = {}
                for name, value_start, value_end in fields(data, capture_start):
                    if name == 'publishedTables' or ('tree' in name.lower() and name != 'hier_tree'): continue
                    if name in {'summary_lookup', 'summary_curr', 'prev_summary', 'curr_summary', 'sd_df'}: continue
                    if name == 'clientes_df' and '.carteira.' in capture_key: continue
                    if name.startswith(('ly_raw', 'ly_full_raw', 'raw_')): continue
                    if value_end - value_start > 3_000_000 and name != 'hier_tree': continue
                    value = json.loads(data[value_start:value_end])
                    if isinstance(value, list) and value and isinstance(value[0], dict) and 'CODIGO_PEDIDO' in value[0] and any(column.startswith('VALOR_') and column.endswith('_CLEAN') for column in value[0]): continue
                    values[name] = normalize(value)
                captures[capture_key] = values
    report['captures'] = captures
    return report


class Surface:
    """No-op presentation surface with original widgets' default choices."""
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def __getattr__(self, name): return lambda *args, **kwargs: None


class Streamlit(types.ModuleType):
    def __init__(self):
        super().__init__('streamlit')
        self.session_state = State()
        self.choices = {}
    def __getattr__(self, name):
        if name.startswith('cache_'):
            return lambda *args, **kwargs: args[0] if args and callable(args[0]) else lambda fn: fn
        if name in ('columns', 'tabs'):
            return lambda spec, **kwargs: [Surface() for _ in range(spec if isinstance(spec, int) else len(spec))]
        if name in ('container', 'expander', 'spinner', 'popover'): return lambda *args, **kwargs: Surface()
        if name in ('segmented_control', 'radio', 'selectbox'):
            def widget(label, options, **kwargs):
                return self.choices.get(kwargs.get('key'), kwargs.get('default', options[kwargs.get('index', 0)]))
            return widget
        if name == 'button': return lambda *args, **kwargs: False
        if name == 'multiselect': return lambda *args, **kwargs: kwargs.get('default', [])
        if name == 'stop': return lambda: (_ for _ in ()).throw(RuntimeError('Original stopped: insufficient data'))
        return lambda *args, **kwargs: None


class FreezeClock(ast.NodeTransformer):
    def visit_ImportFrom(self, node):
        # The original imports presentation helpers only in the first customer tab,
        # creating unbound locals in the other tabs. Bind the identical helpers in
        # the oracle namespace so those original mathematical bodies can execute.
        if node.module == 'views.shared': return None
        return node
    def visit_Call(self, node):
        self.generic_visit(node)
        clock = ast.unparse(node.func)
        if clock == 'pd.Timestamp.now':
            return ast.copy_location(ast.Call(ast.Name('__reference_timestamp__', ast.Load()), [], []), node)
        if clock == 'datetime.date.today':
            return ast.copy_location(ast.Call(ast.Name('__reference_date__', ast.Load()), [], []), node)
        return node


def compile_original(root, filename, namespace, names=None):
    source = (root / filename).read_text(encoding='utf-8-sig')
    tree = ast.parse(source)
    body = []
    functions = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and (names is None or node.name in names):
            functions.append({'name': node.name, 'line': node.lineno, 'endLine': node.end_lineno})
            node.decorator_list = []
            body.append(FreezeClock().visit(node))
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            try:
                value = ast.literal_eval(node.value)
            except (ValueError, TypeError):
                continue
            for target in node.targets if isinstance(node, ast.Assign) else [node.target]:
                if isinstance(target, ast.Name): namespace[target.id] = value
    exec(compile(ast.fix_missing_locations(ast.Module(body=body, type_ignores=[])), str(root / filename), 'exec'), namespace)
    return {'file': filename, 'sha256': hashlib.sha256(source.encode()).hexdigest(), 'functions': functions}


def compile_original_prefix(root, filename, original_name, helper_name, cutoff_name, return_name, namespace):
    """Reuse a complete original mathematical prefix to expose a derived input frame."""
    tree = ast.parse((root / filename).read_text(encoding='utf-8-sig'))
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == original_name)
    cutoff = next(i for i, node in enumerate(function.body) if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id == cutoff_name)
    function.name = helper_name; function.decorator_list = []
    function.body = function.body[:cutoff] + [ast.Return(ast.Name(return_name, ast.Load()))]
    exec(compile(ast.fix_missing_locations(ast.Module(body=[FreezeClock().visit(function)], type_ignores=[])), str(root / filename), 'exec'), namespace)


def capture_values(values, excluded=()):
    result = {}
    for name, value in values.items():
        if name in excluded or callable(value) or isinstance(value, types.ModuleType): continue
        if name.startswith('__') or any(part in name.lower() for part in ('html', 'style', 'fig', 'cache')): continue
        if isinstance(value, str) and ('<style>' in value or len(value) > 1000): continue
        if isinstance(value, pd.DataFrame) and len(value) > 20000: continue
        if isinstance(value, pd.DataFrame) and 'CODIGO_PEDIDO' in value.columns and any(column.startswith('VALOR_') and column.endswith('_CLEAN') for column in value.columns): continue
        if isinstance(value, (pd.DataFrame, pd.Series)) and name in {'df','df_calc','df_ev','df_month','df_valid','valid_df','df_valid_dates','df_curr_year','df_base','df_data_curr','df_data_curr_slim','df_slim','base_ly_valid','df_ly_pre','df_ly_filtered','df_ly_use','raw_ly','raw_ly2','raw_base','base_to_use','dt_series','mes_num_series'}: continue
        if isinstance(value, pd.Series) and len(value) > 20000: continue
        normalized = normalize(value)
        if normalized is not None: result[name] = normalized
    return result


def execute_capture(function, *args, **kwargs):
    captured = {}
    argument_names = set(function.__code__.co_varnames[:function.__code__.co_argcount])
    def profile(frame, event, value):
        if event == 'return' and frame.f_code is function.__code__:
            captured.update(capture_values(frame.f_locals, argument_names))
    previous = sys.getprofile()
    sys.setprofile(profile)
    try:
        result = function(*args, **kwargs)
        if result is not None: captured['return'] = normalize(result)
    finally:
        sys.setprofile(previous)
    return captured


def date_only_rows(frame):
    frame = frame.copy()
    for column in frame.columns:
        if pd.api.types.is_datetime64_any_dtype(frame[column]):
            frame[column] = frame[column].dt.strftime('%Y-%m-%d').where(frame[column].notna(), None)
    return normalize(frame)


def write_catalog(root, destination, sources, captures, errors):
    """Inventory exact original assignment expressions and UI actions with stable IDs."""
    lines = ['# Catálogo de equivalência do legacy', '',
        'Fonte vinculante: `../legacy`, somente leitura. Três áreas: abertos, emitidos e faturados.',
        'As expressões abaixo são extraídas do AST original; não são fórmulas propostas para a migração.', '',
        'A referência privada `.local/domain-reference.json` executa funções originais contra a versão publicada pelo Hop,',
        'com relógio fixado em 01/10/2026. Não existe fixture sintética nem fallback de dados.', '',
        '## Precisão, ausências e granularidade', '',
        '- Valores financeiros são float64; peso, cubagem, quantidade, serviço e OTIF seguem os float32 do `_process_*` original.',
        '- Somatórios/médias pandas preservam dtype, redução e arredondamento originais. Comparação financeira: centavos; contagens: exata; float32: tolerância compatível com redução pandas, registrada pelos testes de domínio.',
        '- Numéricos inválidos/nulos são limpos para zero no loader; groupby e nunique excluem nulos conforme pandas. Datas inválidas são NaT; JSON representa ausência/não finito por null.',
        '- Média de serviço/OTIF é por registro; pedidos e grupos usam distintos. O total de dimensões soma distintos calculados por grupo quando o original o faz.',
        '- Guardas de denominador, replace(0,1), fillna, arredondamentos e limites permanecem nas expressões originais abaixo; não há regra global que os substitua.',
        '- Datas das fixtures usam YYYY-MM-DD; cubagem reproduz a saída original corrigida e sua limpeza posterior; emissões futuras e tekdashboard são excluídos pelo loader original.', '',
        '## Escopo da evidência', '',
        'Fixtures comerciais: linhas reais de agosto/2026; `normalized-history-*` contém agosto/2025 e agosto/2026 para comparação anual.',
        'Abertos, cadastro completo e metas: publicação completa. Capturas sem `agosto` usam o histórico completo publicado.',
        'A coluna “captura” identifica evidência executada do original, não certifica implementação equivalente na aplicação.',
        'Adaptações da execução: relógio fixo, apresentação terminal suprimida e imports de `views.shared` disponibilizados globalmente.',
        'O último ajuste permite executar as fórmulas das abas avançadas cujo legacy lança UnboundLocalError por importar os helpers apenas na primeira aba (`views/visao_geral.py:389`, chamadas em 476/611/699). O original permanece intacto.',
        'A referência comercial compacta fica em `.local/normalized-reference-comercial.json`; árvores canônicas em `.local/normalized-reference-trees.json`. Aliases de valores idênticos nas árvores são omitidos; métricas, hierarquia e limites originais são preservados.',
        f'Execução do original: {len(captures)} capturas; {len(errors)} erros. Equivalência da aplicação depende dos testes de domínio e interface.', '',
        '## Saídas e cálculos rastreáveis', '',
        '| ID | Saída/local original | Expressão original / regra | Fonte e linha | Captura |',
        '|---|---|---|---|---|']
    def safe(text): return str(text).replace('|', '&#124;').replace('\n', ' ').replace('`', '\\`')
    for source in sources:
        filename = source['file']
        text = (root / filename).read_text(encoding='utf-8-sig')
        tree = ast.parse(text)
        allowed = {function['name'] for function in source['functions']}
        family = Path(filename).stem
        areas = ['abertos'] if family.startswith('pedidos_em_aberto') else ['emitidos'] if family == 'consultor_metas' else ['emitidos', 'faturados'] if filename.startswith('views/') else ['comum']
        for function in [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in allowed]:
            found = set()
            for node in ast.walk(function):
                if not isinstance(node, (ast.Assign, ast.AnnAssign)): continue
                expression = ast.unparse(node.value)
                if isinstance(node.value, ast.Dict) and all(isinstance(value, ast.Constant) and isinstance(value.value, str) for value in node.value.values): continue
                if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str): continue
                if any(fragment in expression for fragment in ('<style>', '<div', '<p ', 'go.Figure', 'go.Bar', 'go.Scatter', 'px.', 'st.markdown')): continue
                if not any(fragment in expression for fragment in ('.sum(', '.mean(', '.nunique(', '.groupby(', '.agg(', '.cumsum(', '.qcut(', '.cut(', '.pivot(', ' / ', ' * ', ' - ', ' + ', 'round(', 'calcular_status_clientes(', 'build_consultant_goal', '_get_best_worst(', 'classify_tier(', 'build_multi_level_tree(', 'count_dias_uteis_mes(', 'load_faturamento_media_diaria_90(')) and not isinstance(node.value, ast.Dict) and not any(isinstance(target, ast.Subscript) for target in (node.targets if isinstance(node, ast.Assign) else [node.target])): continue
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                for target in targets:
                    name = ast.unparse(target)
                    if any(part in name.lower() for part in ('html', 'style', 'fig', 'cache', 'col_specs', 'cols_to_use')): continue
                    if name in found: continue
                    found.add(name)
                    entries = [(name, expression, node.lineno)]
                    if isinstance(node.value, ast.Dict):
                        entries += [(f'{name}.{key.value}', ast.unparse(value), value.lineno) for key, value in zip(node.value.keys, node.value.values) if isinstance(key, ast.Constant) and isinstance(key.value, str)]
                    for output, formula, line in entries:
                        for area in areas:
                            identifier = f'{area}.{family}.{function.name}.{output}'
                            evidence = [key for key, values in captures.items() if (area == 'comum' or key.startswith(area + '.')) and name in values]
                            lines.append(f'| `{safe(identifier)}` | `{safe(output)}` | `{safe(formula)}` | `{filename}:{line}` | {safe(", ".join(evidence[:3]) or "ver função/tabela na referência")} |')
            for node in ast.walk(function):
                if isinstance(node, ast.Dict):
                    fields = {key.value: value for key, value in zip(node.keys, node.values) if isinstance(key, ast.Constant) and isinstance(key.value, str)}
                    if 'name' in fields and 'key' in fields and isinstance(fields['key'], ast.Constant):
                        output = str(fields['key'].value)
                        label = ast.unparse(fields['name'])
                        formatting = ast.unparse(fields['format']) if 'format' in fields else ast.unparse(fields.get('type', ast.Constant('original')))
                        for area in areas:
                            identifier = f'{area}.{family}.{function.name}.coluna.{output}'
                            lines.append(f'| `{safe(identifier)}` | {safe(label)} / `{safe(output)}` | Formatação `{safe(formatting)}`; cálculo na coluna/agrupamento original acima | `{filename}:{node.lineno}` | tabela original da função |')
    lines.extend(['', '## Matriz de ações original', '', '| ID | Ação | Fonte e linha | Regra |', '|---|---|---|---|'])
    files = ['dashboard.py', 'data_loader.py', 'utils.py'] + [source['file'] for source in sources if source['file'].startswith('views/')]
    actions = {'multiselect', 'segmented_control', 'selectbox', 'radio', 'button', 'download_button', 'date_input', 'number_input', 'text_input', 'checkbox', 'toggle', 'slider'}
    for filename in dict.fromkeys(files):
        tree = ast.parse((root / filename).read_text(encoding='utf-8-sig'))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in actions:
                expression = ast.unparse(node)
                lines.append(f'| `acao.{Path(filename).stem}.{node.func.attr}.{node.lineno}` | {node.func.attr} | `{filename}:{node.lineno}` | `{safe(expression)}` |')
    for action, pattern in [('ordenacao', 'sortTable'), ('hierarquia', 'row-expander'), ('exportacao', 'export'), ('pesquisa', 'search'), ('paginacao', 'page'), ('colunas', 'drag-over'), ('drilldown', 'HIERARCHY_DRILLDOWN_MAP')]:
        source_lines = (root / 'views/shared.py').read_text(encoding='utf-8-sig').splitlines()
        line = next((i + 1 for i, text in enumerate(source_lines) if pattern.lower() in text.lower()), None)
        if line: lines.append(f'| `acao.shared.{action}` | {action} | `views/shared.py:{line}` | Implementação original da tabela; verificar navegação/estado/exportação com dados reais. |')
    lines.extend(['', '## Limites e rastreabilidade', '',
        'A limpeza e as cinco consultas completas são conferidas separadamente pelo contrato ETL e pela carga Hop.',
        'Casos de fronteira sem ocorrência na publicação não são exercitados por dados inventados.',
        'A lista inclui variáveis intermediárias e colunas agregadas para não ocultar cálculos posteriores aos cards.',
        'HTML/CSS, objetos Plotly e funções de apresentação não são cálculos de domínio; widgets são inventariados como ações.',
        'Os testes de domínio comparam valores e tabelas da aplicação às capturas; os testes de UI devem cobrir a matriz de ações.'])
    destination.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--legacy-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--resume', action='store_true', help='Retain successful captures for the same published snapshot')
    parser.add_argument('--resume-local', action='store_true', help='Use the previously exported same-version real processed frames for missing captures')
    parser.add_argument('--compact-existing', action='store_true', help='Compact existing private reference without querying PostgreSQL')
    parser.add_argument('--export-commercial', action='store_true', help='Refresh only the compact commercial capture file')
    args = parser.parse_args()
    root = args.legacy_root.resolve()
    if args.compact_existing or args.export_commercial:
        report = compact_existing_report(args.output) if args.compact_existing else json.loads(args.output.read_text(encoding='utf-8'))
        if args.compact_existing:
            trees = {}
            for key, values in report['captures'].items():
                if not isinstance(values, dict): continue
                for name in list(values):
                    if 'tree' in name.lower(): trees[f'{key}.{name}'] = values.pop(name)
            if trees:
                (args.output.parent / 'normalized-reference-trees.json').write_text(json.dumps({'version': report['version'], 'source': report['source'], 'synthetic': False, 'captures': trees}, ensure_ascii=False, allow_nan=False), encoding='utf-8')
                report['treeCaptures'] = {'file': 'normalized-reference-trees.json', 'keys': list(trees)}
            args.output.write_text(json.dumps(report, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        compact = {**report, 'captures': {key: {name: value for name, value in values.items() if 'tree' not in name.lower() and name != 'publishedTables'} for key, values in report['captures'].items() if '.agosto.' in key or key.endswith('.carteira')}}
        (args.output.parent / 'normalized-reference-comercial.json').write_text(json.dumps(compact, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        if args.compact_existing: write_catalog(root, Path(__file__).resolve().parents[1] / 'docs/catalogo-equivalencia.md', report['sources'], report['captures'], report['errors'])
        print(f'Compacted original oracle: {args.output.stat().st_size} bytes')
        return
    if args.resume_local:
        if not args.resume: parser.error('--resume-local requires --resume')
        prior = json.loads(args.output.read_text(encoding='utf-8'))
        version = prior['version']; frames = {}
        for area in ('abertos', 'emitidos', 'faturados', 'carteira', 'metas'):
            filename = f'normalized-full-{area}.json' if area in ('emitidos', 'faturados') else f'normalized-{area}.json'
            frames[area] = pd.read_json(args.output.parent / filename)
            for column in frames[area].columns:
                if column.endswith('_DATE'): frames[area][column] = pd.to_datetime(frames[area][column], errors='coerce')
                if column.endswith('_CLEAN'): frames[area][column] = frames[area][column].astype('float64' if column.startswith('VALOR_') else 'float32')
                if column in ('GRUPO_CLIENTE', 'UF', 'CONSULTOR', 'SUPERVISOR'): frames[area][column] = frames[area][column].astype('category')
        # The slim emission cache keeps mapped columns. Recover the identical
        # original aliases by reading the mapping assignments, without formulas.
        mapping_tree = ast.parse((root / 'views/pedidos_emitidos.py').read_text(encoding='utf-8-sig'))
        mapping = next(node for node in mapping_tree.body if isinstance(node, ast.FunctionDef) and node.name == 'prepare_mapped_dataframe')
        for node in ast.walk(mapping):
            if not isinstance(node, ast.Assign) or not isinstance(node.targets[0], ast.Subscript) or not isinstance(node.value, ast.Subscript): continue
            mapped = node.targets[0].slice; native = node.value.slice
            if isinstance(mapped, ast.Constant) and isinstance(native, ast.Constant) and mapped.value in frames['emitidos'].columns and native.value not in frames['emitidos'].columns:
                frames['emitidos'][native.value] = frames['emitidos'][mapped.value]
    else:
        frames, version = real_snapshot()
    st = Streamlit()
    sys.modules['streamlit'] = st
    namespace = {'pd': pd, 'st': st, 'go': go, 'px': px, 'make_subplots': make_subplots,
                 'math': math, 'calendar': calendar, 'datetime': datetime, 're': re, 'html_lib': html,
                 'Any': typing.Any, 'Iterable': typing.Iterable, 'Mapping': typing.Mapping,
                 '__reference_timestamp__': lambda: pd.Timestamp(REFERENCE_DATE),
                 '__reference_date__': lambda: REFERENCE_DATE}
    sources = []
    compile_original(root, 'config.py', namespace)
    sources.append(compile_original(root, 'utils.py', namespace))
    sources.append(compile_original(root, 'consultor_metas.py', namespace))
    selected = {'clean_num', '_process_faturamento_df', '_process_pedidos_abertos_df', '_process_pedidos_emitidos_df',
                'apply_active_filters', 'apply_active_filters_dict', 'get_active_filters_dict',
                'load_faturamento_media_diaria_90', 'calcular_status_clientes'}
    sources.append(compile_original(root, 'data_loader.py', namespace, selected))
    namespace['_FLT_COLS'] = namespace['FLT_COLS']
    namespace['_RFM_CACHE'] = {}
    for area, function in [('abertos', '_process_pedidos_abertos_df'), ('emitidos', '_process_pedidos_emitidos_df'), ('faturados', '_process_faturamento_df')]:
        if not args.resume_local: frames[area] = namespace[function](frames[area])
    sources.append(compile_original(root, 'views/pedidos_emitidos.py', namespace, {'prepare_mapped_dataframe'}))
    if not args.resume_local: frames['emitidos'] = namespace['prepare_mapped_dataframe'](frames['emitidos'])
    namespace.update({'load_data': lambda: frames['faturados'].copy(), 'load_carteira': lambda: frames['carteira'].copy(),
                      'load_pedidos_emitidos': lambda: frames['emitidos'].copy(), 'load_pedidos_abertos': lambda: frames['abertos'].copy(),
                      'get_filtered_pedidos_abertos': lambda frame: namespace['apply_active_filters'](frame),
                      'load_metas_consultores': lambda: frames['metas'].copy()})
    loader = types.ModuleType('data_loader')
    loader.__dict__.update(namespace)
    sys.modules['data_loader'] = loader
    views = types.ModuleType('views'); views.__path__ = []
    sys.modules['views'] = views
    namespace['views'] = views
    mapped = types.ModuleType('views.pedidos_emitidos'); mapped.__dict__.update(namespace)
    sys.modules['views.pedidos_emitidos'] = mapped
    sources.append(compile_original(root, 'views/shared.py', namespace, {'clean_icon_prefix', 'build_multi_level_tree', '_compute_ly_prev_summary', 'render_dimension_analysis_visual', 'render_dim_analysis'}))
    table_calls = []
    def render_table(*args, **kwargs):
        table_calls.append(capture_values(kwargs))
    namespace['render_sortable_table'] = render_table
    # Pagination and HTML are presentation only; preserve computed input tables.
    namespace['render_paginated_dataframe'] = render_table
    shared = types.ModuleType('views.shared'); shared.__dict__.update(namespace)
    sys.modules['views.shared'] = shared
    for filename in ('pedidos_em_aberto_charts', 'pedidos_em_aberto', 'acompanhamento', 'evolucao_mensal', 'visao_geral', 'semana_anterior', 'analise_geografica'):
        sources.append(compile_original(root, f'views/{filename}.py', namespace))
        module = types.ModuleType(f'views.{filename}'); module.__dict__.update(namespace)
        setattr(views, filename, module); sys.modules[f'views.{filename}'] = module
    namespace['_render_metric_card'] = namespace['render_simple_metric_card']
    namespace['_render_dual_metric_card'] = namespace['render_dual_metric_card']
    namespace['_render_acompanhamento_card'] = namespace['render_metric_card']
    namespace['_render_dual_acompanhamento_card'] = namespace['render_dual_metric_card']
    compile_original_prefix(root, 'views/shared.py', 'render_dim_analysis', 'build_dimension_history', 'dim_dict', 'df_ly_pre', namespace)
    compile_original_prefix(root, 'views/pedidos_em_aberto.py', 'render_pedidos_em_aberto', 'prepare_open_frame', 'cards_html', 'df_abertos', namespace)
    goals = json.loads((root / 'data/metas.json').read_text(encoding='utf-8'))
    previous = json.loads(args.output.read_text(encoding='utf-8')) if args.resume and args.output.exists() else {}
    captures = previous.get('captures', {}) if previous.get('version') == version else {}
    if args.resume:
        if previous.get('capturePolicyVersion', 0) < 4:
            captures = {key: value for key, value in captures.items() if not key.endswith(('.agosto.mensal', '.agosto.evolucao'))}
        for key, values in captures.items():
            if not isinstance(values, dict): continue
            values.pop('publishedTables', None)
            for variable in list(values):
                value = values[variable]
                if isinstance(value, list) and value and isinstance(value[0], dict) and 'CODIGO_PEDIDO' in value[0] and any(column.startswith('VALOR_') and column.endswith('_CLEAN') for column in value[0]): values.pop(variable)
        captures = normalize(captures)
    errors = []
    args.output.parent.mkdir(parents=True, exist_ok=True)
    scope = {}
    subsets = {}; histories = {}
    for area, frame in frames.items():
        date_col = 'DATA_EMISSAO_PEDIDO_DATE' if area == 'emitidos' else 'DT_FATURA_DATE'
        subset = pd.read_json(args.output.parent / f'normalized-{area}.json') if args.resume_local and area in ('emitidos','faturados') else frame[frame[date_col].between('2026-08-01', '2026-08-31')].copy() if area in ('emitidos', 'faturados') else frame.copy()
        if args.resume_local and area in ('emitidos','faturados'):
            for column in subset.columns:
                if column.endswith('_DATE'): subset[column] = pd.to_datetime(subset[column], errors='coerce')
                if column.endswith('_CLEAN'): subset[column] = subset[column].astype('float64' if column.startswith('VALOR_') else 'float32')
                if column in ('GRUPO_CLIENTE', 'UF', 'CONSULTOR', 'SUPERVISOR'): subset[column] = subset[column].astype('category')
        subsets[area] = subset
        scope[area] = {'wholeRows': len(frame), 'fixtureRows': len(subset), 'fixturePeriod': '2026-08' if area in ('emitidos', 'faturados') else 'whole'}
        fixture_path = args.output.parent / f'normalized-{area}.json'
        if not (args.resume and previous.get('version') == version and fixture_path.exists()):
            fixture_path.write_text(json.dumps(date_only_rows(subset), ensure_ascii=False, allow_nan=False), encoding='utf-8')
        if area in ('emitidos', 'faturados'):
            history = frame[(frame[date_col].dt.month == 8) & frame[date_col].dt.year.isin([2025, 2026])]
            histories[area] = pd.read_json(args.output.parent / f'normalized-history-{area}.json') if args.resume_local else history
            if args.resume_local:
                for column in histories[area].columns:
                    if column.endswith('_DATE'): histories[area][column] = pd.to_datetime(histories[area][column], errors='coerce')
                    if column.endswith('_CLEAN'): histories[area][column] = histories[area][column].astype('float64' if column.startswith('VALOR_') else 'float32')
                    if column in ('GRUPO_CLIENTE', 'UF', 'CONSULTOR', 'SUPERVISOR'): histories[area][column] = histories[area][column].astype('category')
            history_path = args.output.parent / f'normalized-history-{area}.json'
            if not (args.resume and previous.get('version') == version and history_path.exists()):
                history_path.write_text(json.dumps(date_only_rows(history), ensure_ascii=False, allow_nan=False), encoding='utf-8')
            full_columns = ['GRUPO_CLIENTE','CODIGO_PEDIDO','DT_FATURA_DATE','DATA_EMISSAO_PEDIDO_DATE','VALOR_FATURADO_CLEAN','PESO_FATURADO_CLEAN','QUANTIDADE_FATURADA_CLEAN','VOLUME_M3_FATURADO_CLEAN','NIVEL_DE_SERVICO_CLEAN','ON_TIME_CLEAN','UF']
            full_path = args.output.parent / f'normalized-full-{area}.json'
            if not (args.resume and previous.get('version') == version and full_path.exists()):
                full_path.write_text(json.dumps(date_only_rows(frame[[column for column in full_columns if column in frame.columns]]), ensure_ascii=False, allow_nan=False), encoding='utf-8')
    def publish():
        args.output.write_text(json.dumps({'source': 'firebird/apache-hop', 'synthetic': False, 'version': version,
            'referenceDate': str(REFERENCE_DATE), 'scope': scope, 'sources': sources, 'captures': captures,
            'capturePolicyVersion': 4,
            'executionAdaptations': ['clock frozen at referenceDate', 'HTML/Streamlit terminal presentation suppressed', 'views.shared presentation imports bound globally to exercise originally unbound advanced customer tabs'],
            'errors': errors}, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    def run(key, function, *arguments, **kwargs):
        if args.resume and key in captures: return
        st.session_state.clear(); table_calls.clear()
        if '.agosto.' in key:
            st.session_state['flt_em' if key.startswith('emitidos.') else 'flt_fat'] = (pd.Timestamp('2026-08-01'), pd.Timestamp('2026-08-31'))
        try:
            captures[key] = execute_capture(namespace[function], *arguments, **kwargs)
            if table_calls:
                captures[key]['publishedTables'] = [{name: value for name, value in table.items() if name not in {'df_data','hierarchy_tree'}} for table in table_calls]
            print(f'Captured {key}', flush=True)
        except Exception as error:
            errors.append({'capture': key, 'error': f'{type(error).__name__}: {error}'})
            print(f'FAILED {key}: {type(error).__name__}: {error}', flush=True)
            traceback.print_exc()
        publish()
    for area in ('emitidos', 'faturados'):
        frame = frames[area]
        for tab, function, arguments in (
            ('mensal', 'render_acompanhamento', (frame, frame, goals, area == 'emitidos')),
            ('evolucao', 'render_evolucao_mensal', (frame, area == 'emitidos', frame)),
            ('carteira', 'render_visao_geral', (frame, area == 'emitidos')),
            ('semanal', 'render_semana_anterior', (frame, area == 'emitidos')),
            ('geografia', 'render_analise_geografica', (frame, area == 'emitidos'))):
            run(f'{area}.{tab}', function, *arguments)
            arguments = tuple(subsets[area] if value is frame else value for value in arguments)
            if tab == 'mensal': arguments = (subsets[area], histories[area], goals, area == 'emitidos')
            if tab == 'evolucao': arguments = (subsets[area], area == 'emitidos', histories[area])
            run(f'{area}.agosto.{tab}', function, *arguments)
            if tab == 'carteira':
                for choice in ('Oportunidades', 'Qualidade da Carteira', 'Cobertura por UF'):
                    st.choices = {'visao_geral_seg_ctrl': choice}
                    run(f'{area}.carteira.{choice}', function, frame, area == 'emitidos')
                    run(f'{area}.agosto.carteira.{choice}', function, subsets[area], area == 'emitidos')
                st.choices = {}
            if tab == 'semanal':
                for choice in ('Semana Anterior', 'Semana Retrasada'):
                    st.choices = {'sem_top_seg': choice, 'sem_sup_seg': choice}
                    run(f'{area}.semanal.{choice}', function, frame, area == 'emitidos')
                    run(f'{area}.agosto.semanal.{choice}', function, subsets[area], area == 'emitidos')
                st.choices = {}
        dimension_history = namespace['build_dimension_history'](frame, is_emissao=area == 'emitidos', raw_base=frame, context_prefix=area)
        for dimension in list(namespace['HIERARCHY_DRILLDOWN_MAP']) + ['CIDADE', 'MICRO_REGIAO']:
            if dimension in frame.columns:
                run(f'{area}.dimensao.{dimension}', 'render_dimension_analysis_visual', frame, dimension, dimension, is_emissao=area == 'emitidos', df_ly_precalculated=dimension_history, context_prefix=f'{area}.{dimension}')
    run('abertos.resumo', 'render_pedidos_em_aberto')
    prepared_open = namespace['prepare_open_frame']()
    for label, function in [('aging', '_render_aging_donut'), ('evolucao', '_render_backlog_evolution'), ('status', '_render_status_bars'),
                            ('entrega', '_render_entrega_donut'), ('entrega_cards', '_render_entrega_cards'), ('mapa', '_render_mapa_brasil'),
                            ('status_resumo', '_render_status_summary_chart'), ('previsao', '_render_previsao_faturamento_chart'), ('previsao_status', '_render_previsao_status_donut')]:
        run(f'abertos.{label}', function, prepared_open)
    for dimension in ('Mes_Grupo', 'Aging_Bucket', 'Mes_Previsao', 'Status_Previsao', 'Canal', 'UF', 'REGIAO_UF', 'CIDADE', 'MICRO_REGIAO', 'SUPERVISOR', 'CONSULTOR', 'GRUPO_CLIENTE', 'LINHA', 'GRUPO_ITEM', 'SUBGRUPO', 'TIPO', 'COLECAO', 'CLASSIFICACAO', 'ORIGEM', 'ORGAO', 'STATUS', 'TIPO_ENTREGA', 'DESCRICAO_ITEM'):
        if dimension in prepared_open.columns:
            run(f'abertos.dimensao.{dimension}', 'render_summary_table', prepared_open, dimension, dimension)
    for mode in ('geral', 'real'):
        captures[f'abertos.calendario.{mode}'] = normalize(namespace['build_forecast_calendar'](namespace['filter_forecast_backlog'](frames['abertos'], mode), 2026, 10))
    max_date = frames['emitidos']['DATA_EMISSAO_PEDIDO_DATE'].max()
    month_rows = frames['emitidos'][frames['emitidos']['DATA_EMISSAO_PEDIDO_DATE'].dt.to_period('M') == max_date.to_period('M')]
    run('emitidos.metas', '_build_consultant_goal_dataframe', month_rows, frames['metas'], max_date)
    run('emitidos.agosto.metas', '_build_consultant_goal_dataframe', subsets['emitidos'], frames['metas'], pd.Timestamp('2026-08-31'))
    august_ranking = namespace['_build_consultant_goal_dataframe'](subsets['emitidos'], frames['metas'], pd.Timestamp('2026-08-31'))
    run('emitidos.agosto.metas_total', '_build_consultant_goal_total', august_ranking)
    publish()
    write_catalog(root, Path(__file__).resolve().parents[1] / 'docs/catalogo-equivalencia.md', sources, captures, errors)
    print(f'Real original oracle: {len(captures)} captures; {len(errors)} errors.', flush=True)
    if errors: raise SystemExit(1)


if __name__ == '__main__': main()

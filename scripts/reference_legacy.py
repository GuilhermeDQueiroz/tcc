"""Execute original mathematical blocks against a real published Hop snapshot.

The AST retains the original statements and stops before HTML/chart construction.
The captured locals are the oracle; formulas are not reimplemented here.
"""
import argparse
import ast
import datetime
import hashlib
import json
import math
import os
import psycopg2
from pathlib import Path
import sys
import types
import warnings

import pandas as pd

warnings.filterwarnings('ignore', category=FutureWarning)


class State(dict):
    __getattr__ = dict.get
    def __setattr__(self, key, value):
        self[key] = value


class Streamlit(types.ModuleType):
    def __init__(self):
        super().__init__('streamlit')
        self.session_state = State()
    def __getattr__(self, name):
        if name.startswith('cache_'):
            def decorator(*args, **kwargs):
                return args[0] if args and callable(args[0]) else lambda fn: fn
            return decorator
        if name == 'stop':
            return lambda: (_ for _ in ()).throw(RuntimeError('Dataset insuficiente para a referência'))
        return lambda *args, **kwargs: None


def normalize(value):
    if isinstance(value, pd.DataFrame):
        return [{str(k): normalize(v) for k, v in row.items()} for row in value.to_dict('records')]
    if isinstance(value, pd.Series):
        return {str(k): normalize(v) for k, v in value.items()}
    if value is pd.NaT or value is pd.NA:
        return None
    if isinstance(value, (datetime.date, datetime.datetime, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): normalize(v) for k, v in value.items() if not callable(v)}
    if isinstance(value, (list, tuple)):
        return [normalize(v) for v in value]
    if isinstance(value, set):
        return sorted(normalize(v) for v in value)
    if hasattr(value, 'item'):
        return normalize(value.item())
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return None


def assigned_name(node):
    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    return None


def capture_locals(values):
    """Keep calculated scalars and aggregate tables; do not duplicate raw ERP datasets."""
    tables = {'daily_df', 'mensal', 'clientes_df'}
    result = {}
    for name, value in values.items():
        if name.endswith('html') or callable(value):
            continue
        if isinstance(value, pd.DataFrame) and name not in tables:
            continue
        if isinstance(value, pd.Series) and len(value) > 366:
            continue
        normalized = normalize(value)
        if normalized is not None:
            result[name] = normalized
    return result


def original_functions(root, filename, namespace, names=None, stops=None):
    source = (root / filename).read_text(encoding='utf-8-sig')
    tree = ast.parse(source)
    selected = []
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef) or (names is not None and node.name not in names):
            continue
        node.decorator_list = []
        if stops and node.name in stops:
            cutoff = next(i for i, statement in enumerate(node.body) if assigned_name(statement) == stops[node.name])
            node.body = node.body[:cutoff] + [ast.Return(ast.Call(ast.Name('locals', ast.Load()), [], []))]
        selected.append(node)
    module = ast.fix_missing_locations(ast.Module(body=selected, type_ignores=[]))
    exec(compile(module, str(root / filename), 'exec'), namespace)
    return {'file': filename, 'sha256': hashlib.sha256(source.encode()).hexdigest(), 'functions': [n.name for n in selected]}


def real_snapshot():
    connection = psycopg2.connect(host=os.environ['PG_HOST'], port=os.environ['PG_PORT'], dbname='dados', user=os.environ['PG_USER'], password=os.environ['PG_PASSWORD'])
    connection.set_session(readonly=True, isolation_level='REPEATABLE READ')
    frames = {}
    contract=json.loads((Path(__file__).resolve().parents[1]/'etl/contrato-colunas-dw.json').read_text(encoding='utf-8'))
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id::text FROM etl.execucao_carga WHERE status='publicado' ORDER BY fim DESC LIMIT 1")
            version = cursor.fetchone()
            if not version: raise RuntimeError('Nenhuma carga Hop publicada')
            for area, view in {'abertos':'pedidos_abertos','emitidos':'pedidos_emitidos','faturados':'pedidos_faturados','carteira':'carteira_clientes','metas':'metas_consultores'}.items():
                columns=contract['areas'][area]['columns']
                names={c['legacy']:c['name'] for c in columns}
                # The reference consumes the old extractor output, whose volume was overwritten.
                projection=', '.join('"'+(names.get(c['legacy']+'_CLEAN',c['name']) if c['legacy'].startswith('VOLUME_M3') and not c['legacy'].endswith('_CLEAN') else c['name'])+'" AS "'+c['legacy']+'"' for c in columns)
                cursor.execute('SELECT '+projection+' FROM dw.' + view + (' ORDER BY registro_id' if area in ('abertos','emitidos','faturados') else ''))
                columns = [c[0].upper() for c in cursor.description]
                frames[area] = pd.DataFrame(cursor.fetchall(), columns=columns)
        return frames, version[0]
    finally:
        connection.rollback(); connection.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--legacy-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.legacy_root.resolve()
    frames, version = real_snapshot()
    goals_config = json.loads((root / 'data/metas.json').read_text(encoding='utf-8'))
    st = Streamlit()
    sys.modules['streamlit'] = st
    loader = types.ModuleType('data_loader')
    sys.modules['data_loader'] = loader
    # Extract functions only: connection configuration/imports never execute.
    namespace = {'pd': pd, 'st': st, 'datetime': datetime, 'calendar': __import__('calendar'),
                 're': __import__('re'), 'Any': __import__('typing').Any,
                 'Iterable': __import__('collections').abc.Iterable,
                 'Mapping': __import__('collections').abc.Mapping}
    sources = []
    sources.append(original_functions(root, 'utils.py', namespace,
        {'fmt_brl','fmt_num','fmt_peso','fmt_m3','format_mes_ano','classify_tier','get_easter','get_feriados_nacionais','is_dia_util','count_dias_uteis_mes'}))
    sources.append(original_functions(root, 'consultor_metas.py', namespace))
    namespace['FLT_COLS'] = ['UF','REGIAO_UF','CIDADE','MICRO_REGIAO','SUPERVISOR','CONSULTOR','TIPO_ENTREGA','CLASSIFICACAO','STATUS','GRUPO_ITEM','LINHA','SUBGRUPO','TIPO','COLECAO']
    namespace['_FLT_COLS'] = namespace['FLT_COLS']
    namespace['_RFM_CACHE'] = {}
    sources.append(original_functions(root, 'data_loader.py', namespace,
        {'clean_num','_process_faturamento_df','_process_pedidos_abertos_df','_process_pedidos_emitidos_df','apply_active_filters','load_faturamento_media_diaria_90','calcular_status_clientes'}))
    for name in ('apply_active_filters', 'load_faturamento_media_diaria_90', 'calcular_status_clientes'):
        setattr(loader, name, namespace[name])
    frames['abertos'] = namespace['_process_pedidos_abertos_df'](frames['abertos'])
    frames['emitidos'] = namespace['_process_pedidos_emitidos_df'](frames['emitidos'])
    frames['faturados'] = namespace['_process_faturamento_df'](frames['faturados'])
    sources.append(original_functions(root, 'views/pedidos_emitidos.py', namespace, {'prepare_mapped_dataframe'}))
    frames['emitidos'] = namespace['prepare_mapped_dataframe'](frames['emitidos'])
    namespace['load_data'] = lambda: frames['faturados'].copy()
    namespace['load_carteira'] = lambda: frames['carteira'].copy()
    namespace['get_filtered_pedidos_abertos'] = lambda df: df.copy()
    namespace['load_pedidos_abertos'] = lambda: frames['abertos'].copy()
    namespace['MONTH_NAMES'] = dict(enumerate(['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'], 1))
    sources.append(original_functions(root, 'views/pedidos_em_aberto.py', namespace,
        {'render_pedidos_em_aberto'}, {'render_pedidos_em_aberto': 'cards_html'}))
    sources.append(original_functions(root, 'views/pedidos_em_aberto_charts.py', namespace,
        {'filter_forecast_backlog','build_forecast_calendar'}))
    namespace['BACKLOG_REAL_STATUSES'] = ('DOCUMENTO EM CARGA','LOGÍSTICA','LOGISTICA','FATURADO PARCIAL','DOCUMENTO LIBERADO')
    sources.append(original_functions(root, 'views/acompanhamento.py', namespace,
        {'render_acompanhamento'}, {'render_acompanhamento': 'card_base_style'}))
    sources.append(original_functions(root, 'views/evolucao_mensal.py', namespace,
        {'render_evolucao_mensal','_get_best_worst'}, {'render_evolucao_mensal': 'card_base_style'}))
    sources.append(original_functions(root, 'views/visao_geral.py', namespace,
        {'render_visao_geral'}, {'render_visao_geral': 'card_style'}))
    sources.append(original_functions(root, 'views/semana_anterior.py', namespace,
        {'render_semana_anterior'}, {'render_semana_anterior': 'card_base_style'}))
    sources.append(original_functions(root, 'views/analise_geografica.py', namespace,
        {'render_analise_geografica'}, {'render_analise_geografica': 'card_base_geo'}))
    captures = {}
    for area in ('emitidos','faturados'):
        df = frames[area]
        for tab, function, arguments in (
            ('mensal','render_acompanhamento',(df, df, goals_config, area == 'emitidos')),
            ('evolucao','render_evolucao_mensal',(df, area == 'emitidos', df)),
            ('carteira','render_visao_geral',(df, area == 'emitidos')),
            ('semanal','render_semana_anterior',(df, area == 'emitidos')),
            ('geografia','render_analise_geografica',(df, area == 'emitidos')),
        ):
            result = namespace[function](*arguments)
            captures[f'{area}.{tab}'] = capture_locals(result)
    captures['abertos.resumo'] = capture_locals(namespace['render_pedidos_em_aberto']())
    captures['abertos.calendario'] = normalize(namespace['build_forecast_calendar'](frames['abertos'], 2026, 10))
    max_date = frames['emitidos']['DATA_EMISSAO_PEDIDO_DATE'].max()
    month_rows = frames['emitidos'][frames['emitidos']['DATA_EMISSAO_PEDIDO_DATE'].dt.to_period('M') == max_date.to_period('M')]
    today = datetime.date.today()
    days = __import__('calendar').monthrange(max_date.year, max_date.month)[1]
    elapsed = today.day if (today.year,today.month)==(max_date.year,max_date.month) else days
    captures['emitidos.metas'] = normalize(namespace['build_consultant_goal_ranking'](
        month_rows.to_dict('records'), frames['metas'].to_dict('records'), max_date.year, max_date.month, elapsed, days))
    subset = frames['faturados'].head(3)
    manual = {'value': float(subset.VALOR_FATURADO_CLEAN.sum()), 'quantity': float(subset.QUANTIDADE_FATURADA_CLEAN.sum()),
              'orders': int(subset.CODIGO_PEDIDO.nunique()), 'serviceDays': float(subset.NIVEL_DE_SERVICO_CLEAN.mean()),
              'ticket': float(subset.VALOR_FATURADO_CLEAN.sum() / subset.QUANTIDADE_FATURADA_CLEAN.sum()),
              'otif': float(subset.ON_TIME_CLEAN.mean() * 100)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'source': 'firebird/apache-hop', 'synthetic': False, 'version': version, 'sources': sources, 'manual': manual, 'captures': normalize(captures)}, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    print(f'Referência real: {len(captures)} capturas; {len(sources)} fontes originais.')


if __name__ == '__main__':
    main()

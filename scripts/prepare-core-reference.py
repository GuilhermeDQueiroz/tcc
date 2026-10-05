"""Reproduce the core oracle from the exported real, processed open-order rows.

Run from legacy-refatorado, after the published DW oracle has completed:
  python scripts/reference_full.py --legacy-root ../legacy --output .local/domain-reference.json
  python scripts/reference_full.py --legacy-root ../legacy --output .local/domain-reference.json --compact-existing
  python scripts/prepare-core-reference.py --legacy-root ../legacy

The first command requires the authorized PostgreSQL environment; it reads the
published Hop snapshot. The latter two commands make no database connection.
--compact-existing generates both normalized-reference-comercial.json and
normalized-reference-trees.json. For the older tests using legacy-reference.json,
run reference_legacy.py separately with --output .local/legacy-reference.json.

Use --output .local/core-reference-regenerated.json --compare .local/core-reference.json
to verify a preexisting reference before replacing it. No pickle, private launcher,
Firebird query, synthetic row or copied business formula is needed here.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path

import pandas as pd

from reference_legacy import Streamlit, normalize, original_functions


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--legacy-root', type=Path, default=Path('../legacy'))
    parser.add_argument('--input', type=Path, default=Path('.local/normalized-abertos.json'))
    parser.add_argument('--reference', type=Path, default=Path('.local/domain-reference.json'))
    parser.add_argument('--publication', type=Path, default=Path('.local/real-load.json'))
    parser.add_argument('--output', type=Path, default=Path('.local/core-reference.json'))
    parser.add_argument('--compare', type=Path, help='Require exact equality with this existing real core reference before writing')
    args = parser.parse_args()

    reference = json.loads(args.reference.read_text(encoding='utf-8'))
    publication = json.loads(args.publication.read_text(encoding='utf-8'))
    if reference.get('synthetic') is not False or reference.get('source') != 'firebird/apache-hop':
        raise ValueError('The input reference must identify a real published Hop snapshot')
    if publication.get('synthetic') is not False or reference['version'] != publication['runId']:
        raise ValueError('Reference and published Hop load versions differ')

    input_bytes = args.input.read_bytes()
    records = json.loads(input_bytes)
    if len(records) != reference['scope']['abertos']['wholeRows']:
        raise ValueError('Normalized open-order export does not match the reference snapshot scope')
    frame = pd.DataFrame(records)
    for column in frame.columns:
        if column.endswith('_CLEAN'):
            frame[column] = frame[column].astype('float64' if column.startswith('VALOR_') else 'float32')
        if column.endswith('_DATE'):
            frame[column] = pd.to_datetime(frame[column], errors='coerce')
        if column in ('STATUS', 'GRUPO_CLIENTE', 'CONSULTOR', 'SUPERVISOR', 'UF'):
            frame[column] = frame[column].astype('category')
    frame = frame[frame['DATA_EMISSAO_PEDIDO_DATE'].between('2026-08-01', '2026-08-31')].copy()
    if frame.empty:
        raise ValueError('The actual published snapshot contains no August 2026 open-order rows')

    fields = ['VALOR_EM_ABERTO_CLEAN', 'PESO_EM_ABERTO_CLEAN', 'VOLUME_M3_EM_ABERTO_CLEAN',
              'QTDEABERTA_DOCITEMDET_CLEAN', 'NIVEL_DE_SERVICO_CLEAN']
    expected = {column: {'sum': float(frame[column].sum()), 'mean': float(frame[column].mean()),
        'byStatus': normalize(frame.groupby('STATUS', observed=True)[column].agg(['sum', 'mean']).reset_index())}
        for column in fields}
    namespace = {'pd': pd, 'st': Streamlit()}
    original_root = args.legacy_root.resolve()
    chart_tree = ast.parse((original_root / 'views/pedidos_em_aberto_charts.py').read_text(encoding='utf-8-sig'))
    status_assignment = next(node for node in chart_tree.body if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == 'BACKLOG_REAL_STATUSES' for target in node.targets))
    namespace['BACKLOG_REAL_STATUSES'] = ast.literal_eval(status_assignment.value)
    sources = original_functions(original_root, 'views/pedidos_em_aberto_charts.py', namespace,
                                 {'filter_forecast_backlog', 'build_forecast_calendar'})
    calendars = {kind: normalize(namespace['build_forecast_calendar'](
        namespace['filter_forecast_backlog'](frame, kind), 2026, 9)) for kind in ('real', 'geral')}
    actual_backlog = namespace['filter_forecast_backlog'](frame, 'real')
    result = {'source': reference['source'], 'synthetic': False, 'version': reference['version'],
        'inputSha256': hashlib.sha256(input_bytes).hexdigest(), 'fixturePeriod': '2026-08',
        'calendarPeriod': '2026-09', 'sources': [sources], 'rows': normalize(frame), 'expected': expected,
        'calendar': calendars, 'realValue': float(actual_backlog['VALOR_EM_ABERTO_CLEAN'].sum()),
        'realRows': len(actual_backlog)}

    comparison = args.compare or (args.output if args.output.exists() else None)
    if comparison:
        old = json.loads(comparison.read_text(encoding='utf-8'))
        for field in ('expected', 'calendar', 'realValue', 'realRows'):
            if result[field] != old[field]:
                raise ValueError(f'Original-reference comparison failed: {field}; output was not replaced')
        if result['rows'] != old['rows']:
            raise ValueError('Original-reference comparison failed: row values/order; output was not replaced')
        print('Exact comparison: all rows, reductions, status groups and calendar outputs match.', flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    print(f'Real original core oracle: {len(frame)} August rows; {len(actual_backlog)} real-backlog rows; output {args.output}.')


if __name__ == '__main__':
    main()

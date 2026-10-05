// legacy/consultor_metas.py; the monthly goal is independent of the sales filters.
export function extractConsultantCode(record) {
  const raw = record.CODIGO_CONSULTOR ?? record.CODIGO_METASVEN;
  if (raw != null && raw !== '' && Number.isFinite(Number(raw))) return Math.trunc(Number(raw));
  const match = /^\s*(\d+)\s*-/.exec(String(record.CONSULTOR ?? ''));
  return match ? Number(match[1]) : null;
}
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export function consultantGoalRanking(sales, goals, year, month, elapsedDays, daysInMonth) {
  const consultants = new Map(), totals = new Map();
  for (const record of goals) {
    if (Math.trunc(number(record.ANO_METASVEN)) !== year) continue;
    const code = extractConsultantCode(record);
    if (code == null) continue;
    consultants.set(code, { name: String(record.DESCRICAO || record.CONSULTOR || code).trim(), goal: number(record[`META_${String(month).padStart(2, '0')}_METASVEN`]) });
  }
  for (const record of sales) {
    const code = extractConsultantCode(record);
    if (code == null) continue;
    totals.set(code, (totals.get(code) || 0) + number(record.VALOR_EMITIDO_CLEAN));
    if (!consultants.has(code)) consultants.set(code, {name: String(record.CONSULTOR || code).trim(), goal: 0});
  }
  const ranking = [...consultants].map(([code, {name, goal}]) => {
    const actual = totals.get(code) || 0;
    const projectionFactor = daysInMonth / Math.max(elapsedDays, 1);
    return {CODIGO_CONSULTOR: code, CONSULTOR: name, VALOR_EMITIDO: actual, META_MENSAL: goal,
      PERCENTUAL_ATINGIDO: goal > 0 ? actual / goal * 100 : null, VALOR_RESTANTE: Math.max(goal - actual, 0),
      PROJECAO_FECHAMENTO: actual * projectionFactor,
      SITUACAO: goal <= 0 ? 'Sem meta cadastrada' : actual >= goal ? 'Meta atingida' : 'Em andamento'};
  });
  ranking.sort((a, b) => Number(b.PERCENTUAL_ATINGIDO != null) - Number(a.PERCENTUAL_ATINGIDO != null)
    || (b.PERCENTUAL_ATINGIDO || 0) - (a.PERCENTUAL_ATINGIDO || 0) || b.VALOR_EMITIDO - a.VALOR_EMITIDO);
  return ranking.map((row, index) => ({...row, POSICAO: index + 1}));
}
export function consultantGoalTotal(ranking) {
  const total = key => ranking.reduce((value, row) => value + row[key], 0);
  const goal = total('META_MENSAL'), actual = total('VALOR_EMITIDO');
  return {POSICAO: '', CONSULTOR: 'TOTAL', VALOR_EMITIDO: actual, META_MENSAL: goal,
    PERCENTUAL_ATINGIDO: goal > 0 ? actual / goal * 100 : null, VALOR_RESTANTE: Math.max(goal - actual, 0),
    PROJECAO_FECHAMENTO: total('PROJECAO_FECHAMENTO'), SITUACAO: goal <= 0 ? 'Sem meta cadastrada' : actual >= goal ? 'Meta atingida' : 'Em andamento'};
}

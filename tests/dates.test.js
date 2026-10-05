import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('calendário de 2026 mantém feriados e dias úteis do legacy', async () => {
  assert.ok(existsSync('api-server/domain/dates.js'), 'Calendário ainda não implementado');
  const { businessDays, easter, weeklyPeriods } = await import('../api-server/domain/dates.js');
  assert.equal(easter(2026), '2026-04-05');
  assert.equal(businessDays(2026, 9), 21);
  assert.equal(businessDays(2026, 10), 21);
  assert.deepEqual(weeklyPeriods('2026-10-01', '2026-10-01'), [
    { start:'2026-09-28', end:'2026-10-04' },
    { start:'2026-09-21', end:'2026-09-27' },
    { start:'2026-09-14', end:'2026-09-20' },
  ]);
});

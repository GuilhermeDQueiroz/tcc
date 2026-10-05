import { test, expect } from '@playwright/test'

test('formatos pt-BR e exportação preservam centavos, Unicode e separadores', async ({ page }) => {
  await page.goto('/abertos').catch(() => undefined)
  const result = await page.evaluate(async () => {
    const formats = await import('/src/composables/useFormatters.ts')
    return {
      money: formats.formatValue(-1234.56, 'currency'),
      empty: formats.formatValue(null, 'currency'),
      tonnes: formats.formatValue(1500, 'weight'),
      tie: formats.formatValue(2.5, 'integer'),
      cents: formats.formatValue(1.005, 'currency'),
      axisMoney: formats.compactAxisValue(31323569.9921875,'currency'),
      axisWeight: formats.compactAxisValue(3308960,'weight'),
      axisDecimal: formats.compactAxisValue(3499.995,'decimal'),
      axisRatio: formats.compactAxisValue(0.831,'ratio'),
      csv: formats.toCsv([{ name: 'São Paulo; "UF"', amount: 1234.56 }], [{ key: 'name', label: 'Local' }, { key: 'amount', label: 'Valor' }]),
    }
  })
  expect(result.money).toBe('R$ -1.234,56')
  expect(result.empty).toBe('R$ 0,00')
  expect(result.tonnes).toBe('1,50 t')
  expect(result.tie).toBe('2')
  expect(result.cents).toBe('R$ 1,00')
  expect(result.axisMoney).toBe('R$ 31,3 mi')
  expect(result.axisWeight).toBe('3,3 mil t')
  expect(result.axisDecimal).toBe('3,5 mil')
  expect(result.axisRatio).toBe('83,1%')
  expect(result.csv).toContain('"São Paulo; ""UF"""')
  expect(result.csv.charCodeAt(0)).toBe(0xFEFF)
})

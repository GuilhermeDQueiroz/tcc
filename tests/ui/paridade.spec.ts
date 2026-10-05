import { test, expect } from '@playwright/test'

test('falha real da API informa erro sem inventar indicadores', async ({ page }) => {
  await page.route('**/api/v1/bi/**', route => route.abort('failed'))
  await page.goto('/abertos').catch(() => undefined)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(page.locator('[data-testid="metric-card"]')).toHaveCount(0)
})

test('períodos de emissão e faturamento são independentes', async ({ page }) => {
  await page.goto('/faturados')
  await page.getByRole('button', { name: 'Filtros', exact: true }).click()
  await page.getByLabel('Emissão de').fill('2026-09-01')
  await page.getByLabel('Emissão até').fill('2026-09-30')
  await page.getByLabel('Faturamento de').fill('2026-09-10')
  await page.getByLabel('Faturamento até').fill('2026-09-20')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(page.getByRole('button', { name: /Remover filtro Emissão/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Remover filtro Faturamento/ })).toBeVisible()
})

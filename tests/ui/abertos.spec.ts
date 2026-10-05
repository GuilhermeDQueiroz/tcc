import { test, expect } from '@playwright/test'

test('abertos apresenta navegação e calendário real/geral com mês navegável', async ({ page }) => {
  await page.goto('/abertos').catch(() => undefined)
  await expect(page.getByRole('heading', { name: 'Análise de Pedidos em Aberto', exact: true })).toBeVisible()
  await expect(page.locator('.analytics-page > nav[role="tablist"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mês anterior no resumo' })).toBeVisible()
  const before = await page.getByTestId('calendar-month').textContent()
  await page.getByRole('button', { name: 'Mês anterior no resumo' }).click()
  await expect(page.getByTestId('calendar-month')).not.toHaveText(before!)
  await page.getByRole('button',{name:'Backlog Geral',exact:true}).click()
  await expect(page.getByRole('button',{name:'Backlog Geral',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:'Backlog Real',exact:true}).click()
  await expect(page.getByRole('button',{name:'Backlog Real',exact:true})).toHaveAttribute('aria-pressed','true')
})

test('abertos aplica e remove seleção de filtro por chips', async ({ page }) => {
  await page.goto('/abertos')
  await page.getByRole('button', { name: 'Filtros Avançados', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Filtros da análise' })).toBeVisible()
  await page.getByRole('button', { name: 'Valores e quantidade' }).click()
  await page.getByLabel('Valor do pedido').fill('1000')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(page.getByRole('button', { name: /Remover filtro Valor/ })).toBeVisible()
  await page.getByRole('button', { name: /Remover filtro Valor/ }).click()
  await expect(page.getByRole('button', { name: /Remover filtro Valor/ })).toHaveCount(0)
})

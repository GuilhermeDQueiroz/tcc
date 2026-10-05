import { test, expect } from '@playwright/test'

test('mobile mantém filtros, navegação e conteúdo dentro da largura', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/abertos')
  await expect(page.getByRole('heading', { name: 'Análise de Pedidos em Aberto', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.getByRole('link', { name: 'Pedidos Emitidos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Análise de Pedidos Emitidos', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.getByRole('button', { name: 'Filtros Avançados', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Filtros da análise' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

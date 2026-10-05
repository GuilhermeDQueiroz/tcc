import { test, expect } from '@playwright/test'

for (const [area, title] of [['emitidos', 'Pedidos Emitidos'], ['faturados', 'Pedidos Faturados']]) {
  test(`${area} oferece todas as análises e hierarquia`, async ({ page }) => {
    await page.goto(`/${area}`)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    for (const label of ['Semanal', 'Mensal', 'Evolução', 'Geografia', 'Carteira de Clientes', 'Dimensões', 'Pesquisa']) {
      await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible()
    }
    await page.getByRole('tab', { name: 'Dimensões', exact: true }).click()
    await expect(page.getByLabel('Dimensão', { exact: true })).toBeVisible()
    await page.getByLabel('Dimensão', { exact: true }).selectOption('CONSULTOR')
    await expect(page.getByLabel('Dimensão', { exact: true })).toHaveValue('CONSULTOR')
    await expect(page.getByLabel('Dimensão', { exact:true }).locator('option[value="Canal"]')).toHaveCount(0)
    await page.getByRole('tab', { name:'Mensal',exact:true }).click()
    await expect(page.getByLabel('Dimensão', { exact:true })).toBeVisible()
    await page.getByRole('tab', { name:'Evolução',exact:true }).click()
    await expect(page.getByLabel('Cruzar mês com', {exact:true}).locator('option[value="CLIENTE"], option[value="CODIGO_PEDIDO"], option[value="Canal"]')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Pesquisa', exact: true }).click()
    await expect(page.getByLabel('Pesquisar pedidos')).toBeVisible()
  })
}

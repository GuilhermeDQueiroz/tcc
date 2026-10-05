import { test, expect } from '@playwright/test'
import { captureRealApi,realPayload } from './real-api'
test.beforeEach(async ({page},info)=>captureRealApi(page,info))

for (const [size,viewport] of Object.entries({ desktop: { width:1440,height:900 }, mobile: { width:390,height:844 } })) {
  test(`screenshots reais ${size} de todas as análises`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize(viewport)
    const pages: Record<string,string[]> = { abertos:['resumo','calendario','geografia','dimensoes','pesquisa'],emitidos:['semanal','mensal','evolucao','geografia','carteira','dimensoes','pesquisa'],faturados:['semanal','mensal','evolucao','geografia','carteira','dimensoes','pesquisa'] }
    for (const [area,tabs] of Object.entries(pages)) for (const tab of tabs) {
      const response=page.waitForResponse(response=>response.url().includes(`/api/v1/bi/${area}/${tab}?`))
      const details=tab==='pesquisa' ? page.waitForResponse(response=>response.url().includes(`/api/v1/bi/${area}/detalhes?`)) : undefined
      await page.goto(`/${area}?tab=${tab}`)
      const payload=await realPayload(page,response)
      expect(payload.dataVersion).toBeTruthy()
      await expect(page.locator('[data-testid="metric-card"]')).toHaveCount(payload.metrics.length)
      for (const series of payload.series) if (series.type!=='calendar' && series.rows.length && !(area==='abertos'&&tab==='resumo'&&['abertos.resumo.Mes_Previsao','abertos.resumo.Canal'].includes(series.id))) await expect(page.locator(`[data-series-id="${series.id}"] .chart-host canvas`).first()).toBeAttached()
      if (details) { await realPayload(page,details); await expect(page.locator(`[data-table-id="${area}-details"]`)).toBeVisible() }
      await expect(page.locator('.analytic-chart [role="alert"]')).toHaveCount(0)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path:`tests/ui/screenshots/${size}/${area}-${tab}.png`,fullPage:true,animations:'disabled' })
    }
  })
}

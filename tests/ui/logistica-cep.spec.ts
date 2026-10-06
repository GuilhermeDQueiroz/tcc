import {test,expect} from '@playwright/test'
test.use({baseURL:'http://127.0.0.1:3002'})
test('mapa real informa origem ERP e CEP aproximado sem consultar provedor no navegador',async({page})=>{
 const external:string[]=[],errors:string[]=[]
 page.on('request',request=>{if(request.url().includes('brasilapi.com.br'))external.push(request.url())})
 page.on('pageerror',error=>errors.push(error.message))
 // Read the unchanged real response through Playwright's request transport:
 // Chrome can evict this large dashboard body from its inspector cache.
 let receive:(payload:any)=>void
 const loaded=new Promise<any>(resolve=>{receive=resolve})
 await page.route('**/api/v1/logistica/formacao*',async route=>{
  const response=await route.fetch();expect(response.ok()).toBe(true)
  const payload=await response.json();await route.fulfill({response});receive(payload)
 })
 await page.goto('/cargas')
 const payload=await loaded,orders=payload.tables[0].rows
 const erp=orders.filter((row:any)=>row.geo_origin==='ERP').length,cep=orders.filter((row:any)=>row.geo_origin==='CEP').length
 expect(erp).toBeGreaterThan(0);expect(cep).toBeGreaterThan(0)
 const coverage=page.locator('.logistics-coordinate-coverage')
 await expect(coverage).toContainText(`${(erp+cep).toLocaleString('pt-BR')} / ${orders.length.toLocaleString('pt-BR')} no mapa`)
 await expect(coverage).toContainText(`${cep.toLocaleString('pt-BR')} CEP aprox.`)
 await expect(coverage).toHaveAttribute('title',new RegExp(`${erp} ERP.*${cep} CEP aproximado`))
 await expect(page.locator('[data-series-id="logistica.destinos"] canvas')).toBeVisible()
 await page.getByLabel('Ajuda da formação de cargas').click()
 await expect(page.locator('.logistics-help-content')).toContainText('centro do município')
 await expect(page.locator('.logistics-help-content')).toContainText('Círculos verdes')
 await page.getByLabel('Ajuda da formação de cargas').click()
 await page.setViewportSize({width:1100,height:900})
 const footer=page.locator('.logistics-map-footer')
 const contained=await footer.evaluate(element=>{
  const bounds=element.getBoundingClientRect()
  return [...element.children].every(child=>{const box=child.getBoundingClientRect();return box.right<=bounds.right+1&&box.left>=bounds.left-1})
 })
 expect(contained).toBe(true)
 await page.setViewportSize({width:1440,height:900})
 await page.locator('.logistics-workspace').screenshot({path:'.local/cep-mapa-real.png',animations:'disabled'})
 expect(external).toEqual([]);expect(errors).toEqual([])
})

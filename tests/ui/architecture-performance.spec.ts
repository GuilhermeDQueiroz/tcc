import {test,expect} from '@playwright/test'

test.use({baseURL:'http://127.0.0.1:3002'})
test.setTimeout(90_000)

test('production routes load on demand and reuse the Brazil map across navigation',async({page,request})=>{
 const published=await (await request.get('/api/v1/logistica/formacao')).json()
 const modules:string[]=[],maps:string[]=[],errors:string[]=[]
 page.on('request',request=>{
  const url=request.url()
  if(/\/assets\/.*\.js$/.test(url))modules.push(url)
  if(/brazil-states.*\.geojson/.test(url))maps.push(url)
 })
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto('/abertos')
 await expect(page.locator('[data-metric-id="abertos.resumo.value"] strong')).toBeVisible()
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 expect(modules.some(url=>url.includes('/FormacaoCargas-'))).toBe(false)
 expect(modules.some(url=>url.includes('/PedidosFaturados-'))).toBe(false)
 await page.locator('.sidebar a[href="/cargas"]').click()
 await expect(page.locator('[data-table-id="logistica-cargas"] tbody tr:not(.child-row)')).toHaveCount(published.tables[1].rows.length)
 await expect(page.locator('[data-series-id="logistica.destinos"] canvas')).toBeVisible()
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 expect(modules.some(url=>url.includes('/FormacaoCargas-'))).toBe(true)
 expect(maps).toHaveLength(1)
 await page.getByRole('link',{name:'Pedidos em Aberto',exact:true}).click()
 await expect(page.locator('[data-metric-id="abertos.resumo.value"] strong')).toBeVisible()
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 await page.locator('.sidebar a[href="/cargas"]').click()
 await expect(page.locator('[data-series-id="logistica.destinos"] canvas')).toBeVisible()
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 expect(maps).toHaveLength(1)
 expect(errors).toEqual([])
})

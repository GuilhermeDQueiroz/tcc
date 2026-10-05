import {test,expect} from '@playwright/test'
test.use({baseURL:'http://127.0.0.1:3002'})

test('formação usa o mesmo loader central de abertos na abertura e atualização, preservando tabelas',async({page,request})=>{
 const response=await request.get('/api/v1/logistica/formacao');expect(response.ok()).toBe(true)
 const payload=await response.text()
 // Hold the opening request to compare actual rendered loader styles without
 // loading the unrelated BI facts or making timing depend on API response speed.
 await page.route('**/api/v1/bi/**',route=>route.abort())
 await page.goto('/abertos')
 await expect(page.locator('.loading-screen')).toBeVisible()
 const styles=()=>page.locator('.loading-screen').evaluate(element=>{
  const curtain=getComputedStyle(element),spinner=getComputedStyle(element.querySelector('.loading-orbit')!)
  return {background:curtain.backgroundColor,position:curtain.position,duration:spinner.animationDuration,timing:spinner.animationTimingFunction,border:spinner.borderTopColor,width:spinner.width}
 })
 const openStyles=await styles()
 let release=()=>{},served=()=>{}
 const gate=new Promise<void>(resolve=>release=resolve),completed=new Promise<void>(resolve=>served=resolve)
 await page.route('**/api/v1/logistica/formacao?**',async route=>{await gate;await route.fulfill({status:200,contentType:'application/json',body:payload});served()})
 await page.goto('/cargas')
 await expect(page.locator('.loading-screen')).toBeVisible()
 expect(await styles()).toEqual(openStyles)
 release();await completed
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 await expect(page.locator('[data-metric-id="logistica.orders"] strong')).toHaveText('1.335')
 await page.unroute('**/api/v1/logistica/formacao?**')
 const orders=page.locator('[data-table-id="logistica-pedidos"]'),loads=page.locator('[data-table-id="logistica-cargas"]')
 const rows=await orders.locator('tbody tr').count(),baseline=await orders.boundingBox()
 let finish=()=>{},done=()=>{}
 const pending=new Promise<void>(resolve=>finish=resolve),finished=new Promise<void>(resolve=>done=resolve)
 await page.route('**/api/v1/logistica/formacao?**',async route=>{await pending;await route.fulfill({status:200,contentType:'application/json',body:payload});done()})
 await page.getByRole('button',{name:'Atualizar dados',exact:true}).click()
 await expect(page.locator('.loading-screen')).toBeVisible()
 expect(await styles()).toEqual(openStyles)
 for(const table of [orders,loads]){await expect(table.locator('table')).toBeAttached();await expect(table.locator('.loading-overlay')).toBeAttached()}
 await expect(orders.locator('tbody tr')).toHaveCount(rows)
 finish();await finished
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 await expect(orders.locator('.loading-state')).toHaveCount(0)
 await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'))
 await expect(page.locator('.logistics-page [data-loading-reveal="waiting"]')).toHaveCount(0)
 expect(Math.abs((await orders.boundingBox())!.height-baseline!.height)).toBeLessThan(2)
})

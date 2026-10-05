import {test,expect} from '@playwright/test'
test.use({baseURL:'http://127.0.0.1:3002'})
test('painéis ficam contidos com cidades abertas, sidebar recolhida e diferentes larguras',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.setViewportSize({width:1850,height:960});await page.goto('/cargas')
 await expect(page.locator('[data-table-id="logistica-cargas"] tbody tr').first()).toBeVisible()
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 await page.getByRole('button',{name:'Recolher menu',exact:true}).click()
 for(const width of [1850,1440,1100]){
  await page.setViewportSize({width,height:960})
  await page.waitForFunction(()=>!document.getAnimations().some(animation=>animation.playState==='running'))
  const rects=await page.evaluate(()=>{
   const rect=(selector:string)=>{const b=document.querySelector(selector)!.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width}}
   return {grid:rect('.logistics-workspace-grid'),map:rect('.logistics-destinations'),chart:rect('.logistics-map-panel'),tables:rect('.logistics-linked-tables'),loads:rect('[data-table-id="logistica-cargas"]'),orders:rect('[data-table-id="logistica-pedidos"]'),cities:rect('.logistics-city-details'),cityViewport:rect('[data-table-id="logistica-destinos"] .table-viewport')}
  })
  expect(rects.map.right,width+' map vs tables').toBeLessThanOrEqual(rects.tables.left)
  expect(rects.chart.right,width+' chart containment').toBeLessThanOrEqual(rects.map.right+1)
  for(const frame of [rects.loads,rects.orders]){expect(frame.left).toBeGreaterThanOrEqual(rects.tables.left-1);expect(frame.right).toBeLessThanOrEqual(rects.tables.right+1)}
  for(const id of ['logistica-cargas','logistica-pedidos']){
   const overflow=await page.locator('[data-table-id="'+id+'"]').evaluate(root=>{
    const frame=root.getBoundingClientRect();return [...root.querySelectorAll('.analysis-body,.table-viewport,.table-scroll,.table-footer')].map(child=>{const b=child.getBoundingClientRect();return {bottom:b.bottom-frame.bottom,right:b.right-frame.right,left:frame.left-b.left}})
   })
   for(const child of overflow){expect(child.bottom,id+' vertical containment').toBeLessThanOrEqual(1);expect(child.right,id+' horizontal containment').toBeLessThanOrEqual(1);expect(child.left).toBeLessThanOrEqual(1)}
  }
  expect(rects.cities.right).toBeLessThanOrEqual(rects.grid.right+1);expect(rects.cities.top).toBeGreaterThanOrEqual(rects.grid.bottom)
  expect(rects.cityViewport.right).toBeLessThanOrEqual(rects.cities.right+1)
  const overflow=await page.locator('[data-table-id="logistica-cargas"] .table-scroll').evaluate(element=>element.scrollWidth>element.clientWidth)
  expect(overflow).toBe(true)
 }
 await page.setViewportSize({width:1850,height:960})
 await page.locator('.logistics-workspace-grid').scrollIntoViewIfNeeded()
 await page.waitForFunction(()=>!document.getAnimations().some(animation=>animation.playState==='running'))
 await page.screenshot({path:'.local/logistica-clean-desktop.png'})
 const colors=await page.locator('.logistics-map-panel').evaluate(element=>({background:getComputedStyle(element).backgroundColor,shadow:getComputedStyle(element).boxShadow}))
 expect(colors).toEqual({background:'rgba(0, 0, 0, 0)',shadow:'none'})
 await expect(page.locator('.logistics-table-help')).toHaveCount(0)
 await expect(page.locator('.logistics-planning-notes')).toHaveCount(0)
 await page.getByRole('button',{name:'Expandir menu',exact:true}).click()
 await page.waitForFunction(()=>!document.getAnimations().some(animation=>animation.playState==='running'))
 const aside=await page.locator('.logistics-destinations').boundingBox(),tables=await page.locator('.logistics-linked-tables').boundingBox()
 expect(aside!.x+aside!.width).toBeLessThanOrEqual(tables!.x)
 expect(errors).toEqual([])
})

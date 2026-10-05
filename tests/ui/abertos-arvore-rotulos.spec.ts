import {test,expect} from '@playwright/test'
test.use({baseURL:'http://127.0.0.1:3002'})
test('árvore mostra rótulos reais em cada nível sem esconder nomes longos',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 const response=page.waitForResponse(r=>r.url().includes('/bi/abertos/dimensoes?'))
 await page.goto('/abertos')
 const payload=await (await response).json()
 const table=page.locator('.overview-dimensions .analytic-table')
 await expect(table.locator('.loading-state')).toHaveCount(0)
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 const total=await table.locator('tfoot').textContent()
 let node=payload.tables[0].tree[0],depth=0
 while(node){
  const row=table.locator('[data-row-id="'+node.node_id+'"]')
  const label=row.locator('td').first().locator('.cell-link')
  await expect(label).toHaveText(node.name)
  await expect(label).toHaveAttribute('title',node.name)
  await expect(label).toHaveCSS('white-space','normal')
  await expect(label).toHaveCSS('text-overflow','clip')
  const geometry=await label.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect(),box=el.getBoundingClientRect();return {width:box.width,overflow:text.right-box.right,height:box.height,textHeight:text.height}})
  expect(geometry.width).toBeGreaterThan(40)
  expect(geometry.overflow).toBeLessThanOrEqual(1)
  expect(geometry.height).toBeGreaterThanOrEqual(geometry.textHeight-1)
  if(!node.children?.length)break
  await row.getByRole('button',{name:/Expandir/}).click()
  node=node.children[0];depth++
 }
 expect(depth).toBeGreaterThanOrEqual(3)
 await expect(table.locator('tfoot')).toHaveText(total!)
 await table.scrollIntoViewIfNeeded()
 await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'))
 await table.screenshot({path:'.local/abertos-arvore-rotulos.png'})
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 for(const label of await table.locator('tbody .cell-link').all()){
  expect((await label.textContent())?.trim()).toBeTruthy()
  expect(await label.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(0)
 }
 expect(errors).toEqual([])
})

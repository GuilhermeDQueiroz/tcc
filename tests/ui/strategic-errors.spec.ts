import {test,expect} from '@playwright/test'

test('a failed reload clears previous figures rather than showing them under a new filter',async({page})=>{
 test.setTimeout(90_000)
 await page.goto('/estrategico')
 await expect(page.locator('.loading-screen')).toHaveCount(0,{timeout:60_000})
 await expect(page.locator('[data-metric-id="strategic.loads"]')).toBeVisible()
 await page.route('**/api/v1/logistica/estrategico?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'A publicação está indisponível.'})}))
 await page.getByRole('button',{name:'Dias',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('A publicação está indisponível.')
 await expect(page.locator('.loading-screen')).toHaveCount(0,{timeout:30_000})
 await expect(page.locator('[data-metric-id^="strategic."]')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Tentar novamente',exact:true})).toBeVisible()
})

test('a missing allocation price stays unavailable in the card and its exact-value help',async({page})=>{
 test.setTimeout(90_000)
 await page.route('**/api/v1/logistica/estrategico?**',async route=>{
  const response=await route.fetch(),data=await response.json()
  data.metrics.find((metric:{id:string})=>metric.id==='strategic.valueLoad').value=null
  await route.fulfill({response,json:data})
 })
 await page.goto('/estrategico')
 await expect(page.locator('.loading-screen')).toHaveCount(0,{timeout:60_000})
 const card=page.locator('[data-metric-id="strategic.valueLoad"]')
 await expect(card.locator('strong')).toHaveText('—')
 await expect(card.locator('strong')).not.toHaveAttribute('title',/R\$/)
 await expect(card.locator('.metric-exact-value')).toHaveCount(0)
})

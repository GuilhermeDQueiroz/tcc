import {test,expect} from '@playwright/test'

test('cohort panel shows published bases, switches measures and distinguishes immature windows on mobile',async({page})=>{
 test.setTimeout(120_000)
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto('/estrategico')
 await expect(page.locator('.loading-screen')).toHaveCount(0,{timeout:60_000})
 const panel=page.getByRole('region',{name:'Conversão da safra de pedidos'})
 await expect(panel).toBeVisible()
 const response=await page.request.get('/api/v1/logistica/estrategico');expect(response.ok()).toBeTruthy()
 const data=await response.json();expect(data.cohorts.rows.length).toBeGreaterThan(0)
 const selected=await panel.getByLabel('Safra de emissão').inputValue()
 const row=data.cohorts.rows.find((row:{month:string})=>row.month===selected)
 for(const window of row.windows){
  const card=panel.locator(`[data-metric-id="cohort.${window.days}"]`)
  await expect(card).toBeVisible()
  await expect(card.locator('strong')).toHaveText(window.valuePercent==null?'—':new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(window.valuePercent)+'%')
 }
 await panel.getByRole('button',{name:'Peso',exact:true}).click()
 await expect(panel.getByRole('button',{name:'Peso',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(panel.getByRole('heading',{name:'Conversão por mês de emissão · Peso'})).toBeVisible()
 await panel.getByRole('button',{name:'Cubagem',exact:true}).click()
 await expect(panel.getByRole('heading',{name:'Conversão por mês de emissão · Cubagem'})).toBeVisible()
 const immature=data.cohorts.rows.findLast((row:{windows:{mature:boolean}[]})=>row.windows.some(window=>!window.mature))
 if(immature){await panel.getByLabel('Safra de emissão').selectOption(immature.month);await expect(panel.getByText('Em acompanhamento',{exact:true}).first()).toBeVisible()}
 await page.screenshot({path:'.local/cohorts-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded()
 await expect(panel.getByLabel('Safra de emissão')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false)
 await page.screenshot({path:'.local/cohorts-mobile.png',fullPage:true})
 expect(errors).toEqual([])
})

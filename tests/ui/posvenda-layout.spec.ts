import {test,expect,type Page} from '@playwright/test'
import sharedDimensions from '../../shared/analysis-dimensions.json' with {type:'json'}

test.use({baseURL:'http://127.0.0.1:3002'})
test.setTimeout(150_000)
async function settled(page:Page){await expect(page.locator('.loading-screen')).toHaveCount(0,{timeout:60_000});await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})))})}

test('after-sales areas share the open-orders visual structure while retaining their own metrics and charts',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto('/abertos');await settled(page)
 const reference=await page.locator('.overview-row .analytic-chart').first().evaluate(el=>{
  const h=getComputedStyle(el.querySelector('h2')!),frame=getComputedStyle(el)
  return {font:h.fontSize,color:h.color,transform:h.textTransform,background:frame.backgroundColor,border:frame.borderTopWidth}
 })
 for(const area of ['assistencias','cancelamentos','devolucoes']){
  const response=await page.request.get('/api/v1/posvenda/'+area),data=await response.json();expect(response.ok()).toBeTruthy()
  await page.locator(`.sidebar nav a[href="/${area}"]`).click();await settled(page)
  await expect(page.locator('.aftersales-metrics .metric-card')).toHaveCount(data.metrics.length)
  for(const metric of data.metrics)await expect(page.locator(`[data-metric-id="${metric.id}"] strong`)).toBeVisible()
  const ids=[...data.series.map((series:{id:string})=>series.id)]
  if(data.assistance)ids.push(...['aging','types','status','forecastStatus'].map(key=>data.assistance[key].id))
  // The product ranking remains available through the product dimension, as in
  // the original assistance layout. No business analysis is copied from Abertos.
  const displayed=area==='assistencias'?ids.filter(id=>id!=='posvenda.products'):ids
  for(const id of displayed)await expect(page.locator(`[data-series-id="${id}"] canvas`)).toBeVisible()
  const style=await page.locator('.aftersales-charts .analytic-chart').first().evaluate(el=>{
   const h=getComputedStyle(el.querySelector('h2')!),frame=getComputedStyle(el)
   return {font:h.fontSize,color:h.color,transform:h.textTransform,background:frame.backgroundColor,border:frame.borderTopWidth}
  })
  expect(style).toEqual(reference)
  await expect(page.locator('#aftersales-analysis .dimension-viewport')).toHaveCSS('height','440px')
  await expect(page.locator('#aftersales-analysis .table-footer')).toHaveCount(0)
  await page.screenshot({path:`.local/posvenda-layout-${area}-desktop.png`,fullPage:true,animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)).toBe(false)
  await page.screenshot({path:`.local/posvenda-layout-${area}-mobile.png`,fullPage:true,animations:'disabled'})
  await page.setViewportSize({width:1440,height:900})
 }
 expect(errors).toEqual([])
})

test('full refresh uses the shared curtain while dimensions and pages load only their table',async({page})=>{
 await page.goto('/assistencias');await settled(page)
 const metrics=await page.locator('.aftersales-metrics strong').allTextContents()
 let release:()=>void=()=>{},hold=false,waiting=false
 await page.route('**/api/v1/posvenda/assistencias?*',async route=>{
  if(hold){waiting=true;await new Promise<void>(resolve=>{release=resolve});waiting=false}
  await route.continue()
 })
 const dimensions=page.getByRole('navigation',{name:'Dimensões de pós-venda'})
 hold=true
 await dimensions.getByRole('button',{name:'Motivo',exact:true}).click()
 await expect(page.locator('#aftersales-analysis .loading-overlay')).toBeVisible()
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 expect(await page.locator('.aftersales-metrics strong').allTextContents()).toEqual(metrics)
 await expect.poll(()=>waiting).toBe(true);hold=false;release()
 await expect(page.locator('[data-table-id="posvenda.analysis.reason"]')).toBeVisible()
 await expect(page.locator('#aftersales-analysis .loading-overlay')).toHaveCount(0)
 await dimensions.getByRole('button',{name:'Pesquisa de documentos',exact:true}).click()
 hold=true
 await page.getByRole('button',{name:'Próxima página',exact:true}).click()
 await expect(page.locator('#aftersales-analysis .loading-overlay')).toBeVisible()
 await expect(page.locator('.loading-screen')).toHaveCount(0)
 await expect.poll(()=>waiting).toBe(true);hold=false;release()
 await expect(page.locator('#aftersales-analysis .loading-overlay')).toHaveCount(0)
 await expect(page.locator('.table-footer')).toContainText('21–40')
 hold=true
 await page.getByRole('button',{name:'Atualizar dados',exact:true}).click()
 await expect(page.locator('.loading-screen')).toBeVisible()
 await expect.poll(()=>waiting).toBe(true);hold=false;release();await settled(page)
 expect(await page.locator('.aftersales-metrics strong').allTextContents()).toEqual(metrics)
})

test('dimension order, hierarchy and visualization controls match the structure of Abertos',async({page})=>{
 const expected=sharedDimensions.filter(entry=>entry.id!=='research').map(entry=>entry.id)
 for(const area of ['assistencias','cancelamentos','devolucoes']){
  const data=await (await page.request.get('/api/v1/posvenda/'+area)).json()
  expect(data.analysis.options.slice(0,21).map((entry:{id:string})=>entry.id)).toEqual(expected)
  await page.goto('/'+area);await settled(page)
  const frame=page.locator('#aftersales-analysis')
  await expect(frame.getByRole('button',{name:'Resumo Mensal',exact:true})).toHaveAttribute('aria-pressed','true')
  await frame.scrollIntoViewIfNeeded()
  await expect(frame.locator('.progress-track').first()).toBeVisible()
  const parent=frame.locator('tbody tr').first()
  await parent.getByRole('button',{name:/Expandir/}).click()
  await expect(frame.locator('tbody tr.child-row').first()).toBeVisible()
  await frame.getByRole('button',{name:'Configurar Análise por dimensão',exact:true}).click()
  const config=page.getByRole('region',{name:'Configurações de Análise por dimensão',exact:true})
  await expect(config.getByRole('group',{name:'Tipo de gráfico',exact:true})).toBeVisible()
  await expect(config.getByRole('group',{name:'Métrica',exact:true})).toBeVisible()
  await expect(config.getByLabel('Níveis da hierarquia', {exact:true})).toBeVisible()
  await expect(config.getByRole('group',{name:'Colunas exibidas',exact:true})).toBeVisible()
  await config.getByLabel('Níveis da hierarquia',{exact:true}).fill('Mes_Grupo,UF,CLIENTE,DOCUMENTO')
  const hierarchy=page.waitForResponse(response=>response.url().includes('/posvenda/'+area+'?')&&new URL(response.url()).searchParams.has('hierarchy'))
  await config.getByRole('button',{name:'Aplicar hierarquia',exact:true}).click()
  expect((await (await hierarchy).json()).analysis.hierarchy).toEqual(['month','uf','client','document'])
  await config.getByLabel('Treemap',{exact:true}).check()
  await config.getByLabel('Peso (Ton)',{exact:true}).check()
  await expect(frame.locator('.loading-overlay')).toHaveCount(0,{timeout:30000})
  await expect(frame.locator('[data-series-id="posvenda.dimension"] canvas')).toBeVisible()
  await expect(config.getByLabel('Quantidade exibida',{exact:true})).toBeVisible()
  await config.getByLabel('Evolução Mensal',{exact:true}).check()
  await expect(frame.locator('[data-series-id="posvenda.analysis.evolution"] canvas')).toBeVisible()
  await config.getByRole('button',{name:'Fechar configurações',exact:true}).click()
 }
})

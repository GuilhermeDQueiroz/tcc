import {test,expect} from '@playwright/test'

test.use({baseURL:'http://127.0.0.1:3002'})
test.setTimeout(240_000)

const sections=[
 {path:'/estrategico',title:'Visão Estratégica',tabs:2},
 {path:'/abertos',title:'Análise de Pedidos em Aberto',tabs:5},
 {path:'/faturados',title:'Análise Logística dos Pedidos Faturados',tabs:5},
 {path:'/cargas',title:'Formação de Cargas',tabs:5},
 {path:'/assistencias',title:'Assistências',tabs:3},
 {path:'/cancelamentos',title:'Cancelamentos de venda',tabs:3},
 {path:'/devolucoes',title:'Devoluções',tabs:3}
]

test('every sidebar destination has the correct header and the shared filter keyboard behavior',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto('/cargas')
 for(const section of sections){
  await page.locator(`.sidebar nav a[href="${section.path}"]`).click()
  await expect(page).toHaveURL(new RegExp(section.path+'$'))
  await expect(page.locator('.sidebar nav a[aria-current="page"]')).toHaveCount(1)
  await expect(page.locator('.app-header h1')).toHaveText(section.title)
  await expect(page.locator('.loading-screen')).toHaveCount(0,{timeout:60_000})
  await expect(page.locator('.metric-card').first()).toBeVisible({timeout:60_000})
  const trigger=page.getByRole('button',{name:'Filtros',exact:true})
  await trigger.click()
  const dialog=page.getByRole('dialog')
  await expect(dialog).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded','true')
  await expect(dialog.locator('.filter-modal-title')).toHaveText('Filtros avançados')
  await expect(dialog.getByRole('tab')).toHaveCount(section.tabs)
  await expect(dialog.getByRole('button',{name:'Cancelar',exact:true})).toBeVisible()
  if(section.path==='/cargas')await page.screenshot({path:'.local/navigation-filter-desktop.png'})
  await dialog.press('Shift+Tab')
  await expect(dialog.getByRole('button',{name:'Aplicar filtros',exact:true})).toBeFocused()
  await dialog.getByRole('button',{name:'Aplicar filtros',exact:true}).press('Tab')
  await expect(dialog.getByRole('button',{name:'Fechar filtros',exact:true})).toBeFocused()
  const first=dialog.getByRole('tab').first(),last=dialog.getByRole('tab').last()
  await first.focus();await first.press('End');await expect(last).toBeFocused()
  await last.press('Home');await expect(first).toBeFocused()
  await first.press('Escape');await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false')
 }
 expect(errors).toEqual([])
})

test('route changes dismiss old filters and post-sale filter drafts remain local',async({page})=>{
 await page.goto('/assistencias')
 await expect(page.locator('.aftersales-metrics')).toHaveAttribute('aria-busy','false',{timeout:60_000})
 await page.getByRole('button',{name:'Filtros',exact:true}).click()
 let dialog=page.getByRole('dialog')
 await dialog.getByLabel('Data inicial',{exact:true}).fill('2026-09-30')
 await dialog.getByLabel('Data final',{exact:true}).fill('2026-01-01')
 await dialog.getByRole('button',{name:'Aplicar filtros',exact:true}).click()
 await expect(dialog.getByRole('alert')).toContainText('anterior')
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
 await page.getByRole('button',{name:'Filtros',exact:true}).click()
 await expect(dialog.getByLabel('Data inicial',{exact:true})).toHaveValue('')
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
 await page.locator('.sidebar a[href="/cancelamentos"]').click()
 await page.getByRole('button',{name:'Filtros',exact:true}).click()
 await page.goBack()
 await expect(page).toHaveURL(/\/assistencias$/)
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.goForward()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.getByRole('button',{name:'Filtros Avançados',exact:true}).click()
 dialog=page.getByRole('dialog')
 await expect(dialog).toHaveAttribute('aria-label','Filtros · Pós-venda')
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
 await expect(page.getByRole('button',{name:'Filtros Avançados',exact:true})).toBeFocused()
})

test('header filter and centered sidebar stay usable on narrow screens and collapsed navigation',async({page})=>{
 await page.goto('/cargas')
 await expect(page.locator('.loading-screen')).toHaveCount(0,{timeout:60_000})
 const centered=await page.locator('.sidebar .sidebar-filter').evaluate(el=>getComputedStyle(el).justifyContent)
 expect(centered).toBe('center')
 await page.getByRole('button',{name:'Recolher menu',exact:true}).click()
 await expect(page.locator('.sidebar')).toHaveCSS('width','72px')
 const first=page.locator('.sidebar nav a').first();await first.focus();await first.press('End')
 await expect(page.locator('.sidebar nav a').last()).toBeFocused()
 await page.getByRole('button',{name:'Expandir menu',exact:true}).click()
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844})
  await page.getByRole('button',{name:'Filtros',exact:true}).click()
  const dialog=page.getByRole('dialog')
  for(const name of ['Cancelar','Aplicar filtros','Limpar filtros'])await expect(dialog.getByRole('button',{name,exact:true})).toBeInViewport()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
 }
 await page.getByRole('button',{name:'Abrir menu',exact:true}).click()
 await page.locator('.sidebar a[href="/devolucoes"]').click()
 await expect(page.locator('.sidebar')).toHaveCSS('visibility','hidden')
 await expect(page.locator('.app-header h1')).toHaveText('Devoluções')
 await expect(page.locator('.aftersales-metrics')).toHaveAttribute('aria-busy','false',{timeout:60_000})
 await page.getByRole('button',{name:'Filtros',exact:true}).click()
 await page.screenshot({path:'.local/navigation-filter-mobile.png'})
})

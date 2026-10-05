import {test,expect} from '@playwright/test'

test('layout segue as medidas e tokens do portal, preservando cards reais ao recolher o menu',async({page})=>{
  await page.goto('/abertos')
  await expect(page.locator('[data-testid="metric-card"]').first()).toBeVisible()
  await expect(page.locator('.dimension-tabs')).toBeVisible()
  const style=await page.evaluate(()=>{
    const css=(selector:string)=>getComputedStyle(document.querySelector(selector)!)
    return {sidebar:css('.sidebar').width,header:css('.app-header').height,bg:css('body').backgroundColor,
      cardBorder:css('.metric-card').borderLeftWidth,cardColor:css('.metric-card').borderLeftColor,
      cardRadius:css('.metric-card').borderRadius,label:css('.metric-label').textTransform,
      tabs:css('.analysis-tabs').backgroundColor,scroll:css('.main-shell main').overflowY}
  })
  expect(style).toEqual({sidebar:'240px',header:'56px',bg:'rgb(244, 246, 244)',cardBorder:'4px',
    cardColor:'rgb(139, 197, 63)',cardRadius:'16px',label:'uppercase',tabs:'rgb(255, 255, 255)',scroll:'auto'})
  await expect(page.getByAltText('TCC · Inteligência Logística')).toBeVisible()
  const values=await page.locator('.metric-card > strong').allTextContents()
  await page.getByRole('button',{name:'Recolher menu',exact:true}).click()
  const midway=await page.locator('.sidebar').evaluate(async sidebar=>{
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
    return {width:sidebar.getBoundingClientRect().width,duration:getComputedStyle(sidebar).transitionDuration}
  })
  expect(midway.width).toBeGreaterThan(72);expect(midway.width).toBeLessThan(240)
  expect(midway.duration).toContain('0.55s')
  await expect(page.locator('.sidebar')).toHaveCSS('width','72px')
  await expect(page.locator('.sidebar .nav-label').first()).toHaveCSS('opacity','0')
  expect(await page.locator('.metric-card > strong').allTextContents()).toEqual(values)
  await page.getByRole('button',{name:'Expandir menu',exact:true}).click()
  await expect(page.locator('.sidebar')).toHaveCSS('width','240px')
  await expect(page.locator('.sidebar .nav-label').first()).toHaveCSS('opacity','1')
  await page.screenshot({path:'tests/ui/screenshots/portal-layout-desktop.png'})
})

test('layout mobile usa o drawer de 256px e mantém o cabeçalho de 56px',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/abertos?tab=pesquisa')
  await expect(page.locator('.app-header')).toHaveCSS('height','56px')
  await page.getByRole('button',{name:'Abrir menu',exact:true}).click()
  await expect(page.locator('.sidebar')).toHaveCSS('width','256px')
  await expect(page.locator('.sidebar')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)')
  await expect(page.getByRole('link',{name:'Pedidos Faturados',exact:true})).toBeVisible()
  await page.screenshot({path:'tests/ui/screenshots/portal-layout-mobile-menu.png'})
  await page.getByRole('button',{name:'Fechar menu',exact:true}).click()
  await expect(page.locator('.menu-backdrop')).toHaveCount(0)
  await expect(page.locator('.sidebar')).toHaveCSS('opacity','0')
  await expect(page.locator('.sidebar')).toHaveCSS('visibility','hidden')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('sidebar respeita movimento reduzido e alterna repetidamente sem perder a navegação',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/abertos')
  await expect(page.locator('.sidebar')).toHaveCSS('transition-duration','0.01s')
  for(let step=0;step<2;step++){
    await page.getByRole('button',{name:'Recolher menu',exact:true}).click()
    await expect(page.locator('.sidebar')).toHaveCSS('width','72px')
    await page.getByRole('button',{name:'Expandir menu',exact:true}).click()
    await expect(page.locator('.sidebar')).toHaveCSS('width','240px')
    await expect(page.getByRole('link',{name:'Pedidos em Aberto',exact:true})).toBeVisible()
  }
})

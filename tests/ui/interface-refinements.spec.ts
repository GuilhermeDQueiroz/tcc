import { test, expect } from '@playwright/test'

test.setTimeout(90_000)

test('identidade TCC, fontes comuns e menu de configuração inteiro no desktop e celular', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/abertos')
  await expect(page.locator('.overview-metrics > .metric-card').first()).toBeVisible()
  await expect(page.getByAltText('TCC · Inteligência Logística')).toBeVisible()
  await expect(page.locator('.header-context h1')).toHaveCSS('font-size','16px')
  await expect(page.locator('.sidebar-separator')).toHaveCount(2)
  const metaResponse=await page.request.get('/api/v1/bi/abertos/resumo')
  expect(metaResponse.ok()).toBe(true)
  const publishedAt=(await metaResponse.json()).meta.publishedAt
  await expect(page.locator('.sidebar-last-update time')).toHaveAttribute('datetime',new Date(publishedAt).toISOString())
  const formatted=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(publishedAt)).replace(',',' às')
  await expect(page.locator('.sidebar-last-update time')).toHaveText(formatted)
  const brandGap=await page.evaluate(()=>document.querySelector('.sidebar-caption')!.getBoundingClientRect().top-document.querySelector('.brand img')!.getBoundingClientRect().bottom)
  expect(brandGap).toBeLessThanOrEqual(12)
  await expect(page.locator('.sidebar-group,.page-footnote')).toHaveCount(0)
  const orders = page.locator('[data-metric-id="abertos.resumo.orders"]')
  await expect(orders.locator('dt')).toHaveText(['Varejo', 'E-commerce'])
  await expect(page.locator('[data-metric-id="abertos.resumo.serviceDays"] dt')).toHaveText(['Varejo', 'E-commerce'])
  await expect(orders.locator('.metric-details dt')).toHaveCount(0)
  await orders.getByRole('button',{name:'Sobre Qtd pedidos',exact:true}).hover()
  await expect(orders.getByRole('tooltip')).toBeVisible()
  await expect(orders.getByRole('tooltip')).toContainText('Varejo')
  const values = await page.locator('.overview-metrics > .metric-card > strong').evaluateAll(elements => elements.map(element => {
    const range=document.createRange();range.selectNodeContents(element)
    return {font:parseFloat(getComputedStyle(element).fontSize),width:element.clientWidth,textWidth:range.getBoundingClientRect().width}
  }))
  expect(values.every(value=>value.font>=12 && value.font<=26 && value.textWidth<=value.width+1)).toBe(true)
  await expect(orders.locator('.metric-label')).toHaveCSS('font-size', '12px')
  await page.screenshot({ path: 'tests/ui/screenshots/tcc-interface-desktop.png', animations: 'disabled' })

  const chart = page.locator('[data-series-id="abertos.resumo.Mes_Grupo"]')
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    await page.setViewportSize(viewport)
    await chart.getByRole('button', { name: 'Configurar Evolução mensal do backlog', exact:true }).click()
    const config = page.getByRole('region', { name: 'Configurações de Evolução mensal do backlog', exact:true })
    await expect(config).toBeVisible()
    const bounds = await config.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(16)
    expect(bounds!.y).toBeGreaterThanOrEqual(16)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 15)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 15)
    await expect(config.getByRole('button', { name:'Fechar configurações' })).toBeVisible()
    await config.getByLabel('Evolução mensal', {exact:true}).check()
    await config.getByLabel('Quantidade exibida', {exact:true}).selectOption('10')
    await config.getByRole('button', {name:'Expandir em tela cheia',exact:true}).scrollIntoViewIfNeeded()
    await page.screenshot({path:`tests/ui/screenshots/tcc-config-${viewport.width}.png`, animations:'disabled'})
    await page.keyboard.press('Escape')
    await expect(config).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})

test('altura estável e spinner central dentro da mesma tabela durante troca de métrica e dimensão', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.goto('/abertos')
  const dimensions = page.locator('.overview-dimensions')
  const table = dimensions.locator('.analytic-table')
  await expect(table.locator('tbody tr')).toHaveCount(7)
  const element = await table.locator('table').elementHandle()
  await table.locator('table').evaluate(node => node.setAttribute('data-preserved','true'))
  const initialHeight = await table.locator('.table-viewport').evaluate(node => node.getBoundingClientRect().height)
  expect(initialHeight).toBe(440)
  await expect(table.locator('td').first()).toHaveCSS('font-size','14px')
  await expect(table.locator('th').first()).toHaveCSS('font-size','12px')

  await dimensions.getByRole('button',{name:'Configurar Análise por dimensão',exact:true}).click()
  const config = page.getByRole('region',{name:'Configurações de Análise por dimensão',exact:true})
  let release!: () => void
  const gate = new Promise<void>(resolve => { release=resolve })
  await page.route('**/api/v1/bi/abertos/dimensoes?**',async route => {
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    await gate
    await route.fulfill({response})
  })
  try {
    await config.getByLabel('Peso (Ton)',{exact:true}).check()
    await expect(table.locator('.loading-overlay .loading-orbit')).toBeVisible()
    expect(await element!.evaluate(node => node.isConnected)).toBe(true)
    await expect(table.locator('table')).toHaveAttribute('data-preserved','true')
    const centered = await table.locator('.table-viewport').evaluate(node => {
      const frame=node.getBoundingClientRect(),spinner=node.querySelector('.loading-orbit')! as HTMLElement,skeleton=node.querySelector('.loading-skeleton')! as HTMLElement
      const bounds=spinner.getBoundingClientRect()
      return {x:Math.abs(bounds.x+bounds.width/2-(frame.x+frame.width/2)),y:Math.abs((spinner.offsetTop+skeleton.offsetTop+skeleton.offsetHeight)/2-node.clientHeight/2)}
    })
    expect(centered.x).toBeLessThan(1)
    expect(centered.y).toBeLessThan(1)
    await expect(table.locator('.loading-orbit')).toHaveCSS('animation-duration','0.7s')
    expect(await table.locator('.table-viewport').evaluate(node => node.getBoundingClientRect().height)).toBe(initialHeight)
    await page.screenshot({path:'tests/ui/screenshots/tcc-table-loading.png',animations:'disabled'})
  } finally { release() }
  await expect(table.locator('.loading-overlay')).toHaveCount(0,{timeout:60_000})
  await page.unroute('**/api/v1/bi/abertos/dimensoes?**')
  await page.keyboard.press('Escape')
  await dimensions.getByRole('button',{name:'Faixa de Tempo',exact:true}).click()
  await expect(table.locator('tbody tr')).toHaveCount(5)
  expect(await table.locator('.table-viewport').evaluate(node => node.getBoundingClientRect().height)).toBe(initialHeight)
  expect(await element!.evaluate(node => node.isConnected)).toBe(true)
  await expect(table.locator('thead th')).toHaveCount(11)
  await expect(table.locator('thead th').first()).toContainText('Faixa de Tempo')
})

test('spinner central da tela conserva o painel durante atualização; pesquisa conserva tabela na paginação',async ({page}) => {
  await page.goto('/abertos')
  await expect(page.locator('.open-overview')).toBeVisible()
  const original = await page.locator('.open-overview').elementHandle()
  let release!:()=>void
  const gate = new Promise<void>(resolve => {release=resolve})
  await page.route('**/api/v1/bi/abertos/resumo?**',async route => {
    const response=await route.fetch();expect(response.status()).toBe(200);await gate;await route.fulfill({response})
  })
  try {
    await page.getByRole('button',{name:'Atualizar dados',exact:true}).click()
    await expect(page.locator('.loading-screen .loading-orbit')).toBeVisible()
    expect(await original!.evaluate(node=>node.isConnected)).toBe(true)
    const spinner = await page.locator('.loading-screen .loading-orbit').boundingBox()
    expect(Math.abs(spinner!.x+spinner!.width/2-720)).toBeLessThan(1)
    expect(Math.abs(spinner!.y+spinner!.height/2-450)).toBeLessThan(1)
  } finally {release()}
  await expect(page.locator('.loading-screen')).toHaveCount(0)
  await page.unroute('**/api/v1/bi/abertos/resumo?**')

  const dimensions=page.locator('.overview-dimensions')
  await dimensions.getByRole('button',{name:'Pesquisa de Pedidos',exact:true}).click()
  const table=page.locator('[data-table-id="abertos-orders"]')
  await expect(table.locator('tbody tr')).toHaveCount(1378)
  const element=await table.locator('table').elementHandle()
  const viewportBefore=await table.locator('.table-viewport').evaluate(node=>node.getBoundingClientRect().height)
  let allow!:()=>void
  const hold=new Promise<void>(resolve=>{allow=resolve})
  await page.route('**/api/v1/bi/abertos/detalhes?**',async route=>{
    const response=await route.fetch();expect(response.status()).toBe(200);await hold;await route.fulfill({response})
  })
  try {
    await table.locator('th').filter({hasText:'Valor (R$)'}).getByRole('button').click()
    await expect(table.locator('.loading-overlay')).toBeVisible()
    expect(await element!.evaluate(node=>node.isConnected)).toBe(true)
    await expect(table.locator('tbody tr')).toHaveCount(1378)
  } finally {allow()}
  await expect(table.locator('.loading-overlay')).toHaveCount(0)
  expect(await element!.evaluate(node=>node.isConnected)).toBe(true)
  await expect(table.locator('.table-footer')).toHaveCount(0)
  await page.unroute('**/api/v1/bi/abertos/detalhes?**')
  await dimensions.getByLabel('Pesquisar pedidos',{exact:true}).fill('__TCC_sem_registro_9c2187d1__')
  await dimensions.getByRole('button',{name:'Pesquisar',exact:true}).click()
  await expect(table.locator('.empty-table')).toBeVisible()
  await expect(table.locator('.table-footer')).toHaveCount(0)
  expect(await table.locator('.table-viewport').evaluate(node=>node.getBoundingClientRect().height)).toBeCloseTo(viewportBefore,2)
  expect(await element!.evaluate(node=>node.isConnected)).toBe(true)
})

test('surgimento suave respeita preferência de movimento reduzido', async ({page}) => {
  await page.addInitScript(()=>{
    Object.assign(window,{cardEntrances:[]})
    const original=Element.prototype.animate
    Element.prototype.animate=function(...args:Parameters<typeof original>){
      if(this.matches('.metric-card'))(window as any).cardEntrances.push(args[0])
      return original.apply(this,args)
    }
  })
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.goto('/abertos')
  const card=page.locator('.overview-metrics > .metric-card').first()
  await expect(page.locator('.loading-screen')).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>(window as any).cardEntrances.length)).toBeGreaterThan(0)
  expect(await page.evaluate(()=>(window as any).cardEntrances.some((frames:any[])=>frames.some(frame=>frame.transform)))).toBe(true)
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.reload()
  await expect(page.locator('.loading-screen')).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>(window as any).cardEntrances.length)).toBeGreaterThan(0)
  expect(await page.evaluate(()=>(window as any).cardEntrances.every((frames:any[])=>frames.every(frame=>frame.transform===undefined)))).toBe(true)
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('data-entrance','ready')
  await expect(card).toHaveCSS('opacity','1')
})

import { test, expect } from '@playwright/test'
import { captureRealApi,realPayload } from './real-api'
test.beforeEach(async ({page},info)=>captureRealApi(page,info))

test.describe('API PostgreSQL real publicada pelo Hop', () => {
  test.setTimeout(180_000)
  for (const [area, tabs] of Object.entries({ abertos: ['resumo','calendario','geografia','dimensoes','pesquisa'], emitidos: ['semanal','mensal','evolucao','geografia','carteira','dimensoes','pesquisa'], faturados: ['semanal','mensal','evolucao','geografia','carteira','dimensoes','pesquisa'] })) {
    test(`${area} renderiza todos os cards, gráficos e tabelas fornecidos pela API real`, async ({ page }) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
      let filterRequests=0
      page.on('request',request=>{if(request.url().includes(`/api/v1/bi/${area}/filtros?`))filterRequests++})
      for (const tab of tabs) {
        const previousRequests=filterRequests
        const waiting = page.waitForResponse(response => response.url().includes(`/api/v1/bi/${area}/${tab}?`))
        const detailsWaiting=tab==='pesquisa' ? page.waitForResponse(response=>response.url().includes(`/api/v1/bi/${area}/detalhes?`)) : undefined
        await page.goto(`/${area}?tab=${tab}`)
        const payload = await realPayload(page,waiting)
        expect(payload.source).toMatch(/hop|postgres|firebird/i)
        expect(payload.dataVersion).toBeTruthy()
        await expect(page.locator('[data-testid="metric-card"]')).toHaveCount(payload.metrics.length)
        const values = await page.evaluate(async metrics => {
          const { formatValue } = await import('/src/composables/useFormatters.ts')
          return metrics.map((metric: { value: unknown; format?: string }) => formatValue(metric.value,metric.format))
        }, payload.metrics)
        const detailValues=await page.evaluate(async metrics=>{
          const {formatValue}=await import('/src/composables/useFormatters.ts')
          return metrics.map((metric:any)=>[...(metric.comparisons || []),...(metric.supplementary || [])].map(detail=>({label:detail.label,value:formatValue(detail.value,detail.format || metric.format),percentage:detail.percentage==null?null:formatValue(detail.percentage,'percent')})))
        },payload.metrics)
        for (const [index,metric] of payload.metrics.entries()) {
          const card=page.locator(`[data-metric-id="${metric.id}"]`)
          await expect(card.locator('.metric-label')).toContainText(metric.label)
          await expect(card.locator('strong').first()).toHaveText(values[index])
          for(const detail of detailValues[index]) {
            const container=/varejo|e[- ]?commerce/i.test(detail.label)?'.metric-tooltip-details':'.metric-details'
            const detailIndex=(await card.locator(`${container} dt`).allTextContents()).indexOf(detail.label)
            expect(detailIndex).toBeGreaterThanOrEqual(0)
            await expect(card.locator(`${container} dt`).nth(detailIndex)).toHaveText(detail.label)
            await expect(card.locator(`${container} dd`).nth(detailIndex)).toContainText(detail.value)
            if(detail.percentage!=null)await expect(card.locator(`${container} dd`).nth(detailIndex).locator('small')).toHaveText(detail.percentage)
          }
        }
        const organizedOverview=area==='abertos'&&tab==='resumo'

        for (const series of payload.series) {
          if(organizedOverview && ['abertos.resumo.Mes_Previsao','abertos.resumo.Canal'].includes(series.id))continue
          if (series.type === 'calendar') await expect(page.locator('.forecast-calendar')).toBeVisible()
          else await expect(page.locator(`[data-series-id="${series.id}"]`)).toBeVisible()
        }
        if(organizedOverview){
          await expect(page.locator('.overview-metrics > *')).toHaveCount(10)
          await expect(page.locator('[data-table-id="abertos.dimensoes.Mes_Grupo"]')).toBeVisible()
          await expect(page.locator('.overview-dimensions .analytic-table')).toHaveCount(1)
        }else for (const table of payload.tables) await expect(page.locator(`[data-table-id="${table.id}"]`)).toBeVisible()
        expect(filterRequests-previousRequests).toBe(1)
        if (detailsWaiting) {
          await realPayload(page,detailsWaiting)
          await expect(page.locator(`[data-table-id="${area}-details"]`)).toBeVisible()
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await expect(page.locator('.analytic-chart [role="alert"]')).toHaveCount(0)
      }
      expect(errors).toEqual([])
    })
  }

  test('presets salvam e excluem um recorte com valores reais', async ({ page }) => {
    await page.goto('/abertos')
    const name = `Verificação UI ${Date.now()}`
    await page.getByRole('button', { name: 'Filtros Avançados', exact: true }).click()
    await page.getByRole('tab', { name: 'Localização' }).click()
    const uf = page.getByLabel('Estado (UF)', { exact: true })
    await uf.click()
    const option=page.getByRole('listbox',{name:'Opções de Estado (UF)',exact:true}).getByRole('option').first()
    await expect(option).toBeVisible()
    await option.click()
    await uf.press('Escape')
    await page.getByLabel('Novo preset').fill(name)
    await page.getByRole('button', { name: 'Salvar preset' }).click()
    const presets = page.getByLabel('Presets', { exact: true })
    await expect(presets.locator('option', { hasText: name })).toHaveCount(1)
    await presets.selectOption({ label:name })
    await page.getByRole('button', { name: 'Excluir preset' }).click()
    await expect(presets.locator('option', { hasText:name })).toHaveCount(0)
  })

  test('resposta antiga real não substitui um filtro aplicado depois', async ({ page }) => {
    let release!: () => void, fetched!: () => void
    const gate = new Promise<void>(resolve => { release=resolve }), ready = new Promise<void>(resolve => { fetched=resolve })
    let number=0
    await page.route('**/api/v1/bi/abertos/resumo?**', async route => {
      number++
      if (number === 1) { const response=await route.fetch(); fetched(); await gate; await route.fulfill({ response }).catch(() => undefined) }
      else await route.continue()
    })
    await page.goto('/abertos'); await ready
    await page.getByRole('button', { name:'Filtros Avançados', exact:true }).click()
    await page.getByRole('tab', { name:'Localização' }).click()
    const uf=page.getByLabel('Estado (UF)', { exact:true }); await uf.click()
    const option=page.getByRole('listbox',{name:'Opções de Estado (UF)',exact:true}).getByRole('option').first()
    await expect(option).toBeVisible();await option.click();await uf.press('Escape')
    const waiting=page.waitForResponse(response => response.url().includes('/api/v1/bi/abertos/resumo?'))
    await page.getByRole('button', { name:'Aplicar filtros' }).click()
    const selected=await realPayload(page,waiting); await expect(page.locator('[data-testid="metric-card"]')).toHaveCount(selected.metrics.length)
    const firstCard=page.locator('[data-testid="metric-card"]').first(), text=await firstCard.textContent(); release()
    await expect(page.getByRole('button', { name:/Remover filtro Estado/ })).toBeVisible()
    await expect(firstCard).toHaveText(text!)
  })

  test('pesquisa mantém colunas disponíveis, ordenação, paginação e exportação reais', async ({ page }) => {
    await page.goto('/abertos?tab=pesquisa')
    const table=page.locator('[data-table-id="abertos-details"]'); await expect(table).toBeVisible(); await expect(table).not.toHaveAttribute('aria-busy','true')
    const headers=await table.locator('thead th').allTextContents(); expect(headers.length).toBeGreaterThan(1)
    await table.getByRole('button', { name:'Configurar Pesquisa de pedidos',exact:true }).click()
    const last=page.getByRole('region',{name:'Configurações de Pesquisa de pedidos',exact:true}).locator('input[type="checkbox"]').last()
    await last.click(); await expect(table).toBeVisible()
    await expect(table.locator('thead th')).toHaveCount(headers.length-1)
    await expect(table.getByRole('button', { name:'Configurar Pesquisa de pedidos',exact:true })).toHaveAttribute('aria-expanded','true')
    await expect(page.getByRole('region',{name:'Configurações de Pesquisa de pedidos',exact:true}).locator('input[type="checkbox"]')).toHaveCount(headers.length)
    await page.getByRole('region',{name:'Configurações de Pesquisa de pedidos',exact:true}).locator('input[type="checkbox"]').last().click()
    await expect(table.locator('thead th')).toHaveCount(headers.length)
    await page.getByRole('button',{name:'Fechar configurações',exact:true}).click()
    await table.locator('thead button').first().click()
    await expect(table.locator('thead th').first()).toHaveAttribute('aria-sort','descending')
    if (await table.getByRole('button', { name:'Próxima página' }).isEnabled()) {
      await table.getByRole('button', { name:'Próxima página' }).click()
      await expect(table.locator('.table-footer')).toContainText('2 /')
    }
    await table.getByRole('button', {name:'Configurar Pesquisa de pedidos',exact:true}).click()
    const exported=page.waitForEvent('download'); await page.getByRole('region',{name:'Configurações de Pesquisa de pedidos',exact:true}).getByRole('button', { name:/Exportar CSV/ }).click()
    const file=await exported; expect(file.suggestedFilename()).toMatch(/abertos.*\.csv$/)
  })

  test('calendário aplica a data real de previsão ao detalhe', async ({ page }) => {
    const waiting=page.waitForResponse(response=>response.url().includes('/api/v1/bi/abertos/calendario?'))
    await page.goto('/abertos?tab=calendario')
    const payload=await realPayload(page,waiting), calendar=payload.series.find((series:{type:string})=>series.type==='calendar'), date=calendar.rows[0].date
    await page.getByRole('button', {name:`Detalhar previsão de ${date}`}).click()
    await expect(page.getByRole('button', {name:/Remover filtro Previsão/})).toBeVisible()
    await expect(page.locator('[data-table-id="abertos-details"]')).toBeVisible()
  })

  test('HTML preserva células numéricas reais semanais, carteira e evolução, incluindo filhos', async ({ page }) => {
    for (const area of ['emitidos','faturados']) for (const tab of ['semanal','carteira','evolucao']) {
      const waiting=page.waitForResponse(response=>response.url().includes(`/api/v1/bi/${area}/${tab}?`))
      await page.goto(`/${area}?tab=${tab}`)
      const payload=await realPayload(page,waiting)
      for (const source of payload.tables) {
        const root=source.tree?.[0] || source.rows[0]; if (!root) continue
        const table=page.locator(`[data-table-id="${source.id}"]`); await expect(table).toBeVisible()
        const expected=await page.evaluate(async ({ row,columns })=>{
          const { formatValue,inferFormat }=await import('/src/composables/useFormatters.ts')
          return columns.map((column:{key:string;format?:string},index:number)=>({index,value:typeof row[column.key]==='number' ? formatValue(row[column.key],column.key==='% Part' || column.format==='progress' ? 'progress' : column.format || inferFormat(column.key)) : null}))
        }, {row:root,columns:source.columns})
        for (const cell of expected) if (cell.value!==null) await expect(table.locator('tbody tr').first().locator('td').nth(cell.index)).toHaveText(cell.value)
        if (root.children?.length) {
          await table.locator('tbody tr').first().getByRole('button', {name:/Expandir/}).click()
          const child=root.children[0], childExpected=await page.evaluate(async ({row,columns})=>{
            const {formatValue,inferFormat}=await import('/src/composables/useFormatters.ts')
            return columns.map((column:{key:string;format?:string},index:number)=>({index,value:typeof row[column.key]==='number' ? formatValue(row[column.key],column.key==='% Part' || column.format==='progress' ? 'progress' : column.format || inferFormat(column.key)) : null}))
          }, {row:child,columns:source.columns})
          for (const cell of childExpected) if (cell.value!==null) await expect(table.locator('tbody tr').nth(1).locator('td').nth(cell.index)).toHaveText(cell.value)
        }
      }
    }
  })

  test('drilldown de código numérico mantém o pedido real selecionado', async ({ page }) => {
    const initial=page.waitForResponse(response=>response.url().includes('/api/v1/bi/abertos/detalhes?'))
    await page.goto('/abertos?tab=pesquisa')
    const source=await realPayload(page,initial), code=source.rows[0].CODIGO_PEDIDO
    expect(code).toBeTruthy()
    const index=source.columns.findIndex((column:{key:string})=>column.key==='CODIGO_PEDIDO')
    expect(index).toBeGreaterThanOrEqual(0)
    const table=page.locator('[data-table-id="abertos-details"]')
    await expect(table).toBeVisible()
    if(index>0) {
      for(const [columnIndex,column] of source.columns.slice(0,index).entries()) {
        await table.getByRole('button',{name:'Configurar Pesquisa de pedidos',exact:true}).click()
        await table.getByLabel(column.key,{exact:true}).click()
        await expect(table.locator('thead th')).toHaveCount(source.columns.length-columnIndex-1)
      }
      await expect(table.locator('thead th').first()).toContainText('CODIGO_PEDIDO')
    }
    const waiting=page.waitForResponse(response=>response.url().includes('/api/v1/bi/abertos/detalhes?') && new URL(response.url()).searchParams.get('filters')?.includes('CODIGO_PEDIDO')===true)
    await table.locator('tbody tr').first().locator('td').first().getByRole('button').click()
    const selected=await realPayload(page,waiting)
    expect(selected.total).toBeGreaterThan(0)
    expect(selected.rows.every((row:{CODIGO_PEDIDO:number|string})=>String(row.CODIGO_PEDIDO)===String(code))).toBe(true)
    await expect(page.getByRole('button',{name:/Remover filtro Pedido/})).toBeVisible()
  })
})

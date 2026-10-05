import { expect, type Page, type Response, type TestInfo } from '@playwright/test'

const captures=new WeakMap<Page,Map<string,{payload:any;status:number}>>()
const testInfos=new WeakMap<Page,TestInfo>()
// Read the original HTTP body before Chrome's inspector evicts large portfolios.
// Forward that same response; this makes one real request and supplies no fixture.
export async function captureRealApi(page:Page,info:TestInfo) {
  const responses=new Map<string,{payload:any;status:number}>(); captures.set(page,responses)
  testInfos.set(page,info)
  await page.route('**/api/v1/bi/*/carteira?**',async route=>{
    const response=await route.fetch({timeout:180_000}), body=await response.body(), payload=JSON.parse(body.toString())
    responses.set(route.request().url(),{payload,status:response.status()})
    if(response.ok()) {
      const pending=[...(payload.tables || []).flatMap((table:any)=>table.tree || [])]; let nodes=0
      while(pending.length){const node=pending.pop();nodes++;pending.push(...(node.children || []))}
      await info.attach(`portfolio-${payload.area}`,{body:JSON.stringify({bytes:body.length,rows:(payload.tables || []).reduce((sum:number,table:any)=>sum+(table.rows?.length || 0),0),nodes}),contentType:'application/json'})
    }
    await route.fulfill({response}).catch(()=>undefined)
  })
}
export async function realPayload(page:Page,waiting:Promise<Response>) {
  const response=await waiting, captured=captures.get(page)?.get(response.url()), payload=captured ? captured.payload : await response.json()
  expect(response.status(),JSON.stringify(payload.error || payload)).toBe(200)
  if(captured) expect(captured.status).toBe(response.status())
  const url=new URL(response.url()), parts=url.pathname.split('/'), area=payload.area || parts[4], tab=payload.tab || parts[5]
  await testInfos.get(page)?.attach(`real-data-${area}-${tab}`,{body:JSON.stringify({area,tab,dataVersion:payload.dataVersion,metrics:payload.metrics?.length || 0,series:payload.series?.length || 0,tables:payload.tables?.length || 0,records:payload.meta?.records ?? payload.total ?? null,filters:url.searchParams.get('filters')}),contentType:'application/json'})
  return payload
}

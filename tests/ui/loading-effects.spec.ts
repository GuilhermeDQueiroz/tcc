import {test,expect} from '@playwright/test'

test.setTimeout(90_000)
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  const events:{kind:string;duration:number}[]=[]
  const starts=new WeakMap<Element,number>()
  const animations:{kind:string;time:number;frames:unknown}[]=[]
  Object.assign(window,{loadingEvents:events,entranceEvents:animations})
  const original=Element.prototype.animate
  Element.prototype.animate=function(...args:Parameters<typeof original>){
   if(this.matches('.metric-card,.analysis-frame,.sidebar,.app-header'))animations.push({kind:this.className,time:performance.now(),frames:args[0]})
   return original.apply(this,args)
  }
  const find=(node:Element)=>[...(node.matches('.legacy-loading')?[node]:[]),...node.querySelectorAll('.legacy-loading')]
  new MutationObserver(records=>{
   for(const record of records){
    for(const node of record.addedNodes)if(node instanceof Element)for(const loader of find(node))if(!starts.has(loader))starts.set(loader,performance.now())
    for(const node of record.removedNodes)if(node instanceof Element)for(const loader of find(node)){
     const start=starts.get(loader);if(start!==undefined && !loader.isConnected)events.push({kind:loader.className,duration:performance.now()-start})
    }
   }
  }).observe(document,{childList:true,subtree:true})
 })
})

test('loading legacy dura pelo menos 2 segundos e repete surgimento após atualizar dados reais',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'})
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto('/abertos',{waitUntil:'domcontentloaded'})
 const loader=page.locator('.loading-screen')
 await expect(loader).toBeVisible()
 await expect(loader.locator('.loader-spinner')).toHaveCSS('width','56px')
 await expect(loader.locator('.loader-spinner')).toHaveCSS('animation-duration','0.75s')
 await expect(loader).toHaveCSS('background-color','rgb(244, 246, 244)')
 await expect(loader).toHaveCount(0)
 await expect(page.locator('.metric-card')).toHaveCount(13)
 const initial=await page.evaluate(()=>({events:(window as any).loadingEvents,entrances:(window as any).entranceEvents.length}))
 expect(initial.events.find((event:any)=>event.kind.includes('loading-screen')).duration).toBeGreaterThanOrEqual(1980)
 expect(initial.entrances).toBeGreaterThan(0)
 const value=await page.locator('.metric-card').first().locator('strong').innerText()
 await page.getByRole('button',{name:'Atualizar dados',exact:true}).click()
 await expect(loader).toBeVisible();await expect(loader).toHaveCount(0)
 await expect.poll(()=>page.evaluate(()=>(window as any).entranceEvents.length)).toBeGreaterThan(initial.entrances)
 expect(await page.locator('.metric-card').first().locator('strong').innerText()).toBe(value)
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(errors).toEqual([])
})

test('cortina mantém altura; movimento reduzido preserva giro e surgimento por opacidade',async({page})=>{
 await page.goto('/abertos');await expect(page.locator('.loading-screen')).toHaveCount(0)
 const dimensions=page.locator('.overview-dimensions')
 await expect(dimensions.locator('.loading-state')).toHaveCount(0)
 await dimensions.scrollIntoViewIfNeeded()
 const before=(await dimensions.locator('.dimension-viewport').boundingBox())!.height
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/v1/bi/abertos/dimensoes?**',async route=>{const response=await route.fetch();expect(response.status()).toBe(200);await gate;await route.fulfill({response})})
 await dimensions.getByRole('button',{name:'Faixa de Tempo',exact:true}).click()
 try{
  await expect(dimensions.locator('.loading-overlay')).toBeVisible()
  await expect(dimensions.locator('.loading-skeleton > span')).toHaveCount(4)
  expect((await dimensions.locator('.dimension-viewport').boundingBox())!.height).toBe(before)
  await page.screenshot({path:'tests/ui/screenshots/abertos-loading-dimensao.png'})
 }finally{release()}
 await expect(dimensions.locator('.loading-state')).toHaveCount(0)
 await expect(dimensions.locator('tbody tr')).toHaveCount(5)
 const events=await page.evaluate(()=>(window as any).loadingEvents.filter((event:any)=>event.kind.includes('loading-overlay')))
 expect(events.length).toBeGreaterThan(0)
 expect(events.every((event:any)=>event.duration>=1980)).toBe(true)
 expect((await dimensions.locator('.dimension-viewport').boundingBox())!.height).toBe(before)
 await page.unroute('**/api/v1/bi/abertos/dimensoes?**')
 const checkpoint=await page.evaluate(()=>performance.now())
 await page.emulateMedia({reducedMotion:'reduce'})
 await dimensions.getByRole('button',{name:'Tipo de Entrega',exact:true}).click()
 await expect(dimensions.locator('.loader-spinner')).toHaveCSS('animation-name','legacy-loader-spin')
 await expect(dimensions.locator('.loader-spinner')).toHaveCSS('animation-duration','1.1s')
 const spinner=dimensions.locator('.loader-spinner')
 const transforms=await spinner.evaluate(async element=>{
  const before=getComputedStyle(element).transform
  await new Promise(resolve=>setTimeout(resolve,150))
  return [before,getComputedStyle(element).transform]
 })
 expect(transforms[0]).not.toBe(transforms[1])
 await expect(dimensions.locator('.loading-skeleton > span').first()).toHaveCSS('animation-name','none')
 await dimensions.locator('.analytic-table').scrollIntoViewIfNeeded()
 await expect(dimensions.locator('.loading-state')).toHaveCount(0)
 await expect(dimensions.locator('tbody tr')).toHaveCount(2)
 await expect.poll(()=>page.evaluate(time=>(window as any).entranceEvents.filter((event:any)=>event.time>=time && event.kind.includes('analysis-frame')).length,checkpoint)).toBeGreaterThan(0)
 const fades=await page.evaluate(time=>(window as any).entranceEvents.filter((event:any)=>event.time>=time && event.kind.includes('analysis-frame')),checkpoint)
 expect(fades.length).toBeGreaterThan(0)
 expect(fades.every((event:any)=>event.frames.every((frame:any)=>frame.transform===undefined))).toBe(true)
})

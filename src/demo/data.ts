import {unpackRows} from '../../shared/demo-snapshot.js'
export interface DemoManifest {
 schema:number;synthetic:false;source:string;referenceDate:string;exportedAt:string;
 publications:{commercial:string;logistics:string;aftersales:string};
 assets:Record<string,{file:string;sha256:string;contentSha256:string;bytes:number;encoding:string}>;
 initial:Record<string,string>
}
async function fetchJson(url:string,hash?:string){
 const response=await fetch(url)
 if(!response.ok)throw new Error('Arquivo da demonstração indisponível. Recarregue a página.')
 const bytes=new Uint8Array(await response.arrayBuffer())
 const blob=new Blob([bytes])
 // Some static servers automatically decode .gz over HTTP; others send the
 // compressed bytes. Verify the JSON content identically in both cases.
 const decoded=bytes[0]===31&&bytes[1]===139?await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes.buffer
 if(hash){const digest=await crypto.subtle.digest('SHA-256',decoded);const actual=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');if(actual!==hash)throw new Error('Arquivo demonstrativo com integridade divergente. Recarregue a página.')}
 return JSON.parse(new TextDecoder().decode(decoded))
}
let pending:Promise<DemoManifest>|undefined
export function getDemoManifest():Promise<DemoManifest>{
 return pending??=fetchJson('/demo/manifest.json').catch(error=>{pending=undefined;throw error})
}
export function createDemoLoader(manifest:DemoManifest){
 const pending=new Map<string,Promise<any>>()
 return function load(name:string):Promise<any>{
  const cached=pending.get(name);if(cached)return cached
  const asset=manifest.assets[name];if(!asset)return Promise.reject(new Error('Recorte demonstrativo não disponível.'))
  const task=fetchJson('/demo/'+asset.file,asset.contentSha256).then(value=>{
   if(asset.encoding==='commercial')return {...value,frames:Object.fromEntries(Object.entries(value.frames).map(([key,table])=>[key,unpackRows(table)]))}
   if(asset.encoding==='logistics')return {...value,items:unpackRows(value.items),allocations:unpackRows(value.allocations)}
   if(asset.encoding==='aftersales')return {...value,rows:unpackRows(value.rows)}
   return value
  }).catch(error=>{pending.delete(name);throw error})
  // The query repositories retain small derived payloads. Limit full sources.
  if(pending.size>=3)pending.delete(pending.keys().next().value!)
  pending.set(name,task);return task
 }
}

import {createDemoApi} from './engine.js'
import {createDemoLoader,getDemoManifest} from './data'
const scope=globalThis as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(message:unknown)=>void}
const ready=getDemoManifest().then(manifest=>createDemoApi({manifest,load:createDemoLoader(manifest)}))
let queue=Promise.resolve()
scope.onmessage=({data})=>{
 queue=queue.then(async()=>{
  try{const request=await ready;scope.postMessage({id:data.id,value:await request(data.path,data.options)})}
  catch(error){scope.postMessage({id:data.id,error:error instanceof Error?error.message:'Falha na consulta demonstrativa.'})}
 })
}

import {demoRequestKey} from '../../shared/demo-snapshot.js'
import {createDemoLoader,getDemoManifest} from './data'
let sequence=0,worker:Worker|undefined,initial:ReturnType<typeof createDemoLoader>|undefined,settingsChanged=false
const waiting=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;cleanup:()=>void}>()
export async function demoRequest<T>(path:string,options:RequestInit={}):Promise<T>{
 options.signal?.throwIfAborted()
 const manifest=await getDemoManifest()
 initial??=createDemoLoader(manifest)
 // Settings are private to this tab. Once edited, precomputed dashboards must
 // not mask the new configuration.
 if(options.method&&options.method!=='GET')settingsChanged=true
 const cached=!settingsChanged&&manifest.initial[demoRequestKey(path,manifest.referenceDate)]
 if(cached){const value=await initial(cached);options.signal?.throwIfAborted();return structuredClone(value)}
 if(!worker){
  worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'})
  worker.onmessage=({data})=>{const task=waiting.get(data.id);if(!task)return;waiting.delete(data.id);task.cleanup();if(data.error)task.reject(new Error(data.error));else task.resolve(data.value)}
  worker.onerror=()=>{for(const task of waiting.values()){task.cleanup();task.reject(new Error('Não foi possível iniciar a demonstração. Recarregue a página.'))}waiting.clear();worker?.terminate();worker=undefined}
 }
 return new Promise<T>((resolve,reject)=>{
  const id=++sequence,abort=()=>{waiting.delete(id);reject(options.signal?.reason??new DOMException('Consulta cancelada.','AbortError'))}
  waiting.set(id,{resolve,reject,cleanup:()=>options.signal?.removeEventListener('abort',abort)})
  options.signal?.addEventListener('abort',abort,{once:true})
  if(options.signal?.aborted){abort();return}
  worker!.postMessage({id,path,options:{method:options.method||'GET',body:options.body}})
 })
}

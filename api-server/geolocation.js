import {readFileSync} from 'node:fs';
import {readFile,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';

export const geoCachePath=fileURLToPath(new URL('../.local/geocoding-cep.json',import.meta.url));
const day=86400000,positiveAge=180*day,negativeAge=day;
const states=JSON.parse(readFileSync(new URL('../src/assets/brazil-states.geojson',import.meta.url),'utf8')).features;
export function normalizeCep(value){
 if(typeof value!=='string')return null;
 const text=value.trim();
 if(!/^\d{5}-?\d{3}$/.test(text))return null;
 const cep=text.replace('-','');return cep==='00000000'?null:cep;
}
const coordinate=value=>typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):NaN;
export function validCoordinates(latitude,longitude){
 const lat=coordinate(latitude),lon=coordinate(longitude);
 return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-34&&lat<=6&&lat!==0&&lon>=-74&&lon<=-34;
}
const normalizeCity=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
function inRing(x,y,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
function inState(latitude,longitude,uf){
 const feature=states.find(state=>state.properties.sigla===uf);if(!feature)return false;
 const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
 return polygons.some(rings=>inRing(longitude,latitude,rings[0])&&!rings.slice(1).some(ring=>inRing(longitude,latitude,ring)));
}
function fresh(entry,now,maxAge){
 const age=now.getTime()-Date.parse(entry?.checkedAt);return Number.isFinite(age)&&age>=0&&age<maxAge;
}
function accepted(item,entry,now){
 const cep=normalizeCep(item.cep),uf=String(item.uf||'').trim().toUpperCase();
 const coordinates=entry?.location?.coordinates;
 return Boolean(cep&&entry?.status==='ok'&&entry.cep===cep&&entry.state===uf&&normalizeCity(item.cidade)&&normalizeCity(item.cidade)===normalizeCity(entry.city)&&fresh(entry,now,positiveAge)&&
  validCoordinates(coordinates?.latitude,coordinates?.longitude)&&inState(coordinate(coordinates.latitude),coordinate(coordinates.longitude),uf));
}
export async function readGeoCache(path=geoCachePath,now=new Date()){
 try{
  const raw=await readFile(path,'utf8'),parsed=JSON.parse(raw);
  if(!parsed.entries||typeof parsed.entries!=='object'||Array.isArray(parsed.entries))throw new Error('Invalid cache');
  // Time changes eligibility even without a file update; invalidate API caches too.
  const eligible=Object.keys(parsed.entries).filter(cep=>parsed.entries[cep]?.status==='ok'&&fresh(parsed.entries[cep],now,positiveAge)).sort();
  return {version:createHash('sha256').update(raw).update(JSON.stringify(eligible)).digest('hex'),entries:parsed.entries};
 }catch(error){
  // An optional unavailable cache must never prevent ERP data being displayed.
  return {version:'',entries:{},warning:error.code==='ENOENT'?null:'Cache de CEP indisponível; mantendo somente coordenadas ERP.'};
 }
}
export function enrichLocations(items,cache,now=new Date()){
 return items.map(item=>{
  const base={...item,latitude:null,longitude:null,geo_origin:null};
  if(validCoordinates(item.latitude,item.longitude))return {...base,latitude:coordinate(item.latitude),longitude:coordinate(item.longitude),geo_origin:'ERP'};
  const entry=cache.entries?.[normalizeCep(item.cep)];
  if(!accepted(item,entry,now))return base;
  return {...base,latitude:coordinate(entry.location.coordinates.latitude),longitude:coordinate(entry.location.coordinates.longitude),geo_origin:'CEP'};
 });
}
export async function updateGeoCache(items,{path=geoCachePath,fetchImpl=fetch,now=new Date(),limit=500,delayMs=300,onProgress=()=>{}}={}){
 if(!Number.isInteger(limit)||limit<1||limit>10000)throw new Error('Limite deve ser inteiro entre 1 e 10000.');
 const cache=await readGeoCache(path),entries={...cache.entries},candidates=new Map();
 for(const item of items){
  const cep=normalizeCep(item.cep);
  if(cep&&!validCoordinates(item.latitude,item.longitude)){
   if(!candidates.has(cep))candidates.set(cep,[]);candidates.get(cep).push(item);
  }
 }
 const stats={distinct:candidates.size,lookups:0,accepted:0,failed:0,reused:0,remaining:0};
 async function persist(){
  await mkdir(dirname(path),{recursive:true});const temporary=path+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,JSON.stringify({schemaVersion:1,entries},null,2)+'\n','utf8');await rename(temporary,path);}
  finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 }
 for(const [cep,rows] of candidates){
  const previous=entries[cep];
  if(previous&&fresh(previous,now,previous.status==='ok'?positiveAge:negativeAge)){stats.reused++;continue;}
  if(stats.lookups>=limit){stats.remaining++;continue;}
  if(stats.lookups&&delayMs)await pause(delayMs);
  stats.lookups++;
  try{
   const result=await fetchImpl('https://brasilapi.com.br/api/cep/v2/'+cep,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
   if(!result.ok)throw new Error('Lookup failed');
   const data=await result.json();
   // Keep only required provider fields, never full address/response payloads.
   const coordinates=data.location?.coordinates;
   const candidate={cep:data.cep,state:data.state,city:data.city,location:{type:'Point',coordinates:{latitude:coordinate(coordinates?.latitude),longitude:coordinate(coordinates?.longitude)}},provider:'BrasilAPI CEP v2',status:'ok',checkedAt:now.toISOString()};
   if(!rows.some(row=>accepted(row,candidate,now)))throw new Error('Location rejected');
   entries[cep]=candidate;stats.accepted++;
  }catch{entries[cep]={status:'failed',checkedAt:now.toISOString()};stats.failed++;}
  await persist();onProgress({...stats});
 }
 return stats;
}

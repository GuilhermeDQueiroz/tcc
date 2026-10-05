export class AsyncCache {
  constructor({ttl=300000,maxEntries=30}={}){
    this.ttl=ttl;
    this.maxEntries=maxEntries;
    this.items=new Map();
    this.pending=new Map();
    this.generation=0;
  }
  async get(key,load){
    if(this.pending.has(key))return this.pending.get(key);
    const found=this.items.get(key);
    if(found&&found.expires>Date.now()){
      this.items.delete(key);
      this.items.set(key,found);
      return found.value;
    }
    this.items.delete(key);
    const generation=this.generation;
    const promise=Promise.resolve().then(load).then(value=>{
      if(generation===this.generation){
        this.items.set(key,{value,expires:Date.now()+this.ttl});
        while(this.items.size>this.maxEntries)this.items.delete(this.items.keys().next().value);
      }
      return value;
    }).finally(()=>{
      if(this.pending.get(key)===promise)this.pending.delete(key);
    });
    // Pending work stays coalesced even when completed entries are evicted.
    this.pending.set(key,promise);
    return promise;
  }
  clear(){this.generation++;this.items.clear();this.pending.clear();}
}
export function stableKey(value){
  if(Array.isArray(value))return '['+value.map(stableKey).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableKey(value[k])).join(',')+'}';
  return JSON.stringify(value);
}

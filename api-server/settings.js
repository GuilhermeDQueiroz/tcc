import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {InputError,validateAreaTab,validateFilters} from './domain/contracts.js';
const defaults=fileURLToPath(new URL('../data/metas-inicial.json',import.meta.url));
const publicDefaults=fileURLToPath(new URL('../data/metas-inicial.example.json',import.meta.url));
export class SettingsStore {
  constructor(directory=fileURLToPath(new URL('../data/local',import.meta.url)),initialFile=defaults){this.directory=directory;this.initialFile=initialFile;this.queue=Promise.resolve();}
  async read(name,initial){
    try{return JSON.parse(await fs.readFile(path.join(this.directory,name+'.json'),'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw error;return initial;}
  }
  update(task){const promise=this.queue.then(task);this.queue=promise.catch(()=>{});return promise;}
  async write(name,value){await fs.mkdir(this.directory,{recursive:true});const target=path.join(this.directory,name+'.json'),temporary=target+'.'+randomUUID()+'.tmp';
    try{await fs.writeFile(temporary,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});await fs.rename(temporary,target);}finally{await fs.rm(temporary,{force:true});}
    return value;
  }
  async getMetas(){
    const local=await this.read('metas',null);
    if(local!==null)return local;
    try{return JSON.parse(await fs.readFile(this.initialFile,'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw error;return JSON.parse(await fs.readFile(publicDefaults,'utf8'));}
  }
  async setMetas(value){
    const keys=['financeira','peso','emissao_financeira','emissao_peso'];
    if(!value||Array.isArray(value)||typeof value!=='object'||!value.default)throw new InputError('Metas exigem configuração padrão.');
    for(const [period,goal] of Object.entries(value)){
      if(period!=='default'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new InputError('Período de meta inválido.');
      if(!goal||typeof goal!=='object'||Array.isArray(goal)||Object.keys(goal).some(k=>!keys.includes(k)))throw new InputError('Campos de meta inválidos.');
      if(keys.some(k=>typeof goal[k]!=='number'||!Number.isFinite(goal[k])||goal[k]<0))throw new InputError('Metas devem ser números não negativos.');
    }
    return this.update(()=>this.write('metas',value));
  }
  async getPresets(){return this.read('presets',[]);}
  async addPreset(value){
    if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>80)throw new InputError('Nome de preset inválido.');
    validateAreaTab(value.area);const filters=validateFilters(value.filters);
    return this.update(async()=>{const all=await this.getPresets();if(all.length>=100)throw new InputError('Limite de 100 presets.');
      const preset={id:randomUUID(),name:value.name.trim(),area:value.area,filters};all.push(preset);await this.write('presets',all);return preset;
    });
  }
  async deletePreset(id){return this.update(async()=>{const all=await this.getPresets();await this.write('presets',all.filter(p=>p.id!==id));});}
}

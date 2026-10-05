export const AREAS=['abertos','emitidos','faturados'];
export const DIMENSIONS=['UF','REGIAO_UF','CIDADE','MICRO_REGIAO','SUPERVISOR','CONSULTOR','TIPO_ENTREGA','CLASSIFICACAO','STATUS','GRUPO_ITEM','LINHA','SUBGRUPO','TIPO','COLECAO','GRUPO_CLIENTE'];
export const ANALYSIS_DIMENSIONS=[...DIMENSIONS,'ORIGEM','ORGAO','DESCRICAO_ITEM','COR','FAMILIA'];
export const FILTER_DIMENSIONS=[...ANALYSIS_DIMENSIONS,'CLIENTE','CODIGO_PEDIDO','Mes_Grupo','Mes_Previsao','Aging_Bucket','Status_Previsao','Canal'];
export const TABS={abertos:['resumo','calendario','geografia','dimensoes','pesquisa'],emitidos:['semanal','mensal','evolucao','geografia','carteira','dimensoes','pesquisa'],faturados:['semanal','mensal','evolucao','geografia','carteira','dimensoes','pesquisa']};
export class InputError extends Error { constructor(message){super(message);this.status=400;} }
export function validateAreaTab(area,tab) {
  if(!AREAS.includes(area)) throw new InputError('Área inválida.');
  if(tab && !TABS[area].includes(tab)) throw new InputError('Análise inválida para esta área.');
}
function isObject(value){return value && typeof value==='object' && !Array.isArray(value);}
function list(value,label){if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw new InputError(`${label}: lista de textos obrigatória.`);}
function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}
export function validateFilters(value) {
  if(!isObject(value))throw new InputError('Filtros devem ser um objeto.');
  const allowed=['dimensions','billingRange','emissionRange','includeGroups','excludeGroups','value','quantity','search'];
  for(const key of Object.keys(value)) if(!allowed.includes(key))throw new InputError(`Filtro desconhecido: ${key}`);
  if(value.dimensions!==undefined){
    if(!isObject(value.dimensions))throw new InputError('Dimensões inválidas.');
    for(const [key,items] of Object.entries(value.dimensions)){
      if(!FILTER_DIMENSIONS.includes(key))throw new InputError(`Dimensão inválida: ${key}`);
      list(items,key);
    }
  }
  for(const key of ['billingRange','emissionRange'])if(value[key]!==undefined){
    const range=value[key];
    if(!Array.isArray(range)||range.length!==2||!range.every(validDate))throw new InputError('Data inválida no intervalo.');
    if(range[0]>range[1])throw new InputError('Intervalo de datas invertido.');
  }
  for(const key of ['includeGroups','excludeGroups'])if(value[key]!==undefined)list(value[key],key);
  for(const key of ['value','quantity'])if(value[key]!==undefined){
    const comparison=value[key];
    if(!isObject(comparison)||!['>','>=','<','<=','==','!='].includes(comparison.operator))throw new InputError('Operador numérico inválido.');
    if(typeof comparison.value!=='number'||!Number.isFinite(comparison.value))throw new InputError('O comparador exige um número finito.');
  }
  if(value.search!==undefined && typeof value.search!=='string')throw new InputError('Pesquisa deve ser texto.');
  return structuredClone(value);
}
export function parseFilters(raw) {
  if(!raw)return {};
  try {return validateFilters(JSON.parse(raw));}
  catch(error){if(error instanceof InputError)throw error;throw new InputError('Filtros JSON inválidos.');}
}

export type LogisticsCategory = 'uf' | 'city' | 'delivery' | 'erpStatus' | 'client' | 'product'
export const logisticsCategories:LogisticsCategory[]=['uf','city','delivery','erpStatus','client','product']
export function emptyLogisticsFilters(){
 return {
  company:'',status:'',search:'',
  uf:[] as string[]|string,city:[] as string[]|string,delivery:[] as string[]|string,
  erpStatus:[] as string[]|string,client:[] as string[]|string,product:[] as string[]|string,
  emissionStart:'',emissionEnd:'',forecastStart:'',forecastEnd:'',ageMin:'',
  loadStage:'',forecastStatus:'',freeQuantityMin:'',freeVolumeMin:'',freeWeightMin:'',orderValueMin:''
 }
}
export type LogisticsFilters=ReturnType<typeof emptyLogisticsFilters>
export function categoryValues(value:string|string[]):string[]{return Array.isArray(value)?value:value?[value]:[]}
export function cloneLogisticsFilters(source:Partial<LogisticsFilters>):LogisticsFilters{
 const result=emptyLogisticsFilters()
 for(const key of Object.keys(result) as (keyof LogisticsFilters)[]){
  const value=source[key]
  if(logisticsCategories.includes(key as LogisticsCategory)){
   result[key as LogisticsCategory]=Array.isArray(value)?[...new Set(value.filter(entry=>typeof entry==='string'&&entry.length>0))]:typeof value==='string'?categoryValues(value):[]
  }else if(typeof value==='string')result[key as Exclude<keyof LogisticsFilters,LogisticsCategory>]=value
 }
 return result
}
export const logisticsFilterLabels:Record<keyof LogisticsFilters,string>={
 company:'Empresa',status:'Situação de alocação',search:'Pesquisa',uf:'Estado (UF)',city:'Cidade',delivery:'Entregar / retirar',erpStatus:'Status do ERP',client:'Cliente',product:'Código do produto',
 emissionStart:'Emissão inicial',emissionEnd:'Emissão final',forecastStart:'Previsão inicial',forecastEnd:'Previsão final',ageMin:'Tempo mínimo em aberto (dias)',loadStage:'Etapa da carga vinculada',forecastStatus:'Situação da previsão',
 freeQuantityMin:'Quantidade mínima sem carga',freeVolumeMin:'Cubagem mínima sem carga (m³)',freeWeightMin:'Peso mínimo sem carga (kg)',orderValueMin:'Valor mínimo do pedido (R$)'
}
export const logisticsStatusLabels:Record<string,string>={none:'Sem carga',partial:'Parcialmente alocado',full:'Totalmente alocado'}
export const logisticsForecastLabels:Record<string,string>={overdue:'Previsão vencida',today:'Previsto para a referência',upcoming:'Previsão futura',undated:'Sem previsão'}

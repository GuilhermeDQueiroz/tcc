import { computed, ref } from 'vue'
import type { Filters } from '../types/analytics'

export type FilterPeriod = 'today' | 'month' | 'previous' | 'year'
const operators = ['>', '>=', '<', '<=', '==', '!=']
const clone = (filters: Filters): Filters => JSON.parse(JSON.stringify(filters))
const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const part = (type: string) => parts.find(value => value.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
function validDate(value: string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
  const date=new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value
}

// Editing remains local until the caller applies or saves the compiled draft.
export function useFilterDraft() {
  const draft=ref<Filters>({})
  const emission=ref(['','']),billing=ref(['',''])
  const valueInput=ref<string|number>(''),quantityInput=ref<string|number>(''),valueOp=ref(''),quantityOp=ref('')
  const feedback=ref(''),feedbackKind=ref<'error'|'success'>('success')
  const currentYear=ref(Number(today().slice(0,4)))
  function message(text:string,kind:'error'|'success'='success') {
    feedback.value=text;feedbackKind.value=kind
  }
  function reset(filters:Filters={}) {
    draft.value=clone(filters)
    emission.value=[...(filters.emissionRange || ['',''])]
    billing.value=[...(filters.billingRange || ['',''])]
    valueInput.value=filters.value ? String(filters.value.value) : ''
    quantityInput.value=filters.quantity ? String(filters.quantity.value) : ''
    valueOp.value=filters.value?.operator || ''
    quantityOp.value=filters.quantity?.operator || ''
    currentYear.value=Number(today().slice(0,4))
    feedback.value=''
  }
  function compiled():Filters|undefined {
    feedback.value=''
    const result=clone(draft.value)
    for(const [key,range,label] of [
      ['emissionRange',emission.value,'emissão'],['billingRange',billing.value,'faturamento']
    ] as const) {
      if(!range.some(Boolean)){delete result[key];continue}
      if(!range.every(Boolean)){message(`Preencha as duas datas do intervalo de ${label}.`,'error');return}
      if(!range.every(validDate)){message(`Informe datas válidas para ${label}.`,'error');return}
      if(range[0]!>range[1]!){message('A data inicial deve ser anterior ou igual à final.','error');return}
      result[key]=[range[0]!,range[1]!]
    }
    for(const [key,operator,input,label] of [
      ['value',valueOp.value,valueInput.value,'valor'],['quantity',quantityOp.value,quantityInput.value,'quantidade']
    ] as const) {
      if(!operator){delete result[key];continue}
      if(!String(input).trim() || !Number.isFinite(Number(input)) || !operators.includes(operator)) {
        message(`Informe um número válido para ${label}.`,'error');return
      }
      result[key]={operator,value:Number(input)}
    }
    if(result.dimensions) {
      result.dimensions=Object.fromEntries(Object.entries(result.dimensions).filter(([,values])=>values.length))
      if(!Object.keys(result.dimensions).length)delete result.dimensions
    }
    return result
  }
  function quickPeriod(period:FilterPeriod,target:'emission'|'billing'='billing') {
    const current=today(),year=Number(current.slice(0,4)),month=Number(current.slice(5,7))
    let range:string[]
    if(period==='today')range=[current,current]
    else if(period==='month')range=[iso(year,month,1),current]
    else if(period==='previous') {
      const last=new Date(Date.UTC(year,month-1,0))
      range=[iso(last.getUTCFullYear(),last.getUTCMonth()+1,1),last.toISOString().slice(0,10)]
    } else range=[iso(year,1,1),iso(year,12,31)]
    if(target==='emission')emission.value=range
    else billing.value=range
    feedback.value=''
  }
  function clearPeriod(){emission.value=['',''];billing.value=['',''];feedback.value=''}
  function getDimensionValues(key:string){return draft.value.dimensions?.[key] || []}
  function setDimensionValues(key:string,values:string[]) {
    draft.value.dimensions ||= {}
    if(values.length)draft.value.dimensions[key]=[...new Set(values)]
    else delete draft.value.dimensions[key]
  }
  const counts=computed(()=>{
    const selected=(keys:string[])=>keys.filter(key=>draft.value.dimensions?.[key]?.length).length
    return {
      period:Number(emission.value.some(Boolean))+Number(billing.value.some(Boolean)),
      location:selected(['UF','REGIAO_UF','CIDADE','MICRO_REGIAO']),
      commercial:selected(['SUPERVISOR','CONSULTOR','TIPO_ENTREGA','CLASSIFICACAO','STATUS'])+Number(Boolean(draft.value.includeGroups?.length))+Number(Boolean(draft.value.excludeGroups?.length)),
      product:selected(['GRUPO_ITEM','LINHA','SUBGRUPO','TIPO','COLECAO']),
      numeric:Number(Boolean(valueOp.value))+Number(Boolean(quantityOp.value))
    }
  })
  return {draft,emission,billing,valueInput,quantityInput,valueOp,quantityOp,currentYear,
    feedback,feedbackKind,message,reset,compiled,quickPeriod,clearPeriod,getDimensionValues,setDimensionValues,counts}
}

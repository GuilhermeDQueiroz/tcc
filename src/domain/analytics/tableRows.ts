import type {Row} from '../../types/analytics'

const collator=new Intl.Collator('pt-BR',{numeric:true})

export function sortTableRows<T extends Row>(rows:T[],key:string,direction:'asc'|'desc'):T[]{
  if(!key)return rows
  const sign=direction==='asc'?1:-1
  return [...rows].sort((a,b)=>{
    const first=a[key],second=b[key]
    const comparison=typeof first==='number'&&typeof second==='number'
      ?first-second:collator.compare(String(first??''),String(second??''))
    return sign*comparison
  })
}

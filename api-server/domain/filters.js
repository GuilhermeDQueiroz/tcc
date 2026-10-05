import {isoDate} from './dates.js';
const operators={'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'==':(a,b)=>a===b,'!=':(a,b)=>a!==b};
export function filterRows(rows,filters={}, {ignoreDates=false}={}) {
  return rows.filter(row=>{
    for(const [key,values] of Object.entries(filters.dimensions||{}))if(values.length&&(row[key]==null||!values.some(value=>value!=null&&String(value)===String(row[key]))))return false;
    if(filters.includeGroups?.length&&!filters.includeGroups.includes(row.GRUPO_CLIENTE))return false;
    if(filters.excludeGroups?.includes(row.GRUPO_CLIENTE))return false;
    if(!ignoreDates)for(const [key,column] of [['billingRange','DT_FATURA_DATE'],['emissionRange','DATA_EMISSAO_PEDIDO_DATE']]){
      if(filters[key] && Object.hasOwn(row,column)){const date=isoDate(row[column]);if(!date||date<filters[key][0]||date>filters[key][1])return false;}
    }
    for(const [filter,columns] of [['value',['VALOR_FATURADO_CLEAN','VALOR_TOTAL_LIQUIDO_CLEAN','VALOR_EMITIDO_CLEAN','VALOR_EM_ABERTO_CLEAN']],['quantity',['QUANTIDADE_FATURADA_CLEAN','QUANTIDADE_EMITIDA_CLEAN','QTDEABERTA_DOCITEMDET_CLEAN']]]){
      const comp=filters[filter],col=columns.find(c=>Object.hasOwn(row,c));if(comp&&col&&!operators[comp.operator](row[col],comp.value))return false;
    }
    if(filters.search&&!['CODIGO_PEDIDO','CODIGO_CLIENTE','CLIENTE','GRUPO_CLIENTE','DESCRICAO_ITEM','CONSULTOR','SUPERVISOR','STATUS','NOTAFISCAL'].some(c=>String(row[c]??'').toLocaleLowerCase('pt-BR').includes(filters.search.toLocaleLowerCase('pt-BR'))))return false;
    return true;
  });
}

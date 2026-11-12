import {isoDate} from './dates.js';
const operators={'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'==':(a,b)=>a===b,'!=':(a,b)=>a!==b};
export function filterRows(rows,filters={}, {ignoreDates=false}={}) {
  const dimensions=Object.entries(filters.dimensions||{}).filter(([,values])=>values.length);
  const dateRanges=ignoreDates?[]:[['billingRange','DT_FATURA_DATE'],['emissionRange','DATA_EMISSAO_PEDIDO_DATE']].filter(([key])=>filters[key]);
  const search=filters.search?.toLocaleLowerCase('pt-BR');
  if(!dimensions.length&&!filters.includeGroups?.length&&!filters.excludeGroups?.length&&!dateRanges.length&&!filters.value&&!filters.quantity&&!search)return rows.slice();
  return rows.filter(row=>{
    for(const [key,values] of dimensions)if(row[key]==null||!values.some(value=>value!=null&&String(value)===String(row[key])))return false;
    if(filters.includeGroups?.length&&!filters.includeGroups.includes(row.GRUPO_CLIENTE))return false;
    if(filters.excludeGroups?.includes(row.GRUPO_CLIENTE))return false;
    for(const [key,column] of dateRanges){
      if(Object.hasOwn(row,column)){const date=isoDate(row[column]);if(!date||date<filters[key][0]||date>filters[key][1])return false;}
    }
    if(filters.value){const col=['VALOR_FATURADO_CLEAN','VALOR_TOTAL_LIQUIDO_CLEAN','VALOR_EMITIDO_CLEAN','VALOR_EM_ABERTO_CLEAN'].find(c=>Object.hasOwn(row,c));if(col&&!operators[filters.value.operator](row[col],filters.value.value))return false;}
    if(filters.quantity){const col=['QUANTIDADE_FATURADA_CLEAN','QUANTIDADE_EMITIDA_CLEAN','QTDEABERTA_DOCITEMDET_CLEAN'].find(c=>Object.hasOwn(row,c));if(col&&!operators[filters.quantity.operator](row[col],filters.quantity.value))return false;}
    if(search&&!['CODIGO_PEDIDO','CODIGO_CLIENTE','CLIENTE','GRUPO_CLIENTE','DESCRICAO_ITEM','CONSULTOR','SUPERVISOR','STATUS','NOTAFISCAL'].some(c=>String(row[c]??'').toLocaleLowerCase('pt-BR').includes(search)))return false;
    return true;
  });
}

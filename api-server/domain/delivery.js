export function canonicalDelivery(value){
 const normalized=String(value||'Não informado').trim().toLocaleUpperCase('pt-BR');
 if(['RETIRA','RETIRADA'].includes(normalized))return 'RETIRA';
 if(['NONE','NÃO INFORMADO',''].includes(normalized))return 'Não informado';
 return normalized;
}

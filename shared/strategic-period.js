// Calendar selection is independent of source bounds and follows São Paulo time.
export function strategicDefaultPeriod(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
 return {start:`${Number(parts.year)-1}-01-01`,end:`${parts.year}-${parts.month}-${parts.day}`};
}

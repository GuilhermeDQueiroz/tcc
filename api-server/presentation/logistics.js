// The domain keeps both aliases for table consumers. JSON cannot preserve shared
// references, so send each hierarchy once and let the client restore the alias.
export function logisticsPayload(dashboard){
  return {...dashboard,tables:dashboard.tables?.map(table=>{
    if(table.tree!==table.rows)return table;
    const {tree,...rest}=table;
    return {...rest,treeFromRows:true};
  })};
}

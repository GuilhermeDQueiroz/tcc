import {AsyncCache,stableKey} from '../cache.js';
import {buildStrategicDashboard,canonicalDelivery} from '../domain/strategic.js';
import {buildLogisticsDashboard} from '../domain/logistics.js';

export class StrategicRepository {
 constructor(repository,logisticsRepository){this.repository=repository;this.logisticsRepository=logisticsRepository;this.payloads=new AsyncCache({maxEntries:8,ttl:300000});}
 async getDashboard(filters={},granularity='month'){
  const dimensions=filters.dimensions||{};
  const balance=await this.logisticsRepository.snapshot();
  const snapshot=await this.repository.snapshot(balance.execution.data_referencia,'faturados');
  return this.payloads.get(stableKey([balance.execution.id,balance.geoVersion,snapshot.version,balance.execution.data_referencia,filters,granularity]),()=>{
   const deliveryValues=[...new Set(balance.items.map(item=>item.tipo_entrega))];
   const selected=new Set((dimensions.TIPO_ENTREGA||[]).map(canonicalDelivery));
   const logisticsFilters={uf:dimensions.UF,city:dimensions.CIDADE,emissionStart:filters.emissionRange?.[0],emissionEnd:filters.emissionRange?.[1]};
   if(selected.size)logisticsFilters.delivery=deliveryValues.filter(value=>selected.has(canonicalDelivery(value)));
   // No raw label matches must produce an empty population, not an empty filter.
   if(selected.size&&!logisticsFilters.delivery.length)logisticsFilters.delivery=['\u0000unmatched'];
   const logistics=buildLogisticsDashboard({...balance,filters:logisticsFilters});
   logistics.options.deliveries=deliveryValues;
   return buildStrategicDashboard({logistics,billingRows:snapshot.frames.faturados,publication:snapshot,filters,granularity});
  });
 }
}

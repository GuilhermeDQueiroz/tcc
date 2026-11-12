import {strategicDefaultPeriod} from '../../shared/strategic-period.js';
import {AsyncCache,stableKey} from '../cache.js';
import {buildStrategicDashboard,buildStrategicDimensionPayload,canonicalDelivery} from '../domain/strategic.js';
import {buildLogisticsDashboard} from '../domain/logistics.js';
import {buildFormationBalanceMetrics} from '../domain/formation-balance.js';

export class StrategicRepository {
 constructor(repository,logisticsRepository){this.repository=repository;this.logisticsRepository=logisticsRepository;this.payloads=new AsyncCache({maxEntries:8,ttl:300000});}
 async getFormationBalance(logistics,filters={}){
  const version=await this.repository.getVersion();
  return this.payloads.get(stableKey(['formation-balance',logistics.dataVersion,version,filters]),async()=>{
   const snapshot=await this.repository.snapshot(logistics.referenceDate,'formation-balance');
   return buildFormationBalanceMetrics(logistics,snapshot.frames.faturados,filters);
  });
 }
 async getAnalysis(filters={},dimension='UF'){
  const defaultPeriod=strategicDefaultPeriod();
  filters={...filters,billingRange:filters.billingRange||[defaultPeriod.start,defaultPeriod.end]};
  const balance=await this.logisticsRepository.snapshot(),version=await this.repository.getVersion();
  return this.payloads.get(stableKey(['analysis',balance.execution.id,balance.geoVersion,version,balance.execution.data_referencia,filters,dimension]),async()=>{
   const snapshot=await this.repository.snapshot(balance.execution.data_referencia,'strategic-analysis');
   const logisticsVersion=String(balance.execution.id)+(balance.geoVersion?':'+balance.geoVersion:'');
   return {dataVersion:snapshot.version+'|'+logisticsVersion,referenceDate:balance.execution.data_referencia,
    analysis:buildStrategicDimensionPayload({billingRows:snapshot.frames.faturados,emissionRows:snapshot.frames.emitidos,referenceDate:balance.execution.data_referencia,filters,dimension})};
  });
 }
 async getDashboard(filters={},granularity='month',dimension='UF',heatmapDimension='year',heatmapMetric='value',includeAnalysis=true){
  const defaultPeriod=strategicDefaultPeriod();
  filters={...filters,billingRange:filters.billingRange||[defaultPeriod.start,defaultPeriod.end]};
  const dimensions=filters.dimensions||{};
  const balance=await this.logisticsRepository.snapshot();
   const version=await this.repository.getVersion();
   return this.payloads.get(stableKey([balance.execution.id,balance.geoVersion,version,balance.execution.data_referencia,filters,granularity,dimension,heatmapDimension,heatmapMetric,includeAnalysis]),async()=>{
    const extended=dimension!=='UF'||(heatmapDimension!=='year'&&!['UF','CIDADE','TIPO_ENTREGA'].includes(heatmapDimension));
    const snapshot=await this.repository.snapshot(balance.execution.data_referencia,extended?'strategic-analysis':'strategic');
   const deliveryValues=[...new Set(balance.items.map(item=>item.tipo_entrega))];
   const selected=new Set((dimensions.TIPO_ENTREGA||[]).map(canonicalDelivery));
   const logisticsFilters={uf:dimensions.UF,city:dimensions.CIDADE,emissionStart:filters.emissionRange?.[0],emissionEnd:filters.emissionRange?.[1]};
   if(selected.size)logisticsFilters.delivery=deliveryValues.filter(value=>selected.has(canonicalDelivery(value)));
   // No raw label matches must produce an empty population, not an empty filter.
   if(selected.size&&!logisticsFilters.delivery.length)logisticsFilters.delivery=['\u0000unmatched'];
   const logistics=buildLogisticsDashboard({...balance,filters:logisticsFilters});
   logistics.options.deliveries=deliveryValues;
   return buildStrategicDashboard({logistics,billingRows:snapshot.frames.faturados,emissionRows:snapshot.frames.emitidos,publication:snapshot,filters,granularity,dimension,heatmapDimension,heatmapMetric,includeAnalysis});
  });
 }
}

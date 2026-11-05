export interface CohortWindow {
 days:number;availableOn:string;mature:boolean;billedOrders:number;billedValue:number|null;billedWeightKg:number|null;billedVolumeM3:number|null;
 ordersPercent:number|null;valuePercent:number|null;weightPercent:number|null;volumePercent:number|null;exceedsBase:boolean;
}
export interface CohortRow {month:string;orders:number;value:number|null;weightKg:number|null;volumeM3:number|null;windows:CohortWindow[]}
export interface CohortAnalysis {
 start:string;end:string;observedThrough:string|null;billingRangeIgnored:boolean;
 quality:{invalidEmissionRows:number;conflictingOrders:number;invalidBillingRows:number};rows:CohortRow[];
}

export function toggleCrossFilter<T extends {dimensions?: Record<string,string[]>}>(filters:T,dimension:string,values:unknown|unknown[]):T;

export function toggleCrossFilter(filters,dimension,values){
 const selected=[...new Set((Array.isArray(values)?values:[values]).filter(value=>value!=null&&String(value)!=='').map(String))];
 if(!dimension||!selected.length)return filters;
 const dimensions={...filters.dimensions};
 const current=dimensions[dimension]||[];
 if(current.length===selected.length&&current.every(value=>selected.includes(value)))delete dimensions[dimension];
 else dimensions[dimension]=selected;
 const {dimensions:_discarded,...otherFilters}=filters;
 return Object.keys(dimensions).length?{...otherFilters,dimensions}:otherFilters;
}

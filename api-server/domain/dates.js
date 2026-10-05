const DAY = 86400000;
export function isoDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
export const dateValue = value => Date.parse(`${isoDate(value)}T00:00:00Z`);
export const addDays = (value, days) => new Date(dateValue(value) + days * DAY).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.floor((dateValue(a) - dateValue(b)) / DAY);
export const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export function easter(year) {
  const floor = Math.floor;
  const a=year%19, b=floor(year/100), c=year%100, d=floor(b/4), e=b%4;
  const f=floor((b+8)/25), g=floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
  const i=floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7, m=floor((a+11*h+22*l)/451);
  const month=floor((h+l-7*m+114)/31), day=(h+l-7*m+114)%31+1;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
export function holidays(year) {
  const fixed=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'];
  const pascoa=easter(year);
  return new Set([...fixed.map(day=>`${year}-${day}`), addDays(pascoa,-47), addDays(pascoa,-2), addDays(pascoa,60)]);
}
export function isBusinessDay(value) {
  const date=isoDate(value), weekday=new Date(dateValue(date)).getUTCDay();
  return weekday!==0 && weekday!==6 && !holidays(Number(date.slice(0,4))).has(date);
}
export function businessDays(year,month) {
  let count=0;
  for(let day=1;day<=daysInMonth(year,month);day++) {
    if(isBusinessDay(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`)) count++;
  }
  return Math.max(1,count);
}
export function weeklyPeriods(referenceDate,lastDate) {
  const date=referenceDate<lastDate?referenceDate:lastDate;
  const weekday=(new Date(dateValue(date)).getUTCDay()+6)%7;
  const monday=addDays(date,-weekday);
  return [0,1,2].map(index=>({start:addDays(monday,-7*index),end:addDays(monday,6-7*index)}));
}
export function shiftYear(value,delta) {
  const date=isoDate(value), year=Number(date.slice(0,4))+delta, month=Number(date.slice(5,7));
  const day=Math.min(Number(date.slice(8,10)),daysInMonth(year,month));
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

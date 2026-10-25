export type Birthday = {month:number;day:number};
export const BIRTHDAY_MONTH_DAYS = [31,29,31,30,31,30,31,31,30,31,30,31] as const;
export function validBirthday(value:Birthday):boolean {
  return Number.isInteger(value.month)&&Number.isInteger(value.day)&&value.month>=1&&value.month<=12&&value.day>=1&&value.day<=BIRTHDAY_MONTH_DAYS[value.month-1];
}
export function encodeBirthday(value:Birthday|null):string|null {
  return value?`${String(value.month).padStart(2,'0')}-${String(value.day).padStart(2,'0')}`:null;
}
export function decodeBirthday(value:unknown):Birthday|null {
  if(typeof value!=='string'||!/^\d{2}-\d{2}$/.test(value))return null;
  const result={month:Number(value.slice(0,2)),day:Number(value.slice(3))};
  return validBirthday(result)?result:null;
}
/** Three civil days in Madrid; UTC arithmetic avoids daylight-saving offsets.
 * Feb 29 anniversaries are observed on Feb 28 in non-leap years. */
export function birthdayPhase(birthday:Birthday|null|undefined,date:Date):'before'|'today'|'after'|null {
  if(!birthday||!validBirthday(birthday)||!Number.isFinite(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Madrid',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(date);
  const get=(key:string)=>Number(parts.find(p=>p.type===key)!.value);
  const year=get('year'),today=Date.UTC(year,get('month')-1,get('day'));
  for(const occurrence of [year-1,year,year+1]) {
    const limit=new Date(Date.UTC(occurrence,birthday.month,0)).getUTCDate();
    const anniversary=Date.UTC(occurrence,birthday.month-1,Math.min(birthday.day,limit));
    const offset=(today-anniversary)/86400000;
    if(offset===-1)return 'before';if(offset===0)return 'today';if(offset===1)return 'after';
  }
  return null;
}

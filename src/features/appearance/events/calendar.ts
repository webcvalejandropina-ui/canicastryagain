import { birthdayPhase, type Birthday } from '@/shared/birthday';
import { DEFAULT_SCENERY, type SceneryId } from '../sceneries';
import type { BackgroundPolicy, Weather, ClubBackground } from './backgrounds';
import type { Season } from '../appearance';
export type EventEffect = 'confetti' | 'floral' | 'fire' | 'ribbon' | 'fair' | 'none';
export type ManagedEvent = {
  id: string; title: string; world: Season; effect: EventEffect;
  enabled: boolean; area: string; recurrence: 'annual' | 'once' | 'always' | 'easter';
  start: string; end: string; priority: number; source: string;
  scenery?:SceneryId;
  backgroundId?:string; weather?:Weather;
};
export type PersonalScene = Omit<ManagedEvent, 'area' | 'source'>;
export const normalizeArea = (area: string): string => area.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
/** Gregorian computus: movable feasts are recalculated for every year in Madrid. */
export function easterSunday(year:number):Date {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const n=h+l-7*m+114;
  return new Date(Date.UTC(year,Math.floor(n/31)-1,n%31+1,12));
}
export function activeOn(event: Pick<ManagedEvent,'enabled'|'recurrence'|'start'|'end'>, date: Date): boolean {
  if (!event.enabled) return false;
  if (event.recurrence === 'always') return true;
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const value = (key: string) => parts.find(p => p.type === key)!.value;
  if(event.recurrence==='easter') {
    const day=Date.UTC(Number(value('year')),Number(value('month'))-1,Number(value('day')),12);
    const offset=Math.round((day-easterSunday(Number(value('year'))).getTime())/86_400_000);
    return offset>=Number(event.start)&&offset<=Number(event.end);
  }
  const today = event.recurrence === 'annual' ? `${value('month')}-${value('day')}` : `${value('year')}-${value('month')}-${value('day')}`;
  return event.recurrence === 'annual' && event.start > event.end
    ? today >= event.start || today <= event.end : today >= event.start && today <= event.end;
}
export function selectEvent(events: readonly ManagedEvent[], area: string, date: Date): ManagedEvent | null {
  return events.filter(e => (!e.area || normalizeArea(e.area) === normalizeArea(area)) && activeOn(e,date))
    .sort((a,b) => b.priority-a.priority || Number(!!b.area)-Number(!!a.area) || a.id.localeCompare(b.id))[0] ?? null;
}

export function resolveManagedScene(preferences: {season:'auto'|Season;birthday?:{month:number;day:number};area?:string;backgroundPolicy?:BackgroundPolicy;scenery?:SceneryId}, events:readonly ManagedEvent[], personal:PersonalScene|null,date:Date, club:ClubBackground|null=null,identity?:{registered:boolean;birthday?:Birthday|null}): {world:Season;title:string;effect:EventEffect;backgroundId?:string;weather?:Weather;scenery?:SceneryId} {
  if(preferences.backgroundPolicy==='original')return {world:'none',title:'',effect:'none',scenery:preferences.scenery??DEFAULT_SCENERY};
  if(preferences.season!=='auto')return {world:preferences.season,title:'',effect:preferences.season==='birthday'?'confetti':'none',...(preferences.season==='none'?{scenery:preferences.scenery??DEFAULT_SCENERY}:preferences.season==='summer'?{scenery:'tarifa' as const}:{})};
  const phase=identity?.registered?birthdayPhase(identity.birthday,date):null;
  if(phase)return {world:'birthday',title:phase==='before'?'Tu cumpleaños empieza aquí':phase==='after'?'Seguimos celebrando tu cumpleaños':'¡Feliz cumpleaños!',effect:'confetti'};
  const personalized=preferences.backgroundPolicy!=='calendar';
  const assigned=personalized&&personal&&activeOn(personal,date)?personal:null;
  const event=assigned??selectEvent(events,preferences.area??'',date);
  const background=assigned??(personalized?club:null)??event;
  const world=background?.world==='inherit'?event?.world??'none':background?.world??'none';
  const scenery=background?.scenery
    ?? (background?.world==='inherit'?event?.scenery:undefined)
    ?? (world==='none'?preferences.scenery??DEFAULT_SCENERY:world==='summer'?'tarifa':undefined);
  return {world,title:event?.title??'',effect:event?.effect??'none',backgroundId:background?.backgroundId,weather:background?.weather,scenery};
}

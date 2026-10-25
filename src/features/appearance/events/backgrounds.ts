import type { SceneryId } from '../sceneries';
import type { Season } from '../appearance';
export type Weather = 'auto'|'none'|'rain'|'snow'|'fireflies';
export type BackgroundPolicy = 'auto'|'calendar'|'original';
export type ClubBackground = {world:Season|'inherit';scenery?:SceneryId;backgroundId?:string;weather?:Weather};
export type BackgroundAsset = {id:string;title:string;width:number;height:number;bytes:number};
export function seasonalWeather(date:Date):Exclude<Weather,'auto'> {
  const month=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Madrid',month:'numeric'}).format(date));
  return [12,1,2].includes(month)?'rain':[6,7,8].includes(month)?'fireflies':'none';
}

/** Places are independent of celebrations/materials. Extend this catalogue and
 * generate its static assets; the board and transport need no new branches. */
export const SCENERIES = {
  gibraltar: {position:"54% 16%",source:"gibraltar.png",label:'La Línea y Gibraltar', description:'La costa linense y el Peñón. Escenario principal.'},
  cadiz: {position:"76% 48%",source:"cadiz.png",label:'Cádiz', description:'La bahía y su luz de tarde. Una alternativa para tu mesa.'},
  tarifa: {position:"52% 50%",source:"tarifa.png",label:'Tarifa', description:'Dunas y aguas del Estrecho. Nuestro paisaje de verano.'},
  generic: {position:"50% 50%",source:"generic.png",label:'Paisaje natural', description:'Un refugio de naturaleza, sin una localidad concreta.'},
  'holy-week': {position:'50% 30%',source:'holy-week.png',label:'Semana Santa', description:'Piedra, flores y luz de velas al anochecer.'},
} as const;
export type SceneryId = keyof typeof SCENERIES;
export const SCENERY_IDS = Object.keys(SCENERIES) as [SceneryId,...SceneryId[]];
export const DEFAULT_SCENERY: SceneryId = 'gibraltar';
export function isScenery(value:unknown):value is SceneryId {
  return typeof value==='string' && Object.prototype.hasOwnProperty.call(SCENERIES,value);
}

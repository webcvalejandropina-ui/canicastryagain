import type { ManagedEvent, EventEffect } from './calendar';
import type { Season } from '../appearance';
const monthSource = (month:string) => `https://www.spain.info/es/consulta/fiestas-${month}-espana/`;
function annual(id:string,title:string,area:string,start:string,end:string,world:Season,effect:EventEffect,source:string,priority=20):ManagedEvent {
  return {id,title,area,start,end,world,effect,source,priority,recurrence:'annual',enabled:true};
}
function edition(id:string,title:string,area:string,start:string,end:string,source:string):ManagedEvent {
  return {...annual(id,title,area,start,end,'birthday','confetti',source),recurrence:'once'};
}
/** Curated source-linked starter catalog, not a census of every municipal festival.
 * Annual entries cover stable feast days; variable programs are dated editions. */
export const DEFAULT_EVENTS: readonly ManagedEvent[] = [
  {id:'holy-week',title:'Semana Santa',world:'none',scenery:'holy-week',effect:'floral',enabled:true,area:'',recurrence:'easter',start:'-7',end:'0',priority:10,source:''},
  annual('summer','Verano','','06-15','08-31','summer','none','',0),
  annual('halloween','Halloween','','10-20','11-02','halloween','none','',0),
  annual('christmas','Navidad','','12-01','01-06','christmas','none','',0),
  annual('san-fermin','San Fermín','Pamplona','07-06','07-14','none','ribbon','https://www.visitnavarra.es/es/sanfermines/'),
  annual('san-juan','Noche de San Juan','','06-23','06-24','summer','fire',monthSource('junio'),10),
  annual('hogueras-alicante','Hogueras de San Juan','Alicante','06-20','06-24','summer','fire',monthSource('junio')),
  annual('san-juan-coruna','Hogueras de San Juan','A Coruña','06-23','06-23','summer','fire',monthSource('junio')),
  annual('sant-joan','Sant Joan','Ciutadella','06-23','06-24','summer','ribbon',monthSource('junio')),
  annual('san-isidro','San Isidro','Madrid','05-15','05-15','none','floral','https://www.esmadrid.com/tras-los-pasos-san-isidro-madrid'),
  annual('san-anton-madrid','San Antón','Madrid','01-17','01-17','none','fire','https://www.esmadrid.com/agenda/fiestas-san-anton-madrid'),
  annual('sant-antoni','Sant Antoni','Sa Pobla','01-16','01-17','none','fire','https://www.illesbalears.travel/es/mallorca/fiestas-de-sant-antoni-y-sant-sebastia'),
  annual('sant-sebastia','Sant Sebastià','Palma','01-19','01-20','none','fire','https://www.illesbalears.travel/es/mallorca/fiestas-de-sant-antoni-y-sant-sebastia'),
  annual('fallas','Fallas de San José','València','03-14','03-19','none','fire','https://www.comunitatvalenciana.com/es/inspirate/marzo-comunitat-valenciana'),
  annual('santiago','Santiago Apóstol','Santiago de Compostela','07-25','07-25','none','floral',monthSource('julio')),
  annual('carmen','Virgen del Carmen','Santander','07-16','07-16','summer','floral','https://turismo.santander.es/que-hacer/planes-en-santander/fiestas'),
  annual('santiago-santander','Santiago','Santander','07-25','07-25','summer','confetti','https://turismo.santander.es/que-hacer/planes-en-santander/fiestas'),
  annual('batalla-vino','Batalla del Vino','Haro','06-29','06-29','none','confetti',monthSource('junio')),
  annual('paso-fuego','Paso del Fuego y Las Móndidas','San Pedro Manrique','06-23','06-24','none','fire',monthSource('junio')),
  annual('cipotegato','El Cipotegato','Tarazona','08-27','08-27','birthday','ribbon',monthSource('agosto')),
  annual('rama','Fiesta de la Rama','Agaete','08-04','08-04','summer','floral',monthSource('agosto')),
  annual('virgen-vega','Virgen de la Vega','Salamanca','09-08','09-08','none','floral','https://www.spain.info/es/agenda/feria-salamanca/'),
  annual('san-lorenzo','San Lorenzo','San Lorenzo de El Escorial','08-10','08-10','none','confetti','https://www.aytosanlorenzo.es/fiestas-y-tradiciones/'),
  annual('merce','La Mercè','Barcelona','09-24','09-24','none','floral','https://www.catalunya.com/es/continguts/esdeveniments-agenda/la-merce-1-1-116'),
  annual('pilar','Virgen del Pilar','Zaragoza','10-12','10-12','none','floral','https://www.turismodearagon.com/ficha/fiestas-en-honor-a-la-virgen-del-pilar-fiesta-de-interes-turistico-internacional/'),
  edition('pilar-2026','Fiestas del Pilar · 2026','Zaragoza','2026-10-10','2026-10-18','https://www.zaragoza.es/sede/portal/cultura/fiestas-pilar/'),
  edition('merce-2026','La Mercè · 2026','Barcelona','2026-09-23','2026-09-27','https://guia.barcelona.cat/ca/agenda/detall/festes-de-la-merce_99400717830.html'),
  edition('albacete-2026','Feria de Albacete · 2026','Albacete','2026-09-07','2026-09-17',monthSource('septiembre')),
  edition('murcia-2026','Feria de Murcia · 2026','Murcia','2026-09-03','2026-09-15',monthSource('septiembre')),
  edition('villena-2026','Moros y Cristianos · 2026','Villena','2026-09-04','2026-09-09',monthSource('septiembre')),
  edition('cartagena-2026','Carthagineses y Romanos · 2026','Cartagena','2026-09-18','2026-09-27',monthSource('septiembre')),
  edition('santa-tecla-2026','Santa Tecla · 2026','Tarragona','2026-09-15','2026-09-24',monthSource('septiembre')),
  edition('arnedo-2026','San Cosme y San Damián · 2026','Arnedo','2026-09-26','2026-10-02',monthSource('septiembre')),
  edition('ermitana-2026','Virgen de Ermitana · 2026','Peñíscola','2026-09-07','2026-09-17',monthSource('septiembre')),
  edition('san-anton-getaria-2026','San Antón · 2026','Getaria','2026-01-16','2026-01-25','https://www.euskadi.eus/gobierno-vasco/-/evento/2026/01/16/programa-fiestas-san-anton-2026-en-getaria/'),
];

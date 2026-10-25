import type { ManagedEvent } from './calendar';
const fair=(id:string,title:string,area:string,start:string,end:string,source:string):ManagedEvent=>({id,title,area,start,end,source,world:'none',effect:'fair',enabled:true,recurrence:'once',priority:30});
/** Edition dates, never guessed as annually recurring. Existing admin edits are preserved. */
export const FAIR_EVENTS:readonly ManagedEvent[]=[
  fair('feria-sevilla-2027','Feria de Abril · 2027','Sevilla','2027-04-13','2027-04-18','https://visitasevilla.es/fiestas-de-sevilla/'),
  fair('feria-jerez-2027','Feria del Caballo · 2027','Jerez de la Frontera','2027-04-24','2027-05-01','https://www.spain.info/es/agenda/feria-caballo/'),
  fair('feria-cordoba-2027','Feria de Córdoba · 2027','Córdoba','2027-05-22','2027-05-29','https://www.spain.info/es/destino/cordoba/'),
  fair('feria-cordoba-2026','Feria de Nuestra Señora de la Salud · 2026','Córdoba','2026-05-22','2026-05-30','https://www.cordoba.es/servicios/cultura-ocio-y-naturaleza/fiestas/calendario-fiestas-populares-2026'),
  fair('feria-malaga-2026','Feria de Málaga · 2026','Málaga','2026-08-15','2026-08-22','https://www.malaga.eu/feria-de-malaga'),
  fair('feria-cocentaina-2026','Fira de Tots Sants · 2026','Cocentaina','2026-10-30','2026-11-01','https://www.spain.info/es/agenda/feria-todos-santos/'),
  fair('vela-triana-2027','Velá de Santa Ana · 2027','Sevilla','2027-07-21','2027-07-26','https://visitasevilla.es/fiestas-de-sevilla/'),
];

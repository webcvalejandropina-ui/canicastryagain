import type { Database } from 'better-sqlite3';
import { SCENERY_IDS } from '@/features/appearance/sceneries';
import { z } from 'zod';
import { BackgroundStore, backgroundIdSchema } from './BackgroundStore';
import { FAIR_EVENTS } from '@/features/appearance/events/fairs';
import { DEFAULT_EVENTS } from '@/features/appearance/events/catalog';
import type { ManagedEvent, PersonalScene } from '@/features/appearance/events/calendar';
import { AppError } from '@/backend/shared/domain/AppError';
const validDate = (value:string,annual:boolean):boolean => {
  const iso = annual ? `2000-${value}` : value;
  if (!(annual ? /^\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(value)) return false;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === iso;
};
export const eventSchema = z.object({
  id:z.string().regex(/^[a-z0-9-]{1,80}$/),title:z.string().trim().min(1).max(80),
  world:z.enum(['none','birthday','halloween','christmas','summer']),
  scenery:z.enum(SCENERY_IDS).optional(),
  backgroundId:backgroundIdSchema.optional(),weather:z.enum(['auto','none','rain','snow','fireflies']).optional(),
  effect:z.enum(['none','confetti','floral','fire','ribbon','fair']), enabled:z.boolean(),
  area:z.string().trim().max(80),recurrence:z.enum(['annual','once','always','easter']),
  start:z.string().max(10),end:z.string().max(10),priority:z.number().int().min(0).max(100),
  source:z.union([z.literal(''),z.string().url().max(500).refine(s=>s.startsWith('https://'),'Usa una fuente HTTPS')]),
}).strict().superRefine((e,ctx)=>{
  if(e.recurrence==='always')return;
  if(e.recurrence==='easter') {
    if(!/^-?\d{1,2}$/.test(e.start)||! /^-?\d{1,2}$/.test(e.end)||Number(e.start)<-60||Number(e.end)>60||Number(e.start)>Number(e.end))ctx.addIssue({code:'custom',message:'Usa días relativos a Pascua entre -60 y 60, en orden.'});
    return;
  }
  if(!validDate(e.start,e.recurrence==='annual')||!validDate(e.end,e.recurrence==='annual'))ctx.addIssue({code:'custom',message:'Fechas inválidas. Usa MM-DD para anual y AAAA-MM-DD para una edición.'});
  if(e.recurrence==='once'&&e.start>e.end)ctx.addIssue({code:'custom',message:'El final debe ser posterior al inicio'});
});
export class AppearanceStore {
  constructor(private readonly db:Database) {
    db.transaction(()=>{
      db.exec(`CREATE TABLE IF NOT EXISTS appearance_events(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS appearance_assignments(player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS appearance_sessions(token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS appearance_session_expiry ON appearance_sessions(expires);
        CREATE TABLE IF NOT EXISTS appearance_schema(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
      if(!db.prepare('SELECT 1 FROM appearance_schema WHERE version=1').get()) {
        const insert=db.prepare('INSERT OR IGNORE INTO appearance_events(id,data) VALUES (?,?)');
        DEFAULT_EVENTS.forEach(e=>insert.run(e.id,JSON.stringify(e)));
        db.prepare('INSERT INTO appearance_schema(version) VALUES(1)').run();
      }
      if(!db.prepare('SELECT 1 FROM appearance_schema WHERE version=2').get()) {
        const insert=db.prepare('INSERT OR IGNORE INTO appearance_events(id,data) VALUES (?,?)');
        FAIR_EVENTS.forEach(e=>insert.run(e.id,JSON.stringify(e)));
        db.prepare('INSERT INTO appearance_schema(version) VALUES(2)').run();
      }
      if(!db.prepare('SELECT 1 FROM appearance_schema WHERE version=3').get()) {
        const event=DEFAULT_EVENTS.find(e=>e.id==='holy-week')!;
        db.prepare('INSERT OR IGNORE INTO appearance_events(id,data) VALUES (?,?)').run(event.id,JSON.stringify(event));
        db.prepare('INSERT INTO appearance_schema(version) VALUES(3)').run();
      }
    })();
  }
  assertAdmin(id:string):void {
    if(!(this.db.prepare('SELECT is_admin FROM players WHERE id=?').get(id) as {is_admin:number}|undefined)?.is_admin)throw new AppError('No tienes permisos de administrador',403,'FORBIDDEN');
  }
  events():ManagedEvent[] { return (this.db.prepare('SELECT data FROM appearance_events ORDER BY id').all() as {data:string}[]).map(r=>JSON.parse(r.data)); }
  saveEvent(admin:string,input:unknown):void {
    this.assertAdmin(admin); const e=eventSchema.parse(input);
    if(e.backgroundId&&!new BackgroundStore(this.db).exists(e.backgroundId))throw new AppError('Fondo no encontrado',404,'BACKGROUND_NOT_FOUND');
    if(!this.db.prepare('SELECT 1 FROM appearance_events WHERE id=?').get(e.id) && (this.db.prepare('SELECT count(*) AS n FROM appearance_events').get() as {n:number}).n>=2000)throw new AppError('Límite de 2000 eventos alcanzado',400,'EVENT_LIMIT');
    this.db.prepare('INSERT INTO appearance_events(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(e.id,JSON.stringify(e));
  }
  removeEvent(admin:string,id:string):void {this.assertAdmin(admin);this.db.prepare('DELETE FROM appearance_events WHERE id=?').run(id);}
  personal(id:string):PersonalScene|null {const row=this.db.prepare('SELECT data FROM appearance_assignments WHERE player_id=?').get(id) as {data:string}|undefined;return row?JSON.parse(row.data):null;}
  assign(admin:string,id:string,input:unknown):void {
    this.assertAdmin(admin);
    if(!this.db.prepare('SELECT 1 FROM players WHERE id=?').get(id))throw new AppError('Usuario no encontrado',404,'USER_NOT_FOUND');
    if(input===null){this.db.prepare('DELETE FROM appearance_assignments WHERE player_id=?').run(id);return;}
    const event=eventSchema.parse(input);
    if(event.backgroundId&&!new BackgroundStore(this.db).exists(event.backgroundId))throw new AppError('Fondo no encontrado',404,'BACKGROUND_NOT_FOUND');
    const scene:PersonalScene={id:event.id,title:event.title,world:event.world,effect:event.effect,enabled:event.enabled,recurrence:event.recurrence,start:event.start,end:event.end,priority:event.priority,...(event.scenery?{scenery:event.scenery}:{}),...(event.backgroundId?{backgroundId:event.backgroundId}:{}),...(event.weather?{weather:event.weather}:{})};
    this.db.prepare('INSERT INTO appearance_assignments(player_id,data) VALUES(?,?) ON CONFLICT(player_id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(scene));
  }
}

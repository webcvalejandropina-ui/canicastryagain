import { createHash } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { SCENERY_IDS } from '@/features/appearance/sceneries';
import { z } from 'zod';
import { AppError } from '@/backend/shared/domain/AppError';
import type { BackgroundAsset,ClubBackground } from '@/features/appearance/events/backgrounds';
export const backgroundIdSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const clubBackgroundSchema=z.object({scenery:z.enum(SCENERY_IDS).optional(),world:z.enum(['none','summer','christmas','halloween','birthday','inherit']),backgroundId:backgroundIdSchema.optional(),weather:z.enum(['auto','none','rain','snow','fireflies']).optional()}).strict();
export function imageDimensions(body:Buffer):{width:number;height:number;type:string} {
  if(body.length>=24 && body.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) && body.toString('ascii',12,16)==='IHDR')return {width:body.readUInt32BE(16),height:body.readUInt32BE(20),type:'image/png'};
  if(body.length>=30&&body.toString('ascii',0,4)==='RIFF'&&body.toString('ascii',8,12)==='WEBP'){
    const format=body.toString('ascii',12,16);
    if(format==='VP8X')return {width:1+body.readUIntLE(24,3),height:1+body.readUIntLE(27,3),type:'image/webp'};
    if(format==='VP8 ')return {width:body.readUInt16LE(26)&0x3fff,height:body.readUInt16LE(28)&0x3fff,type:'image/webp'};
    if(format==='VP8L'){const bits=body.readUInt32LE(21);return {width:1+(bits&0x3fff),height:1+((bits>>>14)&0x3fff),type:'image/webp'};}
  }
  if(body.length>4&&body[0]===255&&body[1]===216){
    let offset=2;
    while(offset+8<body.length){if(body[offset]!==255)break;const marker=body[offset+1];const size=body.readUInt16BE(offset+2);if(size<2||offset+2+size>body.length)break;
      if([192,193,194].includes(marker))return {height:body.readUInt16BE(offset+5),width:body.readUInt16BE(offset+7),type:'image/jpeg'};offset+=size+2;}
  }
  throw new AppError('Usa una imagen PNG, JPG o WebP válida',400,'INVALID_IMAGE');
}
export class BackgroundStore {
  constructor(private readonly db:Database){db.transaction(()=>db.exec(`CREATE TABLE IF NOT EXISTS appearance_backgrounds(id TEXT PRIMARY KEY,title TEXT NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,type TEXT NOT NULL,body BLOB NOT NULL);CREATE TABLE IF NOT EXISTS appearance_config(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);`))();}
  private admin(id:string):void {if(!(this.db.prepare('SELECT is_admin FROM players WHERE id=?').get(id) as {is_admin:number}|undefined)?.is_admin)throw new AppError('No tienes permisos de administrador',403,'FORBIDDEN');}
  list():BackgroundAsset[]{return this.db.prepare('SELECT id,title,width,height,length(body) AS bytes FROM appearance_backgrounds ORDER BY rowid DESC').all() as BackgroundAsset[];}
  exists(id:string):boolean{return !!this.db.prepare('SELECT 1 FROM appearance_backgrounds WHERE id=?').get(id);}
  upload(admin:string,title:string,body:Buffer):BackgroundAsset {
    this.admin(admin);const name=z.string().trim().min(1).max(80).parse(title);
    if(body.length>750_000)throw new AppError('El fondo debe ocupar menos de 750 KB',413,'IMAGE_TOO_LARGE');
    const info=imageDimensions(body);if(info.width<1||info.height<1||info.width>1920||info.height>1920)throw new AppError('El fondo debe medir como máximo 1920 × 1920 px',400,'IMAGE_DIMENSIONS');
    const id=createHash('sha256').update(body).digest('hex');
    if(!this.exists(id)&&(this.db.prepare('SELECT count(*) AS n FROM appearance_backgrounds').get() as {n:number}).n>=200)throw new AppError('La biblioteca admite hasta 200 fondos',400,'BACKGROUND_LIMIT');
    this.db.prepare('INSERT OR IGNORE INTO appearance_backgrounds(id,title,width,height,type,body) VALUES(?,?,?,?,?,?)').run(id,name,info.width,info.height,info.type,body);
    return this.list().find(asset=>asset.id===id)!;
  }
  read(id:string):{body:Buffer;type:string}|null {return this.db.prepare('SELECT body,type FROM appearance_backgrounds WHERE id=?').get(id) as {body:Buffer;type:string}|undefined??null;}
  defaultBackground():ClubBackground|null {const row=this.db.prepare('SELECT data FROM appearance_config WHERE id=1').get() as {data:string}|undefined;return row?JSON.parse(row.data):null;}
  setDefault(admin:string,input:unknown):void {this.admin(admin);if(input===null){this.db.prepare('DELETE FROM appearance_config WHERE id=1').run();return;}const value=clubBackgroundSchema.parse(input);if(value.backgroundId&&!this.exists(value.backgroundId))throw new AppError('Fondo no encontrado',404,'BACKGROUND_NOT_FOUND');this.db.prepare('INSERT INTO appearance_config(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(value));}
}

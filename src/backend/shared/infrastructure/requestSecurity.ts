import { AppError } from '../domain/AppError';
import { sqlite } from './db/sqlite';
// Shared across workers; bounded windows expire opportunistically, with no background timer.
sqlite.exec('CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_request_limits_window ON request_limits(window)');
export function limitAction(actor:string, action:string, maximum=30):void {
 const now=Date.now(), window=Math.floor(now/60000), key=action+':'+actor;
 const allowed=sqlite.transaction(()=>{
  sqlite.prepare('DELETE FROM request_limits WHERE window<?').run(window-2);
  sqlite.prepare(`INSERT INTO request_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET
   count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window`).run(key,window);
  return (sqlite.prepare('SELECT count FROM request_limits WHERE key=?').get(key) as {count:number}).count<=maximum;
 }).immediate();
 if(!allowed)throw new AppError('Demasiados intentos. Espera un minuto antes de repetir.',429,'RATE_LIMITED');
}
export async function readSmallJson(request:Request):Promise<unknown>{
 const max=16*1024;
 if(Number(request.headers.get('content-length'))>max)throw new AppError('Solicitud demasiado grande',413,'PAYLOAD_TOO_LARGE');
 const reader=request.body?.getReader();if(!reader)throw new AppError('Falta la solicitud',400,'INVALID_REQUEST');
 const decoder=new TextDecoder();let text='',size=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new AppError('Solicitud demasiado grande',413,'PAYLOAD_TOO_LARGE');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
 try{return JSON.parse(text);}catch{throw new AppError('JSON inválido',400,'INVALID_REQUEST');}
 }finally{reader.releaseLock();}
}

import { requestOrigin } from '@/backend/shared/infrastructure/requestOrigin';
import { createHash, randomBytes } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';
import { AppError } from '@/backend/shared/domain/AppError';
import { BackgroundStore } from './BackgroundStore';
import { AppearanceStore } from './AppearanceStore';
export const appearanceStore = new AppearanceStore(sqlite);
export const backgroundStore = new BackgroundStore(sqlite);
const COOKIE='canicas_session';
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
export function sessionPlayer(request:Request):string|null {
  const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return (sqlite.prepare('SELECT player_id FROM appearance_sessions WHERE token_hash=? AND expires>?').get(digest(token),Date.now()) as {player_id:string}|undefined)?.player_id??null;
}
export function requireAdmin(request:Request):string {
  const id=sessionPlayer(request);
  if(!id)throw new AppError('Vuelve a iniciar sesión para administrar los eventos',401,'SESSION_REQUIRED');
  appearanceStore.assertAdmin(id);return id;
}
export function sameOrigin(request:Request):void {
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new AppError('Origen no permitido',403,'INVALID_ORIGIN');
  const origin=request.headers.get('origin');
  const expectedOrigin=requestOrigin(request);
  if(origin&&origin!==expectedOrigin)throw new AppError('Origen no permitido',403,'INVALID_ORIGIN');
}
export function issueSession(response:NextResponse,playerId:string,request:Request):void {
  const token=randomBytes(32).toString('hex'); const maxAge=60*60*24*30;
  sqlite.prepare('DELETE FROM appearance_sessions WHERE expires<=?').run(Date.now());
  sqlite.prepare('INSERT INTO appearance_sessions(token_hash,player_id,expires) VALUES(?,?,?)').run(digest(token),playerId,Date.now()+maxAge*1000);
  response.cookies.set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:requestOrigin(request).startsWith('https:'),path:'/',maxAge});
}
export function clearSession(request:Request,response:NextResponse):void {
  const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  if(token)sqlite.prepare('DELETE FROM appearance_sessions WHERE token_hash=?').run(digest(token));
  response.cookies.set(COOKIE,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
}

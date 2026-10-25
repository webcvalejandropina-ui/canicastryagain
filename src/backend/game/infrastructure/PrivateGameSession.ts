import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';
import { sameOrigin, sessionPlayer } from '@/backend/appearance/runtime';
import { requestOrigin } from '@/backend/shared/infrastructure/requestOrigin';
import { limitAction } from '@/backend/shared/infrastructure/requestSecurity';
import { AppError } from '@/backend/shared/domain/AppError';
const COOKIE='canicas_guest_session';
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export type GameActor={playerId:string;playerName:string;isGuest:boolean;isAdmin?:boolean};
const guestStatement=sqlite.prepare('SELECT player_id,player_name FROM game_guest_sessions WHERE token_hash=? AND expires>?');
const aliasStatement=sqlite.prepare('SELECT alias,is_admin FROM players WHERE id=?');
export function gameActor(request:Request):GameActor|null {
 const registered=sessionPlayer(request);
 if(registered){const row=aliasStatement.get(registered)as{alias:string;is_admin:number}|undefined;if(row)return{playerId:registered,playerName:row.alias,isGuest:false,isAdmin:Boolean(row.is_admin)};}
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const guest=guestStatement.get(hash(token),Date.now())as{player_id:string;player_name:string}|undefined;
 return guest?{playerId:guest.player_id,playerName:guest.player_name,isGuest:true}:null;
}
export function createGuestSession(response:NextResponse,request:Request):GameActor {
 const token=randomBytes(32).toString('hex'),maxAge=30*24*60*60;
 const actor={playerId:'guest-'+randomUUID(),playerName:'Invitado',isGuest:true};
 sqlite.prepare('DELETE FROM game_guest_sessions WHERE expires<=?').run(Date.now());
 sqlite.prepare('INSERT INTO game_guest_sessions(token_hash,player_id,player_name,expires) VALUES(?,?,?,?)').run(hash(token),actor.playerId,actor.playerName,Date.now()+maxAge*1000);
 response.cookies.set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:requestOrigin(request).startsWith('https:'),path:'/',maxAge});
 return actor;
}
export function requireGameActor(request:Request,playerId:string):void {
 if(gameActor(request)?.playerId!==playerId)throw new AppError('Vuelve a entrar con tu enlace privado o inicia sesión.',403,'GAME_SESSION_REQUIRED');
}
// Historical export names retained for callers; every game now requires its actor session.
export function requirePrivateGameActor(request:Request,_gameId:string,playerId:string):void {
 if(request.method!=='GET'){sameOrigin(request);limitAction(playerId,'game-action',120);}
 requireGameActor(request,playerId);
}
export function requirePrivateJoinActor(request:Request,playerId:string,_token?:string,_code?:string):void {
 void _token;void _code;
 sameOrigin(request);requireGameActor(request,playerId);
}

export function revokeGuestSession(request:Request,response:NextResponse):void {
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(token&&/^[a-f0-9]{64}$/.test(token))sqlite.prepare('DELETE FROM game_guest_sessions WHERE token_hash=?').run(hash(token));
 response.cookies.set(COOKIE,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
}

import { readSmallJson, limitAction } from '@/backend/shared/infrastructure/requestSecurity';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';
import { sameOrigin } from '@/backend/appearance/runtime';
import { AppError } from '@/backend/shared/domain/AppError';
import { toHttpError } from '@/backend/shared/infrastructure/http';
import { createGuestSession, gameActor } from '@/backend/game/infrastructure/PrivateGameSession';
const schema=z.object({inviteToken:z.string().regex(/^cta2\.[A-Za-z0-9_-]{43}$/).optional(),gameCode:z.string().regex(/^[A-Z0-9]{6}$/).optional()}).strict().refine(value=>Boolean(value.inviteToken||value.gameCode));
export async function POST(request:Request):Promise<NextResponse>{
 try{
  sameOrigin(request);
  limitAction("bootstrap","invitation",1200);
  const {inviteToken,gameCode}=schema.parse(await readSmallJson(request));
  const row=sqlite.prepare('SELECT created_at,status,private_invite_expires_at,player1_id,player2_id FROM games WHERE '+(inviteToken?'private_invite_token=?':'code=?')).get(inviteToken??gameCode)as{created_at:string;status:string;private_invite_expires_at:string;player1_id:string;player2_id:string|null}|undefined;
  const actor=gameActor(request);
  const member=actor&&(row?.player1_id===actor.playerId||row?.player2_id===actor.playerId);
  if(!row)throw new AppError('El enlace ha caducado o la mesa se ha cancelado.',410,'INVITE_EXPIRED');
  if(!member&&row.status!=='waiting')throw new AppError('Este enlace ya tiene rival.',409,'INVITE_ALREADY_USED');
  if(!member&&Date.parse(row.private_invite_expires_at??row.created_at)+ (row.private_invite_expires_at?0:300000)<=Date.now())throw new AppError('El enlace ha caducado. Pide una nueva partida.',410,'INVITE_EXPIRED');
  const response=NextResponse.json({actor}, {headers:{'Cache-Control':'private, no-store'}});
  if(!actor){const guest=createGuestSession(response,request);return NextResponse.json({actor:guest},{headers:response.headers});}
  return response;
 }catch(error){const http=toHttpError(error);return NextResponse.json(http.body,{status:http.status,headers:{'Cache-Control':'private, no-store'}});}
}

import { MIN_ROWS, MAX_ROWS, DEFAULT_ROWS } from '@/shared/gameConfig';
import { readSmallJson } from '@/backend/shared/infrastructure/requestSecurity';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionPlayer, sameOrigin } from '@/backend/appearance/runtime';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';
import { AppError } from '@/backend/shared/domain/AppError';
import { toHttpError } from '@/backend/shared/infrastructure/http';
import { RivalStore } from '@/backend/social/RivalStore';
import { publishGameUpdated } from '@/backend/game/infrastructure/GameEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const store = new RivalStore(sqlite);
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const id = z.string().min(1).max(100);
const command = z.discriminatedUnion('action', [
  z.object({ action:z.literal('invite'), rivalId:id, numRows:z.number().int().min(MIN_ROWS).max(MAX_ROWS).default(DEFAULT_ROWS) }).strict(),
  z.object({ action:z.enum(['hide','restore']), rivalId:id }).strict(),
  z.object({ action:z.enum(['accept','decline','cancel']), invitationId:id }).strict(),
]);
function owner(request:Request):string {
  const player=sessionPlayer(request);
  if(!player) throw new AppError('Vuelve a iniciar sesión para ver tus rivales e invitaciones.',401,'SESSION_REQUIRED');
  return player;
}
export async function GET(request:Request) {
  try { return NextResponse.json(store.list(owner(request)),{headers}); }
  catch(error) { const problem=toHttpError(error); return NextResponse.json(problem.body,{status:problem.status,headers}); }
}
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    const player=owner(request);
    const input=command.parse(await readSmallJson(request));
    let gameCode:string|null=null;
    if(input.action==='invite') store.invite(player,input.rivalId,input.numRows);
    else if(input.action==='hide') store.hide(player,input.rivalId);
    else if(input.action==='restore') store.restore(player,input.rivalId);
    else if ('invitationId' in input) {
      const result=store.respond(player,input.invitationId,input.action);
      gameCode=result.gameCode;
      if(result.gameId) publishGameUpdated(result.gameId,'join');
    }
    return NextResponse.json({...store.list(player),gameCode},{headers});
  } catch(error) { const problem=toHttpError(error); return NextResponse.json(problem.body,{status:problem.status,headers}); }
}

import { MIN_ROWS, MAX_ROWS, DEFAULT_ROWS } from '@/shared/gameConfig';
import { limitAction } from '@/backend/shared/infrastructure/requestSecurity';
import { gameActor } from '@/backend/game/infrastructure/PrivateGameSession';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';
import { AppError } from '@/backend/shared/domain/AppError';
import { readSmallJson } from '@/backend/shared/infrastructure/requestSecurity';
import { requireGameActor } from '@/backend/game/infrastructure/PrivateGameSession';
import { sameOrigin } from '@/backend/appearance/runtime';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const createGameSchema = z.object({
  privateInvitation: z.boolean().optional().default(false),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  numRows: z.coerce.number().int().min(MIN_ROWS).max(MAX_ROWS).optional().default(DEFAULT_ROWS)
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = createGameSchema.parse(await readSmallJson(request));
    sameOrigin(request);requireGameActor(request,payload.playerId);
    limitAction(payload.playerId,"create",10);
    const game = await container.createGameUseCase.execute({...payload,playerName:gameActor(request)!.playerName});
    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}

export async function GET(request:Request):Promise<NextResponse>{
 try {
  const actor=gameActor(request);
  if(!actor)throw new AppError('Inicia sesión para ver tus partidas',403,'GAME_SESSION_REQUIRED');
  const games=sqlite.prepare(`SELECT id AS gameId,code AS gameCode,status,current_turn AS currentTurn,
    player1_id AS player1Id,player1_name AS player1Name,player2_name AS player2Name,updated_at AS updatedAt
    FROM games WHERE (player1_id=? OR player2_id=?) AND
    ((status='playing' AND updated_at>?) OR (status='waiting' AND created_at>?))
    ORDER BY updated_at DESC LIMIT 5`).all(actor.playerId,actor.playerId,new Date(Date.now()-86400000).toISOString(),new Date(Date.now()-300000).toISOString());
  return NextResponse.json({games},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const http=toHttpError(error);return NextResponse.json(http.body,{status:http.status});}
}

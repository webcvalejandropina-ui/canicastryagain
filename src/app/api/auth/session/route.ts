import {NextResponse} from 'next/server';
import {gameActor} from '@/backend/game/infrastructure/PrivateGameSession';
export async function GET(request:Request):Promise<NextResponse>{return NextResponse.json({actor:gameActor(request)},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});}

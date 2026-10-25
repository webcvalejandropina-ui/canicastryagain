import {revokeGuestSession} from '@/backend/game/infrastructure/PrivateGameSession';
import { NextResponse } from 'next/server';
import { sameOrigin, clearSession } from '@/backend/appearance/runtime';
export async function POST(request:Request):Promise<NextResponse>{
  try{sameOrigin(request);const response=NextResponse.json({success:true});clearSession(request,response);revokeGuestSession(request,response);return response;}
  catch{return NextResponse.json({error:'Origen no permitido'},{status:403});}
}

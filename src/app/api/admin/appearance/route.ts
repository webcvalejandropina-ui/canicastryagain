import { readSmallJson } from '@/backend/shared/infrastructure/requestSecurity';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { appearanceStore, requireAdmin, sameOrigin } from '@/backend/appearance/runtime';
import { toHttpError } from '@/backend/shared/infrastructure/http';
export async function GET(request:Request):Promise<NextResponse>{
  try { requireAdmin(request);const playerId=new URL(request.url).searchParams.get('playerId');return NextResponse.json(playerId?{scene:appearanceStore.personal(playerId)}:{events:appearanceStore.events()},{headers:{'Cache-Control':'private, no-store'}}); }
  catch(error){const e=toHttpError(error);return NextResponse.json(e.body,{status:e.status});}
}
export async function POST(request:Request):Promise<NextResponse>{
  try {
    sameOrigin(request);const admin=requireAdmin(request);
    if(Number(request.headers.get('content-length')??0)>16384)return NextResponse.json({error:'Solicitud demasiado grande'},{status:413});
    const body=z.object({action:z.enum(['save','delete','assign']),event:z.unknown().optional(),id:z.string().max(100).optional(),playerId:z.string().max(100).optional()}).parse(await readSmallJson(request));
    if(body.action==='save')appearanceStore.saveEvent(admin,body.event);
    if(body.action==='delete')appearanceStore.removeEvent(admin,z.string().min(1).parse(body.id));
    if(body.action==='assign')appearanceStore.assign(admin,z.string().min(1).parse(body.playerId),body.event);
    return NextResponse.json({success:true});
  }catch(error){const e=toHttpError(error);return NextResponse.json(e.body,{status:e.status});}
}

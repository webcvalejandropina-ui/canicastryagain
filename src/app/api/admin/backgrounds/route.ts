import { z } from 'zod';
import { readSmallJson } from '@/backend/shared/infrastructure/requestSecurity';
import { NextResponse } from 'next/server';
import { requireAdmin,sameOrigin,backgroundStore } from '@/backend/appearance/runtime';
import { toHttpError } from '@/backend/shared/infrastructure/http';
export async function GET(request:Request):Promise<NextResponse>{try{requireAdmin(request);return NextResponse.json({backgrounds:backgroundStore.list(),club:backgroundStore.defaultBackground()},{headers:{'Cache-Control':'private, no-store'}});}catch(error){const e=toHttpError(error);return NextResponse.json(e.body,{status:e.status});}}
export async function POST(request:Request):Promise<NextResponse>{
  try{sameOrigin(request);const admin=requireAdmin(request);
    if(request.headers.get('content-type')?.includes('application/json')){const body=z.object({club:z.unknown()}).parse(await readSmallJson(request));backgroundStore.setDefault(admin,body.club);return NextResponse.json({success:true});}
    const reader=request.body?.getReader();if(!reader)return NextResponse.json({error:'Falta la imagen'},{status:400});
    const chunks:Uint8Array[]=[];let length=0;
    for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>750_000){await reader.cancel();return NextResponse.json({error:'El fondo debe ocupar menos de 750 KB'},{status:413});}chunks.push(value);}
    const title=decodeURIComponent(request.headers.get('x-background-title')??'Nuevo fondo');
    const asset=backgroundStore.upload(admin,title,Buffer.concat(chunks));return NextResponse.json({asset},{status:201});
  }catch(error){const e=toHttpError(error);return NextResponse.json(e.body,{status:e.status});}
}

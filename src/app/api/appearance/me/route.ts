import { z } from 'zod';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';
import { NextResponse } from 'next/server';
import { appearanceStore, sessionPlayer, sameOrigin } from '@/backend/appearance/runtime';
import { birthdaySchema } from '@/features/session/profile';
import { decodeBirthday, encodeBirthday } from '@/shared/birthday';
import { limitAction, readSmallJson } from '@/backend/shared/infrastructure/requestSecurity';
import { toHttpError } from '@/backend/shared/infrastructure/http';
import { AppError } from '@/backend/shared/domain/AppError';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
export async function GET(request:Request):Promise<NextResponse>{
  const id=sessionPlayer(request);
  const row=id?sqlite.prepare('SELECT locality,birthday FROM players WHERE id=?').get(id) as {locality:string|null;birthday:string|null}|undefined:undefined;
  return NextResponse.json({scene:id?appearanceStore.personal(id):null,registered:!!row,profile:row?{locality:row.locality,birthday:decodeBirthday(row.birthday)}:null},{headers});
}
export async function POST(request:Request):Promise<NextResponse>{
  try {
    sameOrigin(request);
    const id=sessionPlayer(request);
    if(!id)throw new AppError('Inicia sesión para guardar tu cumpleaños',401,'SESSION_REQUIRED');
    limitAction(id,'birthday-update',30);
    const {birthday}=z.object({birthday:birthdaySchema.nullable()}).strict().parse(await readSmallJson(request));
    sqlite.prepare('UPDATE players SET birthday=? WHERE id=?').run(encodeBirthday(birthday),id);
    return NextResponse.json({birthday},{headers});
  } catch(error) {
    const http=toHttpError(error);return NextResponse.json(http.body,{status:http.status,headers});
  }
}

import { createHash } from 'node:crypto';
import { appearanceStore,backgroundStore } from '@/backend/appearance/runtime';
export async function GET(request:Request):Promise<Response>{
  const body=JSON.stringify({events:appearanceStore.events().filter(e=>e.enabled),club:backgroundStore.defaultBackground()});
  const etag=`"${createHash('sha256').update(body).digest('hex').slice(0,24)}"`;
  const headers={'Content-Type':'application/json','Cache-Control':'public, max-age=60, stale-while-revalidate=240',ETag:etag};
  return new Response(request.headers.get('if-none-match')===etag?null:body,{status:request.headers.get('if-none-match')===etag?304:200,headers});
}

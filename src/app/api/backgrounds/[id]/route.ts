import { backgroundStore } from '@/backend/appearance/runtime';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}):Promise<Response>{
  const {id}=await params;if(!/^[a-f0-9]{64}$/.test(id)||!backgroundStore.exists(id))return new Response(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
  const headers={'Cache-Control':'public, max-age=31536000, immutable','ETag':`"${id}"`,'X-Content-Type-Options':'nosniff'};
  if(request.headers.get('if-none-match')===`"${id}"`)return new Response(null,{status:304,headers});
  const asset=backgroundStore.read(id)!;return new Response(new Uint8Array(asset.body),{headers:{...headers,'Content-Type':asset.type}});
}

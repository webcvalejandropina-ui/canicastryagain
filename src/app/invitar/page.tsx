import type {Metadata} from 'next';
import {headers} from 'next/headers';
import {requestOrigin} from '@/backend/shared/infrastructure/requestOrigin';
import {HomePageClient} from '../page-client';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{
 const incoming=await headers();
 const origin=requestOrigin(new Request('http://localhost/invitar',{headers:incoming}));
 const image=new URL('/share/canicas-invitacion.jpg',origin).href;
 return {title:'¿Una partida de Canicas?',description:'Entra directamente o usa el código. Dos jugadores, canicas de cristal y ocho poderes. Retirar la última pierde.',
  robots:{index:false,follow:false},
  openGraph:{type:'website',title:'¿Una partida de Canicas?',description:'Toca el enlace y juega con tu amigo. Gratis, desde tu móvil.',images:[{url:image,width:1200,height:630,alt:'Canicas de cristal. ¿Una partida?'}]},
  twitter:{card:'summary_large_image',images:[image]}};
}
// Crawlers receive public artwork only. The token remains in the URL fragment;
// creating a guest session and claiming the seat require explicit client POSTs.
export default function Invitation():React.ReactElement{return <HomePageClient/>;}

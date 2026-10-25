import type { MetadataRoute } from 'next';
export default function manifest():MetadataRoute.Manifest {
 return {id:'/',name:'Canicas Try Again',short_name:'Canicas',lang:'es',description:'Canicas de cristal, retos entre amigos y práctica sin conexión.',start_url:'/',scope:'/',display:'standalone',background_color:'#0c1814',theme_color:'#173e30',icons:[{src:'/icons/marble-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/marble-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/marble-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}

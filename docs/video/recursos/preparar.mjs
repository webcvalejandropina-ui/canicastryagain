import fs from 'node:fs/promises';import path from 'node:path';import{createRequire}from'node:module';import os from 'node:os';import{fileURLToPath}from'node:url';
const require=createRequire(import.meta.url),sharp=require(process.env.CANICAS_SHARP_MODULE||'sharp');
const root=fileURLToPath(new URL('../',import.meta.url)),tmp=process.env.CANICAS_VIDEO_TMP||path.join(os.tmpdir(),'canicas-video-render'),src=path.join(root,'recursos/originales');
await fs.mkdir(tmp,{recursive:true});
const plan=JSON.parse(await fs.readFile(root+'/guion/PLAN.json','utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const data=async f=>'data:image/'+(f.endsWith('.webp')?'webp':'png')+';base64,'+(await fs.readFile(f)).toString('base64');
const marble=await data(src+'/canica-cristal.png'),bg='data:image/png;base64,'+(await sharp(src+'/fondo-gibraltar.webp').png().toBuffer()).toString('base64');
const text=(x,y,s,z=44,c='#173f38',extra='')=>`<text x="${x}" y="${y}" font-family="Archivo,Arial" font-size="${z}" fill="${c}" ${extra}>${esc(s)}</text>`;
const pic=(u,x,y,w,h)=>`<image href="${u}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const svg=(b,w=1080,h=1920)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="wash" x2="0" y2="1"><stop stop-color="#fbfaf1"/><stop offset=".35" stop-color="#fbfaf1" stop-opacity=".25"/><stop offset=".75" stop-color="#fbfaf1" stop-opacity=".15"/><stop offset="1" stop-color="#fbfaf1"/></linearGradient></defs>${b}</svg>`;
async function png(name,b,w=1080,h=1920){await sharp(Buffer.from(svg(b,w,h))).png().toFile(tmp+'/'+name+'.png');}
await sharp(root+'/capturas/03-seleccion.jpg').extract({left:295,top:500,width:555,height:510}).resize(920,846).png().toFile(tmp+'/board.png');
await sharp(root+'/capturas/03-seleccion.jpg').extract({left:1128,top:998,width:267,height:58}).resize(690,150).png().toFile(tmp+'/button.png');
await sharp(root+'/capturas/05-dado.jpg').extract({left:590,top:245,width:290,height:210}).resize(760,550).png().toFile(tmp+'/dice.png');
const layers=[];
for(const s of plan){
 let b=`<rect width="1080" height="1920" fill="#fbfaf1"/>`;
 if(['hero','outro'].includes(s.kind))b+=pic(bg,-430,520,1950,1080)+'<rect y="510" width="1080" height="1150" fill="url(#wash)"/>';
 b+=pic(marble,64,55,55,55)+text(135,98,'canicas',45,'#173f38','font-weight="800" letter-spacing="-2"')+text(1010,95,'CÓMO JUGAR',22,'#526e60','text-anchor="end" letter-spacing="3"');
 b+='<path d="M65 143H1015" stroke="#cad6c7"/>'+text(65,215,`${s.id} / ${plan.length}`,25,'#63836c','letter-spacing="4"');
 s.title.forEach((l,i)=>b+=text(65,350+i*114,l,s.kind==='revive'?85:98,'#173f38',`font-weight="800" letter-spacing="-4"`));
 let sprites=[];
 const sphere=(x,y,d,n,props={})=>{sprites.push({x,y,d,index:n,...props});b+=`<ellipse cx="${x+d/2}" cy="${y+d+13}" rx="${d*.35}" ry="${d*.055}" fill="#294b39" opacity=".13"/>`;};
 const center=(y,t,z=34,c='#315f4e')=>b+=text(540,y,t,z,c,'text-anchor="middle"');
 if(s.kind==='hero'){sphere(180,625,720,0,{hero:true});b+='<rect x="210" y="1378" width="660" height="95" rx="47" fill="#fbfaf1" opacity=".9"/>';center(1440,'ESTRATEGIA PARA DOS',30);}
 if(s.kind==='invite'){
  b+='<rect x="100" y="620" width="880" height="220" rx="28" fill="#edf0e5"/>';
  b+=text(145,695,'ELIGE TUS FILAS',28,'#526e60','letter-spacing="3"')+text(145,795,'1 — 100',96,'#173f38','font-weight="800"');
  sphere(140,940,250,0,{hero:true});sphere(690,940,250,1,{hero:true});
  b+='<path d="M430 1060H650m-25-22 25 22-25 22" fill="none" stroke="#799648" stroke-width="6"/>';
  center(1350,'CREA → COMPARTE → EMPEZAD',36);center(1440,'Al entrar tu rival, empieza para ambos.',30);
 }
 if(s.kind==='zoom'){
  await sharp(root+'/capturas/01-cien-filas.jpg').extract({left:74,top:417,width:990,height:693}).resize(950,665).png().toFile(tmp+'/overview.png');
  await sharp(root+'/capturas/02-zoom-real.jpg').extract({left:74,top:417,width:990,height:693}).resize(950,665).png().toFile(tmp+'/zoom.png');
  b+=pic(await data(tmp+'/overview.png'),65,600,950,665);
  center(550,'100 FILAS · 5.050 CANICAS',32);center(1380,'VER TODO ↔ ACERCAR',44);center(1460,'Las canicas grandes se eligen con precisión.',30);
 }
 if(s.kind==='worlds'){
  for(const [i,id,label] of [[0,'gibraltar','LA LÍNEA · GIBRALTAR'],[1,'tarifa','VERANO · TARIFA'],[2,'birthday','TU CUMPLEAÑOS · 3 DÍAS · CON CUENTA']]){
   const photo=await sharp(src+'/fondo-'+id+'.webp').resize(950,630,{fit:'cover'}).png().toBuffer();
   await png('world-'+i,`<image href="data:image/png;base64,${photo.toString('base64')}" x="0" y="0" width="950" height="630"/><rect y="535" width="950" height="95" fill="#fbfaf1" opacity=".96"/>${text(475,594,label,i===2?28:32,'#173f38','text-anchor="middle" font-weight="700"')}`,950,630);
  }
  b+=pic(await data(tmp+'/world-0.png'),65,585,950,630);
  const labels=[['halloween','Halloween'],['christmas','Navidad'],['holy-week','Semana Santa']];
  for(let i=0;i<labels.length;i++){
   const [id,label]=labels[i];const photo=await sharp(src+'/fondo-'+id+'.webp').resize(290,165,{fit:'cover'}).png().toBuffer();
   b+=`<image href="data:image/png;base64,${photo.toString('base64')}" x="${65+i*330}" y="1290" width="290" height="165"/>`+text(210+i*330,1500,label,28,'#315f4e','text-anchor="middle"');
  }
 }
 if(s.kind==='resume'){
  for(let c=0;c<5;c++){
    sphere(70+c*190,760,170,c,{delay:c*.18});
    b+=text(155+c*190,1040,String(c+1),40,'#315f4e','text-anchor="middle" font-weight="800"');
  }
  center(1190,'24 h',150);center(1280,'SIN JUGADAS',36);center(1410,'Sal y continúa cuando quieras.',38);
 }
 if(s.kind==='select'){
  b+=pic(await data(tmp+'/board.png'),80,525,920,846)+pic(await data(tmp+'/button.png'),195,1390,690,150);
  center(520,'JUGADA 3 · TRES CANICAS SEGUIDAS',28);
 }
 if(s.kind==='counter'){
  for(let r=0;r<3;r++){
   b+=text(85,710+r*265,`0${r+1}`,82,'#568366','font-weight="800"')+text(85,760+r*265,r===1?'RIVAL':'TÚ',25,'#526e60');
   for(let c=0;c<=r;c++)sphere(345+c*195,600+r*265,165,c+r*3,{delay:r*1.25});
  }center(1460,'1 → 2 → 3 → 4 → …',48);
 }
 if(s.kind==='gap'){
  for(let c=0;c<5;c++){let x=80+c*190;if(c===2)b+=text(x+70,930,'×',100,'#b26851','text-anchor="middle"');else sphere(x,790,155,c);}
  b+='<path d="M150 1060H930" stroke="#b26851" stroke-width="5" stroke-dasharray="14 15"/>';
  center(1170,'ESTA SELECCIÓN NO VALE',36,'#9b4a3c');center(1290,'El hueco separa dos bloques.',38);
 }
 if(s.kind==='dice'){
  b+=pic(await data(tmp+'/dice.png'),160,615,760,550);center(1290,'8 OPCIONES · 12,5 % CADA UNA',38);center(1400,'El dado sustituye tu jugada normal.',33);
 }
 if(s.kind==='powers'){
  const powers=[['Bomba','Una fila activa al azar','#b25c45'],['Rayo','Una por fila activa','#a57b22'],['Diagonal','Origen + diagonales','#76569c'],['Avalancha','Baja por ramas vivas','#336c87'],['Fantasma','Vivas cercanas a los lados','#776480'],['Remolino','Mezcla vivas y huecos','#2d827a']];
  powers.forEach(([n,d,c],i)=>{let x=65+(i%2)*500,y=625+Math.floor(i/2)*260;b+=`<rect x="${x}" y="${y}" width="450" height="210" rx="24" fill="#edf0e5"/><circle cx="${x+38}" cy="${y+45}" r="8" fill="${c}"/>`+text(x+28,y+108,n,47,c,'font-weight="800"')+text(x+28,y+161,d,30,'#456452');});
  center(1480,'Y dos poderes que cambian el ritmo…',33);
 }
 if(s.kind==='revive'){
  for(let r=0;r<4;r++)for(let c=0;c<=r;c++){
   const x=540-(r*175+140)/2+c*175,y=630+r*185,n=r*5+c,revive=[0,10,16,18].includes(n);
   b+=`<circle cx="${x+70}" cy="${y+70}" r="66" fill="none" stroke="#aebdad" stroke-width="2"/>`;
   if(revive)b+=text(x+70,y+87,'×',58,'#a27d6c','text-anchor="middle"');
   sphere(x,y,140,n,{affected:revive,revive});
  }center(1480,'Reaparecen en posiciones distintas.',35);
 }
 if(s.kind==='manual'){
  b+='<path d="M180 895H960m-30-25 30 25-30 25" stroke="#b49b4e" stroke-width="6" stroke-dasharray="14 10" fill="none"/>';
  for(let c=0;c<4;c++)sphere(100+c*235,810,165,c,{shot:true});
  b+=text(85,1160,'FUERZA',30,'#526e60','letter-spacing="3"')+'<rect x="85" y="1200" width="910" height="34" rx="17" fill="#dfe5d5"/>';
  center(1345,'1. APUNTA  2. MANTÉN  3. SUELTA',33);center(1430,'Cada choque consume fuerza.',36);
 }
 if(s.kind==='outro'){
  for(let c=0;c<3;c++)sphere(95+c*315,810,260,c,{ending:c<2});
  b+='<rect x="40" y="1170" width="1000" height="320" rx="25" fill="#fbfaf1" opacity=".95"/>';center(1240,'QUEDAN 3 → QUITAS 2 → DEJAS 1',34);center(1315,'Ejemplo: el límite ya permite quitar 2.',28);center(1435,'¿Jugamos?',78);
 }
 if(['hero','outro'].includes(s.kind))b+='<rect y="1510" width="1080" height="410" fill="#fbfaf1"/>';
 b+=text(65,1590,s.subtitle,30,'#456452');
 b+=text(65,1880,['select','zoom','dice'].includes(s.kind)?'CAPTURA REAL · VERSIÓN ACTUAL':'EJEMPLO ANIMADO · REGLAS ACTUALES',19,'#718571','letter-spacing="2"');
 await png(s.id+'-base',b);
 for(const sp of sprites)await sharp(src+'/canica-cristal.png').resize(sp.d,sp.d).png().toFile(tmp+'/'+s.id+'-m'+sp.index+'.png');
 layers.push({id:s.id,sprites});
}
await fs.writeFile(tmp+'/layers.json',JSON.stringify(layers));
await png('progress','<rect width="1080" height="5" fill="#56856a"/>',1080,5);
await png('pointer','<circle cx="49" cy="49" r="35" fill="#fbfaf1" opacity=".7" stroke="#173f38" stroke-width="3"/><circle cx="49" cy="49" r="6" fill="#173f38"/>',98,98);
await png('spark','<path d="M50 0Q50 50 100 50Q50 50 50 100Q50 50 0 50Q50 50 50 0Z" fill="#fffbe2"/>',100,100);
await png('force','<rect width="910" height="34" rx="17" fill="#8aa336"/>',910,34);
console.log(plan.length+' escenas preparadas');

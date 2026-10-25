'use client';
import { useEffect, useRef, useState } from 'react';
import './private-invite.css';
export function PrivateWaitingInvite({expiresAt,url,status,onShare,code,onCopyCode}:{expiresAt?:string|null;url:string;status:string;onShare:()=>Promise<void>;code?:string;onCopyCode?:()=>Promise<void>}):React.ReactElement{
 const [now,setNow]=useState<number|null>(null),[notice,setNotice]=useState(''),[manual,setManual]=useState(false),[sharing,setSharing]=useState(false);
 const field=useRef<HTMLInputElement>(null);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const seconds=now===null?null:Math.max(0,Math.ceil((Date.parse(expiresAt??'')-now)/1000));
 const expired=seconds===0;
 const countdown=seconds===null?'5:00':`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 async function copy(){try{await navigator.clipboard.writeText(url);setNotice('Enlace copiado. Envíalo a tu rival.');}catch{setManual(true);setNotice('Mantén pulsado el enlace para copiarlo.');}}
 return <section className="private-invite-panel" aria-label="Invitación privada">
  <span className="private-invite-tag">TU MESA PRIVADA <span aria-live="off">{countdown}</span></span>
  <h2>{expired?'Este enlace ha caducado.':'Solo falta tu rival.'}</h2>
  <p>{expired?'Cancela esta mesa y crea otra para generar un enlace nuevo.':'Envía el enlace a una persona. Cuando lo abra, la partida empieza para los dos.'}</p>
  <button className="pocket-primary" type="button" disabled={expired||sharing||!url} onClick={async()=>{if(sharing)return;setSharing(true);try{await onShare();}finally{setSharing(false);}}}>{sharing?'Abriendo…':'Invitar por WhatsApp'} <span aria-hidden="true">↗</span></button>
  {code&&<button type="button" className="private-copy" disabled={expired} onClick={()=>void onCopyCode?.()}>Copiar código · <strong>{code}</strong></button>}
  <button className="private-copy" type="button" disabled={expired||!url} onClick={()=>void copy()}>Copiar enlace</button>
  {manual&&<input ref={field} aria-label="Enlace privado para copiar" readOnly value={url} onFocus={event=>event.target.select()}/>}
  <small>{status||'El enlace caduca a los cinco minutos y se cierra al entrar tu rival.'}</small>
  {notice&&<p className="private-copy-notice" role="status">{notice}</p>}
 </section>;
}

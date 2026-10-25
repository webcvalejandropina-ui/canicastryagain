'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '@/features/game/api/gameApi';
import type { RivalData } from './types';
import './rivals.css';

type Command = {action:'invite'|'hide'|'restore';rivalId:string;numRows?:number} |
  {action:'accept'|'decline'|'cancel';invitationId:string};
const date = (value:string) => new Intl.DateTimeFormat('es',{day:'numeric',month:'short'}).format(new Date(value));

export function RivalsPanel({playerId,numRows,onJoin}:{playerId:string;numRows:number;onJoin:(code:string)=>Promise<void>}) {
  const [data,setData]=useState<RivalData|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState('');
  const locked=useRef(false);
  const alive=useRef(true);
  const version=useRef(0);
  const refresh=useCallback(async()=>{
    if(document.hidden || locked.current) return;
    const requestVersion=++version.current;
    try {
      const next=await request<RivalData>('/api/rivals');
      if(alive.current && requestVersion===version.current){setData(next);setError('');}
    } catch(problem) {
      if(alive.current && requestVersion===version.current) setError(problem instanceof Error?problem.message:'No se pudieron cargar los rivales');
    }
  },[]);
  useEffect(()=>{
    alive.current=true; setData(null);
    void refresh();
    const timer=window.setInterval(()=>void refresh(),20_000);
    const visible=()=>{if(!document.hidden)void refresh();};
    window.addEventListener('focus',visible);
    window.addEventListener('online',visible);
    document.addEventListener('visibilitychange',visible);
    return ()=>{
      alive.current=false;
      window.clearInterval(timer);window.removeEventListener('focus',visible);
      window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);
    };
  },[playerId,refresh]);
  const act=async(command:Command)=>{
    if(locked.current)return;
    locked.current=true;version.current++;setBusy(true);setError('');setNotice('');
    try {
      const next=await request<RivalData & {gameCode:string|null}>('/api/rivals',{method:'POST',body:JSON.stringify(command)});
      if(!alive.current)return;
      setData(next);
      if(command.action==='invite')setNotice('Invitación preparada. Tu rival la verá al abrir su menú; caduca en 24 horas.');
      if(command.action==='hide')setNotice('Rival quitado de tu lista. Puedes recuperarlo en «Rivales ocultos».');
      if(next.gameCode)await onJoin(next.gameCode);
    } catch(problem){if(alive.current)setError(problem instanceof Error?problem.message:'No se pudo completar la acción');}
    finally {locked.current=false;if(alive.current)setBusy(false);}
  };
  const enter=async(code:string)=>{
    if(locked.current)return;
    locked.current=true;setBusy(true);setError('');
    try {await onJoin(code);}catch(problem){if(alive.current)setError(problem instanceof Error?problem.message:'No se pudo entrar en la partida');}
    finally{locked.current=false;if(alive.current)setBusy(false);}
  };
  const filtered=data?.rivals.filter(r=>r.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  return <section id="rivales" className="rivals-panel" aria-labelledby="rivals-heading" aria-busy={busy}>
    <div className="rivals-heading">
      <div><span className="rivals-eyebrow">VOLVER A ENCONTRARSE</span><h3 id="rivals-heading">Tus rivales</h3></div>
      <button type="button" className="rivals-quiet" disabled={busy} onClick={()=>void refresh()} aria-label="Actualizar rivales">Actualizar</button>
    </div>
    <p className="rivals-intro">Las personas con las que has jugado. Una revancha, cuando os apetezca.</p>
    {error && <p role="alert" className="rivals-error">{error}</p>}
    <p className="rivals-notice" role="status">{notice}</p>
    {!data && !error && <p className="rivals-empty">Buscando partidas compartidas…</p>}
    {!!data?.invitations.length && <div className="rivals-invitations" aria-label="Invitaciones a partidas">
      {data.invitations.map(i=><div key={i.id} className="rivals-invite">
        <div><span className="rivals-eyebrow">{i.status==='accepted'?'MESA PREPARADA':i.incoming?'TE INVITA A JUGAR':'INVITACIÓN ENVIADA'}</span>
          <strong>{i.name}</strong><small>{i.numRows} filas · {i.status==='accepted'?'La partida ya puede empezar':i.incoming?'¿Una nueva partida?':'Esperando respuesta · 24 h'}</small></div>
        <div className="rivals-actions">
          {i.status==='accepted' && i.gameCode ? <button type="button" className="rivals-primary" disabled={busy} onClick={()=>void enter(i.gameCode!)}>Entrar</button> : i.incoming ? <>
            <button type="button" className="rivals-primary" disabled={busy} onClick={()=>void act({action:'accept',invitationId:i.id})}>Aceptar</button>
            <button type="button" className="rivals-quiet" disabled={busy} onClick={()=>void act({action:'decline',invitationId:i.id})}>Rechazar</button>
          </> : <button type="button" className="rivals-quiet" disabled={busy} onClick={()=>void act({action:'cancel',invitationId:i.id})}>Cancelar</button>}
        </div>
      </div>)}
    </div>}
    {data && data.rivals.length>5 && <label className="rivals-search">Buscar rival<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Su nombre" maxLength={32}/></label>}
    {data && !data.rivals.length && <div className="rivals-empty">{data.hidden.length?'Has ocultado a todos tus rivales. Puedes recuperarlos abajo.':'Tu primera partida es el comienzo. Aquí encontrarás a tus rivales cuando juguéis.'}</div>}
    {!!data?.rivals.length && <ul className="rivals-list">
      {filtered?.map(r=>{
        const active=data.invitations.some(i=>i.rivalId===r.id);
        return <li key={r.id}>
          <span className="rivals-marble" aria-hidden="true"/>
          <div className="rivals-person"><strong>{r.name}</strong><small>{r.games} {r.games===1?'partida':'partidas'} · {r.wins} {r.wins===1?'victoria':'victorias'}</small><time dateTime={r.lastPlayed}>Última vez: {date(r.lastPlayed)}</time></div>
          <div className="rivals-actions"><button type="button" className="rivals-primary" disabled={busy||active} onClick={()=>void act({action:'invite',rivalId:r.id,numRows})} aria-label={`Invitar a ${r.name}`}>{active?'Pendiente':'Invitar'}</button>
            <button type="button" className="rivals-quiet" disabled={busy} onClick={()=>void act({action:'hide',rivalId:r.id})} aria-label={`Quitar a ${r.name} de mi lista`}>Quitar</button></div>
        </li>;
      })}
    </ul>}
    {data && !!data.rivals.length && !filtered?.length && <p className="rivals-empty">No hay rivales con ese nombre.</p>}
    {!!data?.hidden.length && <details className="rivals-hidden"><summary>Rivales ocultos ({data.hidden.length})</summary><p>Quitarlos no borra cuentas ni partidas. Recupera a quien quieras volver a invitar.</p>
      <ul>{data.hidden.map(r=><li key={r.id}><strong>{r.name}</strong><button type="button" className="rivals-quiet" disabled={busy} onClick={()=>void act({action:'restore',rivalId:r.id})} aria-label={`Recuperar a ${r.name}`}>Recuperar</button></li>)}</ul>
    </details>}
    {!!data?.rivals.length && <p className="rivals-footnote">Las invitaciones usan las {numRows} filas elegidas arriba. Solo se crea la partida cuando tu rival acepta.</p>}
  </section>;
}

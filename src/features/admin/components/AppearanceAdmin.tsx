'use client';
import { BackgroundLibrary } from './BackgroundLibrary';
import type { BackgroundAsset } from '@/features/appearance/events/backgrounds';
import { useEffect, useState } from 'react';
import type { ManagedEvent } from '@/features/appearance/events/calendar';
import { SCENERIES, type SceneryId } from '@/features/appearance/sceneries';
import { WORLD_OPTIONS } from '@/features/appearance/worlds';
import { ParallaxWorld } from '@/features/appearance/ParallaxWorld';
type User = {id:string;alias:string};
const fresh = ():ManagedEvent=>({id:`event-${crypto.randomUUID()}`,title:'Nueva celebración',area:'',world:'birthday',effect:'confetti',enabled:true,recurrence:'annual',start:'01-01',end:'01-01',priority:30,source:''});
export function AppearanceAdmin({users}:{users:User[]}):React.ReactElement {
  const [backgrounds,setBackgrounds]=useState<BackgroundAsset[]>([]);
  const [events,setEvents]=useState<ManagedEvent[]>([]);
  const [draft,setDraft]=useState<ManagedEvent|null>(null);
  const [search,setSearch]=useState('');
  const [target,setTarget]=useState('');
  const [mode,setMode]=useState<'calendar'|'personal'>('calendar');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const load=async()=>{
    try{const response=await fetch('/api/admin/appearance',{cache:'no-store'});const data=await response.json();
      if(!response.ok)throw new Error(data.error);setEvents(data.events);setLoaded(true);
    }catch(e){setStatus(e instanceof Error?e.message:'No se pudo cargar el calendario');}
  };
  useEffect(()=>{void load();},[]);
  const send=async(body:unknown)=>{
    setBusy(true);setStatus('');
    try{const response=await fetch('/api/admin/appearance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error);
      setStatus('Cambios guardados.');await load();window.dispatchEvent(new Event('canicas-events-updated'));
    }catch(e){setStatus(e instanceof Error?e.message:'No se pudo guardar');}finally{setBusy(false);}
  };
  const patch=(value:Partial<ManagedEvent>)=>setDraft(d=>d?{...d,...value}:d);
  const chooseUser=async(id:string)=>{
    setTarget(id);if(!id)return;
    setBusy(true);
    try{const response=await fetch(`/api/admin/appearance?playerId=${encodeURIComponent(id)}`,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error);
      setDraft(data.scene?{...data.scene,area:'',source:''}:{...fresh(),title:`Un día especial para ${users.find(u=>u.id===id)?.alias??''}`,recurrence:'always'});
    }catch(e){setStatus(e instanceof Error?e.message:'No se pudo cargar');}finally{setBusy(false);}
  };
  return <section className="occasion-admin" aria-labelledby="occasion-admin-title">
    <header><div><span className="occasion-eyebrow">El calendario del club</span><h3 id="occasion-admin-title">Cada día puede ser especial.</h3><p>Fiestas de tu ciudad, cumpleaños y pequeños regalos para cada persona.</p></div><button type="button" disabled={busy} onClick={()=>void load()}>Actualizar</button></header>
    <div className="occasion-tabs" role="group" aria-label="Gestionar celebraciones">
      <button type="button" aria-pressed={mode==='calendar'} onClick={()=>{setMode('calendar');setDraft(null);}}>Calendario · {events.length}</button>
      <button type="button" aria-pressed={mode==='personal'} onClick={()=>{setMode('personal');setDraft(null);setTarget('');}}>Para una persona</button>
    </div>
    <p role="status" className="occasion-status">{status}</p>
    {loaded && <>
      <BackgroundLibrary onAssets={setBackgrounds}/>
      {mode==='calendar'?<div className="occasion-catalog">
        <div className="occasion-toolbar"><label>Buscar fiesta o localidad<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="San Juan, Pamplona…"/></label><button type="button" onClick={()=>setDraft(fresh())}>+ Nueva fiesta</button></div>
        <div className="occasion-list" role="group" aria-label="Fiestas disponibles">{events.filter(e=>`${e.title} ${e.area}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(event=><button type="button" aria-pressed={draft?.id===event.id} key={event.id} onClick={()=>setDraft(event)}><span>{event.title}<small>{event.area||'Todo el club'} · {event.recurrence==='once'?'Edición con año':event.recurrence==='always'?'Siempre':'Cada año'}</small></span><span className="occasion-dot" data-enabled={event.enabled}/></button>)}</div>
        <p className="occasion-note">Catálogo inicial de fiestas contrastadas, ampliable. Las ediciones con año caducan; consulta su fuente antes de programar la siguiente. Una localidad vacía aplica a todo el club. <a href="https://www.spain.info/es/consulta/fiestas-espana/" target="_blank" rel="noreferrer">Explorar el directorio oficial de fiestas ↗</a></p>
      </div>:<label className="occasion-user">Elige a quién sorprender<select value={target} disabled={busy} onChange={e=>void chooseUser(e.target.value)}><option value="">Seleccionar usuario…</option>{users.map(u=><option key={u.id} value={u.id}>{u.alias}</option>)}</select></label>}
      {draft && <form className="occasion-editor" onSubmit={e=>{e.preventDefault();void send(mode==='calendar'?{action:'save',event:draft}:{action:'assign',playerId:target,event:draft});}}>
        <div className="occasion-landscape"><ParallaxWorld season={draft.world} preview backgroundId={draft.backgroundId} scenery={draft.scenery}/><div><span>{mode==='personal'?'Una sorpresa para ti':'Vista previa del paisaje'}</span><strong>{draft.title}</strong><small>{draft.effect==='fair'?'Farolillos de feria':draft.effect==='fire'?'Luz de hoguera':draft.effect==='floral'?'Pétalos de fiesta':draft.effect==='ribbon'?'Pañuelos y cintas':draft.effect==='confetti'?'Confeti y regalos':'Paisaje tranquilo'}</small></div></div>
        <div className="occasion-fields">
          <label>Nombre o dedicatoria<input required maxLength={80} value={draft.title} onChange={e=>patch({title:e.target.value})}/></label>
          {mode==='calendar'&&<label>Localidad · vacío para todos<input maxLength={80} value={draft.area} onChange={e=>patch({area:e.target.value})}/></label>}
          <label>Paisaje<select value={draft.world} onChange={e=>patch({world:e.target.value as ManagedEvent['world']})}>{WORLD_OPTIONS.map(w=><option key={w.id} value={w.id}>{w.label}</option>)}</select></label>
          <label>Escenario<select value={draft.scenery??''} onChange={e=>patch({scenery:(e.target.value||undefined) as SceneryId|undefined})}><option value="">El propio del ambiente</option>{Object.entries(SCENERIES).map(([id,place])=><option key={id} value={id}>{place.label}</option>)}</select></label>
          <label>Fondo de la biblioteca<select value={draft.backgroundId??''} onChange={e=>patch({backgroundId:e.target.value||undefined})}><option value="">Usar el paisaje elegido</option>{backgrounds.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
          <label>Ambiente<select value={draft.weather??'auto'} onChange={e=>patch({weather:e.target.value as ManagedEvent['weather']})}><option value="auto">Según la estación</option><option value="none">Sin efectos</option><option value="rain">Lluvia suave</option><option value="snow">Nieve</option><option value="fireflies">Luciérnagas</option></select></label>
          <label>Detalles en canicas y dado<select value={draft.effect} onChange={e=>patch({effect:e.target.value as ManagedEvent['effect']})}><option value="none">Los del paisaje</option><option value="confetti">Confeti y regalos</option><option value="floral">Flores y pétalos</option><option value="fire">Hogueras y destellos</option><option value="ribbon">Pañuelos rojos y cintas</option><option value="fair">Farolillos de feria</option></select></label>
          <label>Cuándo<select value={draft.recurrence} onChange={e=>patch({recurrence:e.target.value as ManagedEvent['recurrence'],start:e.target.value==='easter'?'-7':e.target.value==='once'?`${new Date().getFullYear()}-01-01`:'01-01',end:e.target.value==='easter'?'0':e.target.value==='once'?`${new Date().getFullYear()}-01-01`:'01-01'})}><option value="annual">Cada año · cumpleaños o fecha fija</option><option value="easter">Cada año · relativo al Domingo de Pascua</option><option value="once">Solo esta edición · fecha con año</option><option value="always">Siempre, hasta desactivarlo</option></select></label>
          {draft.recurrence!=='always'&&<><label>Desde {draft.recurrence==='annual'?'(MM-DD)':draft.recurrence==='easter'?'(días desde Pascua: -7 a 0)':''}<input required type={draft.recurrence==='once'?'date':'text'} placeholder="06-23" value={draft.start} onChange={e=>patch({start:e.target.value})}/></label><label>Hasta {draft.recurrence==='annual'?'(MM-DD)':draft.recurrence==='easter'?'(días desde Pascua: -7 a 0)':''}<input required type={draft.recurrence==='once'?'date':'text'} placeholder="06-24" value={draft.end} onChange={e=>patch({end:e.target.value})}/></label></>}
          {mode==='calendar'&&<><label>Prioridad · 0–100<input type="number" required min={0} max={100} value={draft.priority} onChange={e=>patch({priority:Number(e.target.value)})}/></label><label>Fuente oficial · opcional<input type="url" value={draft.source} onChange={e=>patch({source:e.target.value})}/></label>{draft.source&&<a href={draft.source} target="_blank" rel="noreferrer">Consultar fuente ↗</a>}</>}
          <label className="occasion-check"><input type="checkbox" checked={draft.enabled} onChange={e=>patch({enabled:e.target.checked})}/> Celebración activada</label>
        </div>
        <p className="occasion-note">El escenario y los detalles del evento se eligen por separado. Una imagen subida sustituye al escenario. Se aplica en modo Automático. El jugador conserva su elección de Normal. Los cumpleaños propios tienen prioridad. Horario de España peninsular.</p>
        <div className="occasion-actions"><button type="submit" disabled={busy||mode==='personal'&&!target}>{busy?'Guardando…':mode==='personal'?'Guardar sorpresa':'Guardar evento'}</button><button type="button" disabled={busy} onClick={()=>{if(mode==='personal')void send({action:'assign',playerId:target,event:null});else void send({action:'delete',id:draft.id});setDraft(null);}}>{mode==='personal'?'Quitar personalización':'Eliminar evento'}</button></div>
      </form>}
    </>}
  </section>;
}

'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from 'react';
import { ancientCharge, ancientFlightPoint, resolveAncientShot, shotPoint, shotWorld, SHOT_RADIUS } from '@/backend/game/domain/AncientShot';
import type { AncientShot, DiceResult, GameState } from '../types';
import { SeasonalDetail } from '@/features/appearance/SeasonalDetail';
import './ancient-shot.css';
import { BoardOverview } from './BoardOverview';
import { BoardZoomControls, type BoardZoom } from './BoardZoomControls';

type Cell={row:number;col:number};
type Props={game:GameState;enabled:boolean;replay?:DiceResult|null;onLaunch:(shot:AncientShot)=>Promise<DiceResult|null>};
type Hold={pointer:number;cell:Cell;at:number;x:number;y:number;board:boolean;dragged:boolean};

export function AncientShotBoard({game,enabled,replay,onLaunch}:Props):React.ReactElement {
  const viewport=useRef<HTMLDivElement>(null),worldRef=useRef<HTMLDivElement>(null),projectile=useRef<HTMLSpanElement>(null);
  const active=useRef<Hold|null>(null),frame=useRef<number|null>(null),locked=useRef(false),mounted=useRef(true);
  const [zoom,setZoom]=useState<BoardZoom>(game.numRows>24&&!replay?'fit':1);
  const zoomAnchor=useRef<{x:number;y:number}|null>(replay?.shot?shotPoint(game.numRows,replay.shot.row,replay.shot.col):null);
  const overview=zoom==='fit';
  const [box,setBox]=useState({width:340,height:360});
  const [scroll,setScroll]=useState({left:0,top:0});
  const scrollFrame=useRef<number|null>(null);
  const [source,setSource]=useState<Cell|null>(null),[aim,setAim]=useState({dx:0,dy:-1});
  const [charging,setCharging]=useState(false),[power,setPower]=useState(.05),[sending,setSending]=useState(false),[error,setError]=useState('');
  const aimRef=useRef(aim),aimFrame=useRef<number|null>(null);
  const marker=useId().replace(/:/g,'');
  const world=shotWorld(game.numRows);
  const baseScale=game.numRows>9?44:Math.min(66,Math.max(36,box.width/world.width),Math.max(40,box.height/world.height));
  const scale=baseScale*(typeof zoom==='number'?zoom:1);
  function changeZoom(next:BoardZoom,anchor?:{x:number;y:number}):void {
    cancel();
    zoomAnchor.current=anchor??(overview?{x:world.width/2,y:world.height/2}:{x:(scroll.left+box.width/2)/scale,y:(scroll.top+box.height/2)/scale});
    setZoom(next);
  }
  useEffect(()=>{
    const board=viewport.current;if(!board)return;
    if(overview)board.scrollTo({top:0,left:0});
    else if(game.numRows>9){
      const anchor=zoomAnchor.current;
      board.scrollLeft=anchor?anchor.x*scale-board.clientWidth/2:Math.max(0,(world.width*scale-board.clientWidth)/2);
      if(anchor)board.scrollTop=anchor.y*scale-board.clientHeight/2;
      zoomAnchor.current=null;
    }
    const read=()=>{
      if(scrollFrame.current!==null)return;
      scrollFrame.current=requestAnimationFrame(()=>{scrollFrame.current=null;setScroll({left:board.scrollLeft,top:board.scrollTop});});
    };
    read();board.addEventListener('scroll',read,{passive:true});
    return()=>{board.removeEventListener('scroll',read);if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);scrollFrame.current=null;};
  },[game.numRows,scale,world.width,overview]);
  const disabled=!enabled||sending||!!replay;
  const replayShot=replay?.shot,chosen=replayShot??source;
  const origin=chosen?shotPoint(game.numRows,chosen.row,chosen.col):null;
  const aimLength=Math.hypot(aim.dx,aim.dy),ux=aim.dx/Math.max(.001,aimLength),uy=aim.dy/Math.max(.001,aimLength);
  // A billiards-style guide to the first contact or cushion; no live network messages while aiming.
  let guide=origin?Math.hypot(world.width,world.height):0,wallGuide=guide;
  if(origin) {
    const wallX=ux>1e-8?(world.width-SHOT_RADIUS-origin.x)/ux:ux< -1e-8?(SHOT_RADIUS-origin.x)/ux:Infinity;
    const wallY=uy>1e-8?(world.height-SHOT_RADIUS-origin.y)/uy:uy< -1e-8?(SHOT_RADIUS-origin.y)/uy:Infinity;
    guide=Math.min(guide,wallX,wallY);wallGuide=guide;
    game.rows.forEach((row,r)=>row.forEach((live,c)=>{
      if(!live||(chosen?.row===r&&chosen.col===c))return;
      const p=shotPoint(game.numRows,r,c),rx=p.x-origin.x,ry=p.y-origin.y,along=rx*ux+ry*uy,across=rx*uy-ry*ux;
      if(along>0&&Math.abs(across)<=SHOT_RADIUS*2)guide=Math.min(guide,Math.max(0,along-Math.sqrt((SHOT_RADIUS*2)**2-across**2)));
    }));
  }
  // Legacy stored shots still replay correctly after an upgrade.
  let flight=replay?.flight;
  if(!flight&&replayShot) {
    const before=game.rows.map(row=>row.slice());replay?.affected.forEach(c=>{before[c.row][c.col]=1;});
    try{flight=resolveAncientShot(before,replayShot).flight;}catch{/* A malformed old replay does not block the game. */}
  }
  const replayFlight=useRef(flight);replayFlight.current=flight;
  const affected=new Map(replay?.affected.map(c=>[`${c.row}:${c.col}`,flight?.hits.find(h=>h.row===c.row&&h.col===c.col)?.t??0])??[]);
  useEffect(()=>{
    const element=viewport.current;if(!element)return;
    const measure=()=>setBox({width:element.clientWidth,height:element.clientHeight});
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);if(aimFrame.current!==null)cancelAnimationFrame(aimFrame.current);};
  },[]);
  useEffect(()=>{
    function stop(){active.current=null;setCharging(false);if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;}
    stop();window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);
    return ()=>{stop();window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);};
  },[enabled,scale]);
  useEffect(()=>{
    const trace=replayFlight.current,orb=projectile.current;
    if(!replay||!trace||!orb)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduced){orb.style.opacity='0';return;}
    const start=performance.now();let raf=0;
    function tick(now:number){
      const t=Math.min(trace!.duration,(now-start)/1000),p=ancientFlightPoint(trace!,t);
      orb!.style.transform=`translate(${p.x*scale}px,${p.y*scale}px) translate(-50%,-50%) rotate(${t*240}deg)`;
      orb!.style.opacity=t>=trace!.duration?'0':'1';
      if(t<trace!.duration)raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(raf);
  },[replay,scale]);

  function cancel():void {
    active.current=null;setCharging(false);setPower(.05);
    if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;
  }
  function choose(cell:Cell):void {
    if(disabled)return;cancel();setSource(cell);setAim({dx:0,dy:-1});aimRef.current={dx:0,dy:-1};setError('');
  }
  function direction(clientX:number,clientY:number,cell:Cell):void {
    const rect=worldRef.current?.getBoundingClientRect();if(!rect)return;
    const p=shotPoint(game.numRows,cell.row,cell.col);
    const vector={dx:(clientX-rect.left)/scale-p.x,dy:(clientY-rect.top)/scale-p.y};
    if(Math.hypot(vector.dx,vector.dy)<.35)return;
    aimRef.current=vector;
    if(aimFrame.current===null)aimFrame.current=requestAnimationFrame(()=>{aimFrame.current=null;if(mounted.current)setAim(aimRef.current);});
  }
  function begin(cell:Cell,pointer:number,x:number,y:number,board:boolean):void {
    if(disabled||active.current)return;
    if(source?.row!==cell.row||source.col!==cell.col){setAim({dx:0,dy:-1});aimRef.current={dx:0,dy:-1};}
    setSource(cell);setError('');setCharging(true);setPower(.05);
    active.current={pointer,cell,at:performance.now(),x,y,board,dragged:false};
    let last=0;
    function tick(now:number){
      if(!active.current)return;
      // React updates only the local held gesture, at most 30 times/second.
      if(now-last>=32){setPower(ancientCharge(now-active.current.at));last=now;}
      frame.current=requestAnimationFrame(tick);
    }
    frame.current=requestAnimationFrame(tick);
  }
  function start(event:PointerEvent<HTMLElement>,cell:Cell,board=true):void {
    if(disabled||!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();event.stopPropagation();
    begin(cell,event.pointerId,event.clientX,event.clientY,board);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event:PointerEvent<HTMLDivElement>):void {
    if(disabled)return;
    const hold=active.current;
    if(hold&&hold.pointer===event.pointerId&&hold.board) {
      if(Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>8)hold.dragged=true;
      if(hold.dragged)direction(event.clientX,event.clientY,hold.cell);
    } else if(!hold&&source&&event.pointerType==='mouse'&&event.buttons===0)direction(event.clientX,event.clientY,source);
  }
  async function launch(cell:Cell,vector:{dx:number;dy:number},strength:number):Promise<void> {
    if(disabled||locked.current)return;
    locked.current=true;setSending(true);setError('');
    const length=Math.hypot(vector.dx,vector.dy);
    try {
      const result=await onLaunch({...cell,dx:vector.dx/length,dy:vector.dy/length,power:strength});
      if(!result&&mounted.current)setError('No se ha confirmado. Comprueba la conexión antes de volver a lanzar.');
    } catch {if(mounted.current)setError('La tirada no se ha confirmado. Puedes reintentar cuando vuelva la conexión.');}
    finally {locked.current=false;if(mounted.current)setSending(false);}
  }
  function finish():void {
    const hold=active.current;if(!hold)return;
    const elapsed=performance.now()-hold.at,strength=ancientCharge(elapsed),vector=aimRef.current;
    cancel();setPower(strength);
    // A tap only selects. A deliberate hold (or an actual drag) fires once on release.
    if(elapsed<220&&!hold.dragged)return;
    void launch(hold.cell,vector,strength);
  }
  function release(event:PointerEvent<HTMLElement>):void {
    const hold=active.current;if(!hold||hold.pointer!==event.pointerId)return;
    if(hold.board&&Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>8)direction(event.clientX,event.clientY,hold.cell);
    finish();
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyDown(event:KeyboardEvent<HTMLButtonElement>):void {
    if(event.key==='Escape'){event.preventDefault();cancel();return;}
    if((event.key===' '||event.key==='Enter')&&source&&!event.repeat){event.preventDefault();begin(source,-1,0,0,false);}
  }
  const angle=Math.round(Math.atan2(aim.dy,aim.dx)*180/Math.PI);
  return <div className={`ancient-shot ${replay?'is-replay':''} ${charging?'is-charging':''}`} aria-label={replay?'Animación de Tirada antigua':'Tirada antigua manual'}>
    {game.numRows>9&&<div className="large-board-nav ancient-zoom-nav"><span>Vista de la mesa</span><BoardZoomControls zoom={zoom} onChange={changeZoom}/></div>}
    {!overview&&(world.height*scale>box.height+1||world.width*scale>box.width+1)&&<span className="ancient-scroll-note">Desliza por el fondo para ver la mesa ↕</span>}
    <div className="ancient-board" ref={viewport}>
      {overview?<BoardOverview game={game} width={box.width} height={box.height} world={world} point={(row,col)=>shotPoint(game.numRows,row,col)} onFocus={point=>changeZoom(1,point)}/>:<div className="ancient-world" ref={worldRef} role="group" aria-label="Mesa de Tirada antigua"
        style={{width:world.width*scale,height:world.height*scale}}
        onPointerDown={event=>{if(source&&event.pointerType==='mouse'){direction(event.clientX,event.clientY,source);start(event,source);}}}
        onPointerMove={move} onPointerUp={release} onPointerCancel={cancel}
        onLostPointerCapture={()=>{if(active.current)cancel();}}>
        {game.rows.map((row,r)=>row.map((live,c)=>{
          const p=shotPoint(game.numRows,r,c);
          if(game.numRows>24 && (p.x*scale<scroll.left-88 || p.x*scale>scroll.left+box.width+88 || p.y*scale<scroll.top-88 || p.y*scale>scroll.top+box.height+88))return null;
          const hit=affected.has(`${r}:${c}`),selected=chosen?.row===r&&chosen.col===c;
          const style={left:p.x*scale,top:p.y*scale,width:Math.max(44,scale*.96),height:Math.max(44,scale*.96),'--orb-size':`${scale*SHOT_RADIUS*2}px`,'--hit-delay':`${(affected.get(`${r}:${c}`)??0)*1000}ms`} as CSSProperties;
          if(!live&&!hit)return <span key={`${r}:${c}`} className="ancient-hole" style={style} aria-hidden="true">×</span>;
          if(replayShot&&selected)return null;
          return <button key={`${r}:${c}`} type="button" style={style} className={`ancient-target ${selected?'is-chosen':''} ${hit?'is-hit':''}`}
            disabled={disabled} aria-label={`Elegir canica fila ${r+1}, posición ${c+1}`} aria-pressed={selected}
            onPointerDown={event=>start(event,{row:r,col:c})}
            onClick={event=>{if(event.detail===0)choose({row:r,col:c});}}
            onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();cancel();setSource(null);}}}>
            <span className="ancient-orb" aria-hidden="true"><SeasonalDetail variant={r+c}/></span>
          </button>;
        }))}
        {origin&&!replay&&<svg className="ancient-aim" viewBox={`0 0 ${world.width} ${world.height}`} aria-hidden="true">
          <defs><marker id={marker} markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0 0 3 2 0 4" fill="none" stroke="currentColor" strokeWidth=".7"/></marker></defs>
          <line className="ancient-aim-extension" x1={origin.x} y1={origin.y} x2={origin.x+ux*wallGuide} y2={origin.y+uy*wallGuide}/>
          <line className="ancient-aim-shadow" x1={origin.x} y1={origin.y} x2={origin.x+ux*guide} y2={origin.y+uy*guide}/>
          <line x1={origin.x} y1={origin.y} x2={origin.x+ux*guide} y2={origin.y+uy*guide} markerEnd={`url(#${marker})`}/>
          <circle cx={origin.x+ux*guide} cy={origin.y+uy*guide} r={SHOT_RADIUS}/>
        </svg>}
        {replayShot&&flight&&<span ref={projectile} className="ancient-projectile" aria-hidden="true" style={{width:scale*SHOT_RADIUS*2,height:scale*SHOT_RADIUS*2}}><span className="ancient-orb"><SeasonalDetail variant={replayShot.row+replayShot.col}/></span></span>}
      </div>}
    </div>
    <div className="ancient-instructions" aria-hidden={!!replay} style={{visibility:replay?"hidden":undefined}}>
      <p role="status">{sending?'Confirmando el lanzamiento…':!enabled?(game.currentTurn===game.yourPlayerNumber?'Esperando conexión para lanzar.':'Tu rival prepara su lanzamiento.'):charging?'Suelta en el momento justo para lanzar.':source?'Apunta con la línea. Mantén pulsado para cargar.':'Elige una canica. Mantén y arrastra para apuntar.'}</p>
      <div className="ancient-controls" aria-hidden={!source||!enabled} style={{visibility:source&&enabled&&!replay?"visible":"hidden"}}>
        <div className="ancient-power" role="meter" aria-label="Fuerza del lanzamiento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power*100)}>
          <div className="ancient-power-caption"><span>FUERZA <strong>{Math.round(power*100)} %</strong></span><span>{charging?'RITMO VARIABLE':'MANTÉN · SUELTA'}</span></div>
          <div className="ancient-power-track"><span style={{transform:`scaleX(${power})`}}/><i/></div>
        </div>
        <div className="ancient-precision">
          <details><summary>Ajustar dirección · {angle}°</summary><div className="ancient-sliders"><label>Dirección<input type="range" aria-label="Dirección de Tirada antigua" min="-180" max="180" step="1" value={angle} disabled={disabled||charging} onChange={event=>{const a=Number(event.target.value)*Math.PI/180;const v={dx:Math.cos(a),dy:Math.sin(a)};aimRef.current=v;setAim(v);}}/></label></div></details>
          <button className="pocket-primary ancient-charge-button" type="button" disabled={disabled||!source} aria-label="Mantener para cargar y soltar para lanzar"
            onPointerDown={event=>{if(source)start(event,source,false);}} onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={()=>{if(active.current)cancel();}}
            onKeyDown={keyDown} onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();finish();}}} onBlur={cancel}>
            {charging?'Soltar para lanzar ↗':'Mantén para cargar ↗'}
          </button>
        </div>
      </div>
      {error&&<p role="alert">{error}</p>}
    </div>
  </div>;
}

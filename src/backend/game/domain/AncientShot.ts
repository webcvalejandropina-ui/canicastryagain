import { AppError } from '@/backend/shared/domain/AppError';

export type AncientShot = { row:number; col:number; dx:number; dy:number; power?:number };
export type AncientFlight = {
  duration:number;
  points:Array<{x:number;y:number;t:number;speed:number}>;
  hits:Array<{row:number;col:number;t:number}>;
};
export const SHOT_ROW_STEP = 1.1;
export const SHOT_RADIUS = .31;
export const shotPoint = (numRows:number,row:number,col:number) => ({x:col+(numRows-1-row)/2+1,y:1+row*SHOT_ROW_STEP});
export const shotWorld = (numRows:number) => ({width:numRows+1,height:(numRows-1)*SHOT_ROW_STEP+2});
const FRICTION=4.5;
const HIT_RETENTION=.77;
const WALL_RETENTION=.68;

/** Changes pace on each rise/fall. Only runs locally while a pointer/key is held. */
export function ancientCharge(elapsedMs:number):number {
  const phases=[1350,650,1050,480,1550,820];
  const cycle=phases.reduce((a,b)=>a+b,0);
  let t=Math.max(0,elapsedMs)%cycle;
  for(let i=0;i<phases.length;i++) {
    if(t<=phases[i]) {
      const eased=(1-Math.cos(Math.PI*t/phases[i]))/2;
      return .05+.95*(i%2===0?eased:1-eased);
    }
    t-=phases[i];
  }
  return .05;
}

/** Event-based swept-circle physics: no server game loop or per-frame network traffic. */
export function resolveAncientShot(rows:number[][], input:AncientShot): {shot:AncientShot;flight:AncientFlight;affected:Array<{row:number;col:number}>} {
  const {row,col,dx,dy}=input;
  const length=Math.hypot(dx,dy),world=shotWorld(rows.length);
  if(!Number.isInteger(row)||!Number.isInteger(col)||rows[row]?.[col]!==1 ||
    !Number.isFinite(length)||length<.35 ||
    (input.power!==undefined&&(!Number.isFinite(input.power)||input.power<.05||input.power>1))) {
    throw new AppError('Elige una canica viva, apunta y mantén pulsado para cargar antes de soltar.',400,'INVALID_ANCIENT_SHOT');
  }
  // Old clients can still send a gesture length. Never trust client-supplied hits or paths.
  const power=input.power??Math.max(.05,Math.min(1,length/Math.hypot(world.width,world.height)));
  let ux=dx/length,uy=dy/length;
  const origin=shotPoint(rows.length,row,col);
  let {x,y}=origin,time=0,speed=2+12*power;
  const affected=[{row,col}],removed=new Set([`${row}:${col}`]);
  const points=[{x,y,t:0,speed}],hits=[{row,col,t:0}];
  const targets:Array<{row:number;col:number;x:number;y:number}>=[];
  rows.forEach((cells,r)=>cells.forEach((live,c)=>{if(live&&!(r===row&&c===col))targets.push({row:r,col:c,...shotPoint(rows.length,r,c)});}));
  // A small, bounded event trace is sufficient for exact client replay.
  for(let event=0;event<64&&speed>.12;event++) {
    const stopping=speed*speed/(2*FRICTION);
    let distance=stopping,kind:'stop'|'wall-x'|'wall-y'|'hit'='stop';
    let target:typeof targets[number]|undefined;
    const wallX=ux>1e-8?(world.width-SHOT_RADIUS-x)/ux:ux< -1e-8?(SHOT_RADIUS-x)/ux:Infinity;
    const wallY=uy>1e-8?(world.height-SHOT_RADIUS-y)/uy:uy< -1e-8?(SHOT_RADIUS-y)/uy:Infinity;
    if(wallX>=0&&wallX<distance){distance=wallX;kind='wall-x';}
    if(wallY>=0&&wallY<distance){distance=wallY;kind='wall-y';}
    for(const cell of targets) {
      if(removed.has(`${cell.row}:${cell.col}`))continue;
      const rx=cell.x-x,ry=cell.y-y,along=rx*ux+ry*uy;
      const perpendicular=rx*uy-ry*ux,radius=SHOT_RADIUS*2;
      if(along<0||Math.abs(perpendicular)>radius)continue;
      const contact=Math.max(0,along-Math.sqrt(Math.max(0,radius*radius-perpendicular*perpendicular)));
      if(contact<distance){distance=contact;kind='hit';target=cell;}
    }
    const incoming=Math.sqrt(Math.max(0,speed*speed-2*FRICTION*distance));
    time+=(speed-incoming)/FRICTION;
    x+=ux*distance;y+=uy*distance;
    // The arrival speed belongs to the previous segment; outgoing speed is recorded below.
    if(kind==='hit'&&target) {
      affected.push({row:target.row,col:target.col});removed.add(`${target.row}:${target.col}`);
      hits.push({row:target.row,col:target.col,t:time});
      // Fragile marbles disappear; an off-centre contact bends the remaining impulse slightly.
      const offset=((target.x-x)*uy-(target.y-y)*ux)/(SHOT_RADIUS*2);
      const angle=Math.atan2(uy,ux)+offset*.18;
      ux=Math.cos(angle);uy=Math.sin(angle);speed=incoming*HIT_RETENTION;
    } else if(kind==='wall-x'||kind==='wall-y') {
      if(kind==='wall-x')ux=-ux;else uy=-uy;
      speed=incoming*WALL_RETENTION;
    } else speed=0;
    points.push({x,y,t:time,speed});
    if(kind==='stop')break;
  }
  // Extremely crowded/large boards also end deterministically at the event budget.
  points[points.length-1].speed=0;
  const flight={duration:Math.max(.18,time),points,hits};
  return {shot:{row,col,dx:dx/length,dy:dy/length,power},flight,affected};
}

/** Analytic friction interpolation between collision events; identical on PC and mobile. */
export function ancientFlightPoint(flight:AncientFlight,t:number):{x:number;y:number} {
  const points=flight.points;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i];
    if(t>b.t)continue;
    const dt=Math.max(0,Math.min(t-a.t,b.t-a.t)),distance=Math.hypot(b.x-a.x,b.y-a.y);
    const travelled=Math.max(0,a.speed*dt-FRICTION*dt*dt/2);
    const ratio=distance>1e-8?Math.min(1,travelled/distance):1;
    return {x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio};
  }
  return points[points.length-1];
}

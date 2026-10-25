import assert from 'node:assert/strict';
import { Game } from '../src/backend/game/domain/Game';
import { resolveAncientShot, ancientCharge, ancientFlightPoint, shotWorld, SHOT_RADIUS } from '../src/backend/game/domain/AncientShot';
function create(){const g=Game.create({id:'shot',code:'SHOT00',numRows:7,creator:{id:'a',name:'A'}});g.join({id:'b',name:'B'});return g;}
function unlock(g:Game){const random=Math.random;try{Math.random=()=>.99;return g.useDice('a');}finally{Math.random=random;}}
const game=create();const initial=game.toPrimitives();
assert.equal(unlock(game).dice.power,'antigua');
let state=game.toPrimitives();assert.equal(state.pendingAncientShot,true);assert.equal(game.hasDiceAvailable(1),false);
assert.equal(state.currentTurn,1);assert.equal(state.moveHistory.length,0);assert.deepEqual(state.rows,initial.rows);
assert.throws(()=>game.makeMove({playerId:'a',rowIndex:6,startIndex:0,removeCount:1}));
assert.throws(()=>game.launchAncientShot('b',{row:6,col:0,dx:6,dy:0}));
assert.throws(()=>game.useDice('a'));
assert.throws(()=>game.launchAncientShot('a',{row:6,col:0,dx:NaN,dy:0}));
assert.throws(()=>game.launchAncientShot('a',{row:6,col:0,dx:0,dy:0}));
assert.equal(game.toPrimitives().pendingAncientShot,true,'Invalid releases preserve pending shot');
const restored=Game.rehydrate(JSON.parse(JSON.stringify(game.toPrimitives())));
const result=restored.launchAncientShot('a',{row:6,col:0,dx:6,dy:0});
assert.equal(result.dice.power,'antigua');assert.ok(result.dice.affected.length>1);
assert.ok(result.dice.flight?.duration);
state=restored.toPrimitives();assert.equal(state.pendingAncientShot,false);assert.equal(state.currentTurn,2);assert.equal(state.moveHistory.length,1);
assert.equal(state.rows[6].filter(Boolean).length,7-result.dice.affected.length);assert.equal(state.rows[5].filter(Boolean).length,6);
assert.throws(()=>restored.launchAncientShot('a',{row:5,col:0,dx:5,dy:0}));
const sweep=resolveAncientShot(initial.rows,{row:6,col:0,dx:3,dy:-6.6,power:1});
assert.ok(sweep.affected.length>1,'Swept collision detects intervening marbles');
const noHit=resolveAncientShot(initial.rows,{row:0,col:0,dx:0,dy:-2,power:.05});assert.deepEqual(noHit.affected,[{row:0,col:0}]);
const weak=resolveAncientShot(initial.rows,{row:6,col:0,dx:1,dy:0,power:.05});
const strong=resolveAncientShot(initial.rows,{row:6,col:0,dx:1,dy:0,power:1});
assert.ok(strong.affected.length>weak.affected.length,'Higher charge reaches more targets');
assert.ok(strong.affected.length<7,'Repeated impacts consume impulse before clearing a dense row');
assert.deepEqual(strong,resolveAncientShot(initial.rows,{row:6,col:0,dx:1,dy:0,power:1}),'Replay is deterministic');
const world=shotWorld(7);
for(const trace of [weak.flight,strong.flight,sweep.flight]) {
 assert.ok(trace.duration>0&&trace.duration<4);
 assert.ok(trace.points.length<=65);
 assert.equal(trace.points.at(-1)?.speed,0);
 for(let i=1;i<trace.points.length;i++)assert.ok(trace.points[i].t>=trace.points[i-1].t);
 for(let t=0;t<trace.duration;t+=.007) {
  const p=ancientFlightPoint(trace,t);
  assert.ok(p.x>=SHOT_RADIUS-1e-6&&p.x<=world.width-SHOT_RADIUS+1e-6);
  assert.ok(p.y>=SHOT_RADIUS-1e-6&&p.y<=world.height-SHOT_RADIUS+1e-6);
 }
}
assert.throws(()=>resolveAncientShot(initial.rows,{row:6,col:0,dx:1,dy:0,power:NaN}));
assert.throws(()=>resolveAncientShot(initial.rows,{row:6,col:0,dx:1,dy:0,power:1.1}));
const rates=[300,800,1500,1800,2400].map(t=>(ancientCharge(t+50)-ancientCharge(t))/50);
assert.ok(new Set(rates.map(v=>v.toFixed(4))).size>3,'Charge pace changes while held');
for(let t=0;t<20000;t+=31)assert.ok(ancientCharge(t)>=.05&&ancientCharge(t)<=1);
const holes=initial.rows.map(r=>r.map(()=>0));holes[6][0]=1;holes[6][6]=1;
assert.equal(resolveAncientShot(holes,{row:6,col:0,dx:6,dy:0,power:1}).affected.length,2);
assert.throws(()=>resolveAncientShot(holes,{row:2,col:0,dx:1,dy:0}));
assert.throws(()=>resolveAncientShot(holes,{row:6.1,col:0,dx:1,dy:0}));
const empty=initial.rows.map(r=>r.map(()=>0));empty[0][0]=1;
const cushion=resolveAncientShot(empty,{row:0,col:0,dx:0,dy:-1,power:1});
assert.ok(cushion.flight.points.some(p=>Math.abs(p.y-SHOT_RADIUS)<1e-6),'High charge reaches the cushion');
assert.ok(cushion.flight.points.length>=3,'The projectile rebounds before stopping');
assert.deepEqual(cushion.affected,[{row:0,col:0}]);
const offCentre=resolveAncientShot(initial.rows,{row:6,col:0,dx:1,dy:.08,power:1});
const [p0,p1,p2]=offCentre.flight.points;
assert.ok(Math.abs((p1.x-p0.x)*(p2.y-p1.y)-(p1.y-p0.y)*(p2.x-p1.x))>1e-5,'Off-centre impact bends the remaining impulse');
assert.deepEqual(initial.rows,create().toPrimitives().rows,'Resolving a flight does not mutate input rows');
const last=Game.rehydrate({...initial,rows:holes.map((r,index)=>r.map((_,c)=>index===6&&c===0?1:0))});unlock(last);
const ended=last.launchAncientShot('a',{row:6,col:0,dx:0,dy:2});assert.equal(ended.gameOver,true);assert.equal(ended.winner,2);
assert.equal(last.toPrimitives().pendingAncientShot,false);
const abandoned=create();unlock(abandoned);abandoned.leave('a');assert.equal(abandoned.toPrimitives().pendingAncientShot,false);
console.log('Ancient shot: pending turn, one use, permissions, restore, swept collisions, holes, invalid gestures and misère OK');

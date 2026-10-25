import assert from 'node:assert/strict';
import {Game} from '../src/backend/game/domain/Game';
import {DICE_POWER_NAMES,targetPowerCells,type DicePowerName,type TargetPower} from '../src/backend/game/domain/DicePowers';
import {rowsAtMove} from '../src/features/game/lib/replay';
import {buildCellOwnerMap} from '../src/features/game/lib/cellOwners';
import {playDemoAncientShot} from '../src/features/demo/demoEngine';
const create=()=>{const g=Game.create({id:'powers',code:'POWERS',numRows:7,creator:{id:'a',name:'A'}});g.join({id:'b',name:'B'});return g;};
const draw=(power:DicePowerName)=>(DICE_POWER_NAMES.indexOf(power)+.5)/DICE_POWER_NAMES.length;
const count=(rows:number[][])=>rows.flat().filter(Boolean).length;
function position(rows:number[][],actor:1|2=1){return Game.rehydrate({...create().toPrimitives(),numRows:rows.length,rows:structuredClone(rows),currentTurn:actor});}
function unlock(g:Game,power:TargetPower,actor='a'){
 const before=g.toPrimitives();const result=g.useDice(actor,()=>draw(power));
 assert.equal(result.dice.pending,true);assert.equal(g.toPrimitives().pendingTargetPower,power);
 assert.equal(g.toPrimitives().currentTurn,before.currentTurn);assert.deepEqual(g.toPrimitives().rows,before.rows);
 assert.equal(g.toPrimitives().moveHistory.length,before.moveHistory.length);
 assert.equal(g.hasDiceAvailable(before.currentTurn),false);
}
// Exhaustive boards with three rows: every live origin, both target powers.
let cases=0;
for(let mask=1;mask<64;mask++){
 let bit=0;const rows=Array.from({length:3},(_,r)=>Array.from({length:r+1},()=>mask>>bit++&1));
 for(let r=0;r<3;r++)for(let c=0;c<=r;c++)if(rows[r][c])for(const power of ['avalancha','fantasma'] as const){
  const g=position(rows);unlock(g,power);
  const expected=new Set([`${r}:${c}`]);
  if(power==='fantasma'){
   const live=rows[r].map((v,i)=>v?i:-1).filter(i=>i>=0),at=live.indexOf(c);
   for(const col of [live[at-1],live[at+1]])if(col!==undefined)expected.add(`${r}:${col}`);
  } else {
   // Independent row-by-row reachability: a hole never carries a falling branch.
   for(let row=r+1;row<3;row++)for(let col=0;col<=row;col++)
    if(rows[row][col]&&(expected.has(`${row-1}:${col}`)||expected.has(`${row-1}:${col-1}`)))expected.add(`${row}:${col}`);
  }
  const result=g.resolveDiceTarget('a',{row:r,col:c});
  assert.deepEqual(new Set(result.dice.affected.map(x=>`${x.row}:${x.col}`)),expected);
  assert.equal(result.dice.affected.length,expected.size,'No duplicate hits at merged branches');
  assert.equal(count(g.toPrimitives().rows),count(rows)-expected.size);
  assert.equal(result.gameOver,count(g.toPrimitives().rows)===0);
  if(result.gameOver)assert.equal(result.winner,2);
  assert.equal(g.toPrimitives().moveHistory.length,1);assert.equal(g.toPrimitives().pendingTargetPower,null);
  cases++;
 }
}
for(const power of ['avalancha','fantasma'] as const){
 for(const actor of [1,2] as const){
  const rows=[[0],[0,0],[0,1,0]],id=actor===1?'a':'b',g=position(rows,actor);unlock(g,power,id);
  assert.throws(()=>g.resolveDiceTarget(actor===1?'b':'a',{row:2,col:1}));
  assert.throws(()=>g.resolveDiceTarget('intruder',{row:2,col:1}));
  for(const target of [{row:-1,col:0},{row:2,col:0},{row:99,col:0},{row:2.5,col:1}])assert.throws(()=>g.resolveDiceTarget(id,target));
  assert.throws(()=>g.makeMove({playerId:id,rowIndex:2,startIndex:1,removeCount:1}));
  assert.throws(()=>g.useDice(id));assert.throws(()=>g.launchAncientShot(id,{row:2,col:1,dx:1,dy:0}));
  const restored=Game.rehydrate(JSON.parse(JSON.stringify(g.toPrimitives())));const result=restored.resolveDiceTarget(id,{row:2,col:1});
  assert.equal(result.winner,actor===1?2:1);assert.throws(()=>restored.resolveDiceTarget(id,{row:2,col:1}));
 }
 const g=create();unlock(g,power);g.leave('a');assert.equal(g.toPrimitives().pendingTargetPower,null);
}
// A reproducible RNG exercises shuffles, revivals, both players and all eight powers.
let seed=83721;const original=Math.random;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
try {
 for(let trial=0;trial<200;trial++){
  const rows=Array.from({length:7},(_,r)=>Array.from({length:r+1},()=>Math.random()<.5?1:0));rows[0][0]=1;
  const g=position(rows);const result=g.useDice('a',()=>draw('remolino')),after=g.toPrimitives().rows;
  rows.forEach((row,r)=>{
   assert.equal(count([after[r]]),count([row]));
   if(row.includes(0)&&row.includes(1))assert.notDeepEqual(after[r],row,'A mixed row really changes');
  });
  for(const item of result.dice.shuffledRows??[])assert.deepEqual([...item.order].sort((a,b)=>a-b),rows[item.row].map((_,i)=>i));
  assert.equal(result.gameOver,false);assert.equal(g.toPrimitives().currentTurn,2);assert.equal(g.toPrimitives().moveHistory.length,1);
 }
 for(const rows of [[[1],[1,1],[1,1,1]],[[0],[0,0],[0,1,0]]]){
  const g=position(rows),before=count(rows);g.useDice('a',()=>draw('remolino'));assert.equal(count(g.toPrimitives().rows),before);assert.equal(g.status,'playing');
 }
 for(let trial=0;trial<500;trial++){
  const g=create();let turns=0;
  while(g.status==='playing'&&turns++<150){
   const before=g.toPrimitives(),id=before.currentTurn===1?'a':'b';
   if(g.hasDiceAvailable(before.currentTurn)&&Math.random()<.5){
    const result=g.useDice(id);
    if(result.dice.pending)playDemoAncientShot(g,id);
   } else {
    const candidates=before.rows.flatMap((row,r)=>row.flatMap((v,c)=>v?[{rowIndex:r,startIndex:c,removeCount:1}]:[]));
    g.makeMove({playerId:id,...candidates[Math.floor(Math.random()*candidates.length)]});
   }
   const after=g.toPrimitives();assert.equal(after.moveHistory.length,before.moveHistory.length+1);
   assert.deepEqual(rowsAtMove(7,after.moveHistory,after.moveHistory.length-1),after.rows,'Exact replay after every power and normal move');
   const owners=buildCellOwnerMap(after.moveHistory);
   after.rows.forEach((row,r)=>row.forEach((v,c)=>{if(v)assert.equal(owners.has(`${r}:${c}`),false,'Shuffle never assigns a dead owner to a live marble');}));
  }
  const final=g.toPrimitives();assert.equal(final.status,'finished');assert.equal(count(final.rows),0);
  assert.notEqual(final.winner,final.moveHistory.at(-1)?.player);
 }
}finally{Math.random=original;}
// Each equally sized bucket maps to exactly one power.
assert.equal(new Set(DICE_POWER_NAMES.map(power=>create().useDice('a',()=>draw(power)).dice.power)).size,8);
console.log(`OK: ${cases} exhaustive target cases, both players, invalid/cancelled targets, 200 shuffles and 500 complete games with exact replay/ownership; all 8 powers`);

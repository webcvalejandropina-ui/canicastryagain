import assert from 'node:assert/strict';
const origin=process.env.POWERS_QA_ORIGIN;if(!origin||!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw new Error('Use isolated POWERS_QA_ORIGIN');
for(const power of ['avalancha','fantasma']){
 const id='qa-'+power,path=`${origin}/api/games/${id}`;
 const view=async player=>(await(await fetch(path+'?playerId='+player)).json()).game;
 const send=(action,body)=>fetch(path+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const before=await view('qa-a');assert.equal(before.pendingTargetPower,power);assert.equal(before.moveHistory.length,0);
 assert.equal((await send('move',{playerId:'qa-a',rowIndex:0,startIndex:0,removeCount:1})).status,409);
 assert.equal((await send('dice',{playerId:'qa-b',target:{row:0,col:0}})).status,409);
 assert.equal((await send('dice',{playerId:'outsider',target:{row:0,col:0}})).status,403);
 assert.equal((await send('dice',{playerId:'qa-a',target:{row:2,col:99}})).status,400);
 assert.equal((await send('dice',{playerId:'qa-a',target:{row:0,col:0},shot:{row:0,col:0,dx:1,dy:0}})).status,400);
 const request={playerId:'qa-a',expectedRevision:before.revision,target:power==='avalancha'?{row:4,col:1}:{row:6,col:3}};
 const responses=await Promise.all([send('dice',request),send('dice',request)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const data=await responses.find(r=>r.ok).json();assert.equal(data.dice.power,power);assert.ok(data.dice.affected.length>1);
 const [a,b]=await Promise.all([view('qa-a'),view('qa-b')]);assert.equal(a.pendingTargetPower,null);assert.equal(a.moveHistory.length,1);assert.deepEqual(a.rows,b.rows);assert.deepEqual(a.moveHistory,b.moveHistory);
 assert.equal((await send('dice',request)).status,409);
}
console.log('OK HTTP: both target powers, turn lock, reconnect view, permissions, malformed inputs, concurrent confirmation and identical history for both players');

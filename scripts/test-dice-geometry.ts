import assert from 'node:assert/strict';
import { DICE_POWER_NAMES } from '../src/backend/game/domain/DicePowers';
import { DICE_FACETS,DICE_POWER_FACES,DICE_BEVELS,DICE_RADIUS,DICE_RESULT_TILT,diceResultTransform } from '../src/features/game/lib/diceGeometry';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((sum,x,i)=>sum+x*b[i],0);
assert.equal(DICE_POWER_FACES.length,8);assert.equal(DICE_BEVELS.length,24);
assert.deepEqual(DICE_POWER_FACES.map(f=>f.power),[...DICE_POWER_NAMES]);
const edges=new Map<string,number>(),vertices=new Set<string>();
for(const face of DICE_FACETS) {
  for(const basis of [face.u,face.v,face.normal])near(Math.hypot(...basis),1);
  near(dot(face.u,face.v),0);near(dot(face.u,face.normal),0);near(dot(face.v,face.normal),0);
  assert.ok(dot(face.normal,face.center)>=DICE_RADIUS*.8,"Rounded profile keeps every face near the spherical envelope");
  for(const vertex of face.vertices) {
    near(Math.hypot(...vertex),DICE_RADIUS);
    const [a,b,c,d,tx,ty]=face.textureMatrix;
    const x=a*(vertex[0]+DICE_RADIUS)+c*(vertex[1]+DICE_RADIUS)+tx+face.minX;
    const y=b*(vertex[0]+DICE_RADIUS)+d*(vertex[1]+DICE_RADIUS)+ty+face.minY;
    const reconstructed=face.center.map((value,i)=>value+face.u[i]*x+face.v[i]*y);
    reconstructed.forEach((value,i)=>near(value,vertex[i]));
  }
  for(let i=0;i<face.vertices.length;i++) {
    const a=face.vertices[i],b=face.vertices[(i+1)%face.vertices.length];vertices.add(a.join(','));
    near(dot(face.normal,a),dot(face.normal,face.center));
    const key=[a.join(','),b.join(',')].sort().join('|');edges.set(key,(edges.get(key)??0)+1);
    if(face.power)near(Math.hypot(...a.map((x,j)=>x-b[j])),DICE_RADIUS);
    for(const other of DICE_FACETS)for(const vertex of other.vertices)
      assert.ok(dot(face.normal,vertex)<=dot(face.normal,face.center)+1e-6,'All vertices inside the convex solid');
  }
  if(face.power) {
    const rotation=diceResultTransform(face.power).slice(9,-1).split(',').map(Number);
    const apply=(v:readonly number[])=>[0,1,2].map(row=>dot([rotation[row],rotation[row+4],rotation[row+8]],v));
    const up=[0,-Math.sin(DICE_RESULT_TILT),Math.cos(DICE_RESULT_TILT)];
    apply(face.normal).forEach((x,i)=>near(x,up[i]));
    const projectedCenter=apply(face.center).map((value,i)=>value+rotation[12+i]);
    near(projectedCenter[0],0);near(projectedCenter[1],0);
    const restHeight=dot(face.normal,face.center);
    for(const other of DICE_FACETS)for(const vertex of other.vertices)
      assert.ok(dot(apply(vertex),up)>=-restHeight-1e-6,'Every vertex lies above the flat opposite supporting face');
    const opposite=DICE_POWER_FACES.find(other=>dot(face.normal,other.normal)<-.999999)!;
    assert.ok(opposite,'A parallel opposite power face forms the base');
    for(const vertex of opposite.vertices)near(dot(apply(vertex),up),-restHeight);
    apply(face.u).forEach((x,i)=>near(x,i===0?1:0));
    apply(face.v).forEach((x,i)=>near(x,[0,Math.cos(DICE_RESULT_TILT),Math.sin(DICE_RESULT_TILT)][i]));
  }
}
assert.equal(edges.size,48);assert.equal(vertices.size,18);
for(const count of edges.values())assert.equal(count,2,'Closed mesh without cracks or overlapping facets');
for(const vertex of vertices)assert.ok(vertices.has(vertex.split(',').map(Number).map(x=>-x).join(',')),'Symmetric opposite vertex');
assert.equal(vertices.size-edges.size+DICE_FACETS.length,2);
console.log('Rounded crystal: closed symmetric spherical envelope; 8 equal power triangles; every result rests on a parallel flat base with the winning face upward and its symbol screen-centered; one continuous texture across all shared edges.');

import { DICE_POWER_NAMES, type DicePowerName } from "../../../backend/game/domain/DicePowers";

type Vector = readonly [number, number, number];
export const DICE_RADIUS = 76;
export const DICE_RESULT_TILT = 12 * Math.PI / 180;
const cross = (a: Vector, b: Vector): Vector => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a: Vector, b: Vector): number => a.reduce((sum,x,i)=>sum+x*b[i],0);
const unit = (a: Vector): Vector => a.map(x=>x/Math.hypot(...a)) as unknown as Vector;
const matrix = (u: Vector,v: Vector,n: Vector,c: Vector): string =>
  `matrix3d(${[...u,0,...v,0,...n,0,...c,1].map(x=>Number(x.toFixed(9))).join(",")})`;

function plane(vertices: Vector[],normal: Vector,power?: DicePowerName) {
  const center = vertices[0].map((_,i)=>vertices.reduce((sum,p)=>sum+p[i],0)/vertices.length) as unknown as Vector;
  const u = unit(vertices[1].map((x,i)=>x-vertices[0][i]) as unknown as Vector);
  const v = cross(normal,u);
  const points = vertices.map(p=>{
    const offset=p.map((x,i)=>x-center[i]) as unknown as Vector;
    return [dot(offset,u),dot(offset,v)];
  }).sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
  const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1]));
  const width=Math.max(...points.map(p=>p[0]))-minX,height=Math.max(...points.map(p=>p[1]))-minY;
  // Every facet samples one continuous image in world XY, rather than repeating a marble.
  const det=u[0]*v[1]-v[0]*u[1];
  const textureMatrix=[v[1]/det,-u[1]/det,-v[0]/det,u[0]/det,0,0];
  textureMatrix[4]=textureMatrix[0]*(-DICE_RADIUS-center[0])+textureMatrix[2]*(-DICE_RADIUS-center[1])-minX;
  textureMatrix[5]=textureMatrix[1]*(-DICE_RADIUS-center[0])+textureMatrix[3]*(-DICE_RADIUS-center[1])-minY;
  return {vertices,center,u,v,normal,power,width,height,minX,minY,textureMatrix,
    textureTransform:`matrix(${textureMatrix.join(",")})`,
    transform:matrix(u,v,normal,center),
    clip:`polygon(${points.map(([x,y])=>`${(x-minX)/width*100}% ${(y-minY)/height*100}%`).join(",")})`,
    outline:`M${points.map(p=>p.map(x=>Number(x.toFixed(5))).join(",")).join("L")}Z`,
    viewBox:`${minX} ${minY} ${width} ${height}`};
}

function triangle(vertices: Vector[],power?: DicePowerName) {
  const edge=(i:number)=>vertices[i].map((x,j)=>x-vertices[0][j]) as unknown as Vector;
  let normal=unit(cross(edge(1),edge(2)));
  if(dot(normal,vertices[0])<0) normal=normal.map(x=>-x) as unknown as Vector;
  return plane(vertices,normal,power);
}
const midpoint=(a:Vector,b:Vector):Vector=>unit(a.map((x,i)=>x+b[i]) as unknown as Vector).map(x=>x*DICE_RADIUS) as unknown as Vector;
const sectors=DICE_POWER_NAMES.map((power,index)=>{
  const a:Vector=[index&1?DICE_RADIUS:-DICE_RADIUS,0,0];
  const b:Vector=[0,index&2?DICE_RADIUS:-DICE_RADIUS,0];
  const c:Vector=[0,0,index&4?DICE_RADIUS:-DICE_RADIUS];
  const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
  return {face:triangle([ab,bc,ca],power),bevels:[triangle([a,ab,ca]),triangle([b,bc,ab]),triangle([c,ca,bc])]};
});
/** Eight broad triangular lands; small bevels soften the outline toward a sphere. */
export const DICE_POWER_FACES=sectors.map(sector=>sector.face);
export const DICE_BEVELS=sectors.flatMap(sector=>sector.bevels);
export const DICE_FACETS=[...DICE_BEVELS,...DICE_POWER_FACES];

/** Opposite parallel lands give a flat resting base, with the selected power on top.
 * The whole table is viewed from above so its upper symbol remains readable. */
export function diceResultTransform(power:DicePowerName): string {
  const face=DICE_POWER_FACES.find(candidate=>candidate.power===power)!;
  const tilt=(v:Vector):Vector=>[v[0],Math.cos(DICE_RESULT_TILT)*v[1]-Math.sin(DICE_RESULT_TILT)*v[2],Math.sin(DICE_RESULT_TILT)*v[1]+Math.cos(DICE_RESULT_TILT)*v[2]];
  return matrix(tilt([face.u[0],face.v[0],face.normal[0]]),
    tilt([face.u[1],face.v[1],face.normal[1]]),
    tilt([face.u[2],face.v[2],face.normal[2]]),[0,Math.hypot(...face.center)*Math.sin(DICE_RESULT_TILT),0]);
}

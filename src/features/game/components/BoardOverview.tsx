'use client';

import { useEffect, useRef } from 'react';
import type { GameState } from '../types';

type Point={x:number;y:number};
type Props={game:GameState;width:number;height:number;world:{width:number;height:number};point:(row:number,col:number)=>Point;onFocus:(point:Point)=>void;selection?:{rowIndex:number;startIndex:number;endIndex:number}|null;radius?:number};
/** One small, static canvas replaces thousands of interactive marbles while fitting the table. */
export function BoardOverview({game,width,height,world,point,onFocus,selection,radius=.33}:Props):React.ReactElement {
  const canvas=useRef<HTMLCanvasElement>(null);
  const layout=useRef({scale:1,x:0,y:0});
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    const ratio=Math.min(2,window.devicePixelRatio||1);
    element.width=Math.round(width*ratio);element.height=Math.round(height*ratio);
    const ctx=element.getContext('2d');if(!ctx)return;
    ctx.scale(ratio,ratio);
    const scale=Math.min((width-24)/world.width,(height-44)/world.height);
    const x=(width-world.width*scale)/2,y=(height-24-world.height*scale)/2;
    layout.current={scale,x,y};
    const colors=['#438766','#408ba5','#a58d55','#b6764b'];
    for(let row=0;row<game.rows.length;row++)for(let col=0;col<game.rows[row].length;col++) {
      const p=point(row,col),px=x+p.x*scale,py=y+p.y*scale,r=Math.max(.35,scale*radius);
      const selected=selection?.rowIndex===row&&col>=selection.startIndex&&col<=selection.endIndex;
      ctx.globalAlpha=game.rows[row][col]?1:.16;
      ctx.fillStyle=selected?'#2c9db7':colors[(row+col)%colors.length];
      ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
      if(game.rows[row][col]&&r>2){ctx.globalAlpha=.45;ctx.fillStyle='#fffce5';ctx.beginPath();ctx.arc(px-r*.25,py-r*.3,r*.3,0,Math.PI*2);ctx.fill();}
    }
    ctx.globalAlpha=1;
  },[game.rows,width,height,world,point,selection,radius]);
  return <button type="button" className="board-overview" style={{height,width}} aria-label={`Vista general de ${game.numRows} filas. Toca una zona para acercar y elegir canicas.`} onClick={event=>{
    const rect=event.currentTarget.getBoundingClientRect(),{scale,x,y}=layout.current;
    onFocus(event.detail===0?{x:world.width/2,y:world.height/2}:{x:Math.max(0,Math.min(world.width,(event.clientX-rect.left-x)/scale)),y:Math.max(0,Math.min(world.height,(event.clientY-rect.top-y)/scale))});
  }}>
    <canvas ref={canvas} style={{width,height}} aria-hidden="true"/>
    <span>Toca una zona para acercar</span>
  </button>;
}

'use client';
export type BoardZoom = number | 'fit';
export function BoardZoomControls({zoom,onChange}:{zoom:BoardZoom;onChange:(zoom:BoardZoom)=>void}):React.ReactElement {
  const fit=zoom==='fit',scale=typeof zoom==='number'?zoom:1;
  return <div className="board-zoom" role="group" aria-label="Zoom del tablero">
    <button type="button" aria-label="Alejar tablero" disabled={fit} onClick={()=>onChange(scale<=1?'fit':Math.max(1,scale-.25))}>−</button>
    <button type="button" className="board-zoom-fit" aria-pressed={fit} onClick={()=>onChange('fit')}>Ver todo</button>
    <output aria-label="Nivel de zoom">{fit?'General':`${Math.round(scale*100)}%`}</output>
    <button type="button" aria-label="Acercar tablero" disabled={!fit&&scale>=2} onClick={()=>onChange(fit?1:Math.min(2,scale+.25))}>+</button>
  </div>;
}

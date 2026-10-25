/** The omitted cells retain their exact width, so hit testing uses normal layout. */
export function visibleColumns(count:number,rowStart:number,cellSize:number,left:number,width:number):{start:number;end:number} {
  const start=Math.max(0,Math.min(count,Math.floor((left-rowStart)/cellSize)-2));
  const end=Math.max(start,Math.min(count,Math.ceil((left+width-rowStart)/cellSize)+2));
  return {start,end};
}

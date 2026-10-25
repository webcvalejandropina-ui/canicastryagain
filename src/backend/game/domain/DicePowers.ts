export const DICE_POWER_NAMES = ['bomba','rayo','diagonal','resurreccion','avalancha','remolino','fantasma','antigua'] as const;
export type DicePowerName = typeof DICE_POWER_NAMES[number];
export type TargetPower = 'avalancha'|'fantasma';
export type DiceTarget = {row:number;col:number};
export type ShuffledRow = {row:number;order:number[]};

/** A level-order traversal produces the same falling wave on every client. */
export function targetPowerCells(rows:number[][],power:TargetPower,origin:DiceTarget):DiceTarget[] {
  if(rows[origin.row]?.[origin.col]!==1)return [];
  const cells=[origin];
  if(power==='fantasma') {
    for(const step of [-1,1]) {
      let col=origin.col+step;
      while(col>=0&&col<rows[origin.row].length) {
        if(rows[origin.row][col]===1){cells.push({row:origin.row,col});break;}
        col+=step;
      }
    }
    return cells;
  }
  const seen=new Set([`${origin.row}:${origin.col}`]);
  for(let i=0;i<cells.length;i++) {
    const parent=cells[i];
    for(const col of [parent.col,parent.col+1]) {
      const row=parent.row+1,key=`${row}:${col}`;
      if(rows[row]?.[col]!==1||seen.has(key))continue;
      seen.add(key);cells.push({row,col});
    }
  }
  return cells;
}

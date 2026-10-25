import type { Move, PlayerNumber } from "../types";

/** Replay known removals; resurrection clears the previous remover. Old dice
 * entries lack coordinates, so their ownership is deliberately left unknown. */
export function buildCellOwnerMap(history: Move[]): Map<string, PlayerNumber> {
  const owners = new Map<string, PlayerNumber>();
  for (const move of history) {
    if (move.fromDice) {
      if (!move.dice) {
        owners.clear();
        continue;
      }
      if(move.dice.shuffledRows) {
        for(const change of move.dice.shuffledRows) {
          const previous=change.order.map((_,col)=>owners.get(`${change.row}:${col}`));
          change.order.forEach((from,col)=>{
            const key=`${change.row}:${col}`,owner=previous[from];
            if(owner===undefined)owners.delete(key);else owners.set(key,owner);
          });
        }
        continue;
      }
      for (const cell of move.dice.affected) {
        const key = `${cell.row}:${cell.col}`;
        if (move.dice.power === "resurreccion") owners.delete(key);
        else owners.set(key, move.player);
      }
    } else {
      for (let col = move.startIndex; col < move.startIndex + move.count; col++)
        owners.set(`${move.rowIndex}:${col}`, move.player);
    }
  }
  return owners;
}

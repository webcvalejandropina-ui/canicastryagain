import assert from 'node:assert/strict';
import { visibleColumns } from '../src/features/game/lib/boardViewport';
for(const count of [1,7,25,50,100])for(const zoom of [1,1.25,1.5,2])for(const width of [280,320,390,990]) {
  const cell=43*zoom,board=Math.max(width,100*cell+20),rowStart=(board+17-count*cell)/2;
  for(let left=0;left<=board-width;left+=71) {
    const {start,end}=visibleColumns(count,rowStart,cell,left,width);
    assert.ok(start>=0&&end<=count&&end>=start);
    assert.equal(start+(end-start)+(count-end),count,'Padding preserves every omitted cell');
    for(let c=0;c<count;c++)if(rowStart+c*cell<left+width&&rowStart+(c+1)*cell>left)assert.ok(c>=start&&c<end,'Every visible cell remains selectable');
    assert.ok(end-start<=Math.ceil(width/cell)+5,'Only a bounded number of columns mounts');
  }
}
console.log('OK: all visible columns preserved at 100–200% zoom, 280–990px viewports and up to 100 columns; exact spacer widths and bounded DOM.');

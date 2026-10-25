"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { visibleColumns } from "../lib/boardViewport";
import { BoardZoomControls } from "./BoardZoomControls";
import { BoardOverview } from "./BoardOverview";
import { SeasonalDetail } from "@/features/appearance/SeasonalDetail";
import type { GameState } from "../types";
import { buildCellOwnerMap } from "../lib/cellOwners";
import { selectRange, tapSelection } from "../lib/selection";

export type MarbleSelection = {
  rowIndex: number;
  startIndex: number;
  endIndex: number;
} | null;
type Props = {
  game: GameState;
  selection: MarbleSelection;
  disabled: boolean;
  onRange: (selection: MarbleSelection) => void;
  singlePick?: boolean;
  powerPreview?: Array<{row:number;col:number}>;
};

export const MatchBoard = memo(function MatchBoard({
  game,
  selection,
  disabled,
  onRange,
  singlePick=false,
  powerPreview=[],
}: Props): React.ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | 'fit'>(game.numRows > 24 ? 'fit' : 1);
  const [box, setBox] = useState({width:320,height:360});
  const [scrollLeft,setScrollLeft]=useState(0);
  const [keyboardRow,setKeyboardRow]=useState<number|null>(null);
  const zoomAnchor = useRef<{x:number;y:number}|null>(null);
  const overview = zoom === 'fit';
  const scale = typeof zoom === 'number' ? zoom : 1;
  function changeZoom(next:number|'fit',anchor?:{x:number;y:number}):void {
    const viewport=viewportRef.current;
    zoomAnchor.current=anchor??(overview?{x:(game.numRows*43+20)/2,y:game.numRows*48/2}:viewport?{x:(viewport.scrollLeft+viewport.clientWidth/2)/scale,y:(viewport.scrollTop+(viewport.clientHeight-44)/2)/scale}:null);
    drag.current=null;
    if(frame.current!==null)cancelAnimationFrame(frame.current);
    frame.current=null;
    setZoom(next);
  }
  const drag = useRef<{
    pointer: number;
    row: number;
    anchor: number;
    target: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const frame = useRef<number | null>(null);
  const suppressTap = useRef(false);
  const limit = singlePick?1:game.moveHistory.length + 1;
  const preview=new Set(powerPreview.map(c=>`${c.row}:${c.col}`));
  const large = game.numRows > 9;
  const virtual = game.numRows > 24;
  const [visibleRows, setVisibleRows] = useState<Set<number>>(() => new Set(Array.from({length:8},(_,i)=>i)));
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!large || !viewport) return;
    if(overview){viewport.scrollTo({top:0,left:0});return;}
    const anchor=zoomAnchor.current;
    viewport.scrollLeft=anchor?anchor.x*scale-viewport.clientWidth/2:Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
    setScrollLeft(viewport.scrollLeft);
    if(anchor)viewport.scrollTop=anchor.y*scale-(viewport.clientHeight-44)/2;
    zoomAnchor.current=null;
  }, [game.numRows, large, overview, scale]);
  const [shortViewport, setShortViewport] = useState(false);
  const scrollable = large || (shortViewport && game.numRows > 6);
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    const measure = () => {
      setShortViewport(container.clientHeight < game.numRows * 44 + 16);
      setBox({width:container.clientWidth,height:container.clientHeight});
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [game.numRows]);
  useEffect(()=>{
    const viewport=viewportRef.current;if(!viewport)return;
    let pending:number|null=null;
    const read=()=>{if(pending===null)pending=requestAnimationFrame(()=>{pending=null;setScrollLeft(viewport.scrollLeft);});};
    viewport.addEventListener('scroll',read,{passive:true});
    return()=>{viewport.removeEventListener('scroll',read);if(pending!==null)cancelAnimationFrame(pending);};
  },[]);
  function columnsFor(row:number):{start:number;end:number} {
    const count=game.rows[row].length;
    if(!virtual||keyboardRow===row)return {start:0,end:count};
    const cell=43*scale,width=Math.max(box.width,game.numRows*cell+20);
    return visibleColumns(count,(width+17-count*cell)/2,cell,scrollLeft,box.width);
  }
  // Animate only visible rows. Observer updates never enter React's selection path.
  useEffect(() => {
    const board = root.current;
    if (!board) return;
    const visibility = () => {
      board.dataset.motionPaused = String(document.hidden);
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (virtual) setVisibleRows(previous => {
                const next = new Set(previous);
                entries.forEach(({target,isIntersecting}) => {
                  const row = Number((target as HTMLElement).dataset.rowIndex);
                  if (isIntersecting) next.add(row); else next.delete(row);
                });
                return next.size === previous.size && [...next].every(row => previous.has(row)) ? previous : next;
              });
              entries.forEach(({ target, isIntersecting }) => {
                (target as HTMLElement).dataset.motionVisible =
                  String(isIntersecting);
              });
            },
            { root: board.parentElement, rootMargin: "192px 0px", threshold: 0 },
          )
        : null;
    if (virtual && !observer) setVisibleRows(new Set(Array.from({length:game.numRows},(_,row)=>row)));
    board
      .querySelectorAll(".play-row")
      .forEach((row) => observer?.observe(row));
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [game.numRows, scrollable, virtual, overview]);
  const owners = useMemo(
    () => buildCellOwnerMap(game.moveHistory),
    [game.moveHistory],
  );
  const lastMove = game.moveHistory[game.moveHistory.length - 1];
  const affected = useMemo(
    () =>
      new Set(
        lastMove?.dice?.affected.map((cell) => `${cell.row}:${cell.col}`) ?? [],
      ),
    [lastMove],
  );

  const removedRecently = (row: number, col: number): boolean =>
    !!lastMove && lastMove.dice?.power!=="remolino" &&
    (lastMove.fromDice
      ? lastMove.dice?.power !== "resurreccion" && affected.has(`${row}:${col}`)
      : row === lastMove.rowIndex &&
        col >= lastMove.startIndex &&
        col < lastMove.startIndex + lastMove.count);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  useEffect(() => {
    if (disabled) {
      drag.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }, [disabled]);

  function start(
    event: PointerEvent<HTMLButtonElement>,
    row: number,
    column: number,
  ): void {
    if (
      disabled ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    if(singlePick)return;
    if (!scrollable) event.preventDefault();
    suppressTap.current = false;
    drag.current = {
      pointer: event.pointerId,
      row,
      anchor: column,
      target: column,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    if (!scrollable) {
      event.currentTarget.setPointerCapture(event.pointerId);
      onRange(tapSelection(game.rows, selection, row, column, limit));
    }
  }

  function move(event: PointerEvent<HTMLDivElement>): void {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId || disabled) return;
    if (scrollable && !active.moved) {
      const dx = Math.abs(event.clientX - active.x);
      const dy = Math.abs(event.clientY - active.y);
      if (dx < 8 || dx < dy) return;
      active.moved = true;
      // Keep receiving the release when the finger leaves its original marble.
      event.currentTarget.setPointerCapture(event.pointerId);
      suppressTap.current = true;
      onRange(
        selectRange(game.rows, active.row, active.anchor, active.anchor, limit),
      );
    }
    const cell = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-cell]");
    if (!cell || Number(cell.dataset.row) !== active.row) return;
    const column = Number(cell.dataset.column);
    if (column === active.target) return;
    active.target = column;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const latest = drag.current;
      if (latest)
        onRange(
          selectRange(
            game.rows,
            latest.row,
            latest.anchor,
            latest.target,
            limit,
          ),
        );
    });
  }

  function end(event: PointerEvent<HTMLDivElement>): void {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
      onRange(
        selectRange(game.rows, active.row, active.anchor, active.target, limit),
      );
    }
    drag.current = null;
  }

  function navigate(
    event: KeyboardEvent<HTMLButtonElement>,
    row: number,
    column: number,
  ): void {
    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if(virtual && keyboardRow!==row){
      setKeyboardRow(row);
      if(event.key==='Home'||event.key==='End'){
        const cells=game.rows[row],column=event.key==='Home'?cells.indexOf(1):cells.lastIndexOf(1);
        requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-row="${row}"][data-column="${column}"]`)?.focus());
        return;
      }
    }
    const available = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        "[data-cell]:not(:disabled)",
      ) ?? [],
    );
    let list = available.filter((cell) => Number(cell.dataset.row) === row);
    let target: HTMLButtonElement | undefined;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const step = event.key === "ArrowUp" ? -1 : 1;
      for (let r = row + step; r >= 0 && r < game.rows.length; r += step) {
        list = available.filter((cell) => Number(cell.dataset.row) === r);
        if (list.length) {
          target = list.reduce((best, cell) =>
            Math.abs(Number(cell.dataset.column) - column) <
            Math.abs(Number(best.dataset.column) - column)
              ? cell
              : best,
          );
          break;
        }
      }
    } else if (event.key === "Home") target = list[0];
    else if (event.key === "End") target = list[list.length - 1];
    else
      target =
        list[
          list.indexOf(event.currentTarget) +
            (event.key === "ArrowLeft" ? -1 : 1)
        ];
    target?.focus();
  }

  return (
    <div
      ref={viewportRef}
      style={{'--board-cell-size':`${43*scale}px`,'--board-row-height':`${48*scale}px`,'--board-ball-size':`${32*scale}px`} as CSSProperties}
      className={`board-viewport ${overview ? "is-overview" : ""} ${large ? "is-large" : ""} ${scrollable ? "is-scrollable" : ""}`}
    >
      {large && <div className="large-board-nav">
        <label>Ir a fila <select aria-label="Ir a fila" defaultValue="" onChange={event => {
          const board=root.current, viewport=board?.parentElement, row=board?.children[Number(event.target.value)] as HTMLElement | undefined;
          if(overview){changeZoom(1,{x:(game.numRows*43+20)/2,y:Number(event.target.value)*48+24});return;}
          if(viewport && row) viewport.scrollTo({top:row.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop-44,left:Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2)});
        }}><option value="" disabled>1–{game.numRows}</option>{game.rows.map((_,row)=><option key={row} value={row}>{row+1}</option>)}</select></label>
        <BoardZoomControls zoom={zoom} onChange={changeZoom}/>
      </div>}
      {large && overview ? <BoardOverview radius={16} game={game} width={Math.max(1,box.width)} height={Math.max(100,box.height-60)} world={{width:game.numRows*43+20,height:game.numRows*48}} point={(row,col)=>({x:(game.numRows*43+20)/2+8.5+(col-row/2)*43,y:row*48+24})} selection={selection} onFocus={point=>changeZoom(1,point)}/> : <>
      {scrollable && !large ? (
        <span className="scroll-board-note" aria-hidden="true">
          Desliza ↕
        </span>
      ) : null}
      <div
        ref={root}
      data-last-power={lastMove?.dice?.power??""}
        className="play-grid"
        style={
          {
            "--row-count": game.numRows,
            "--live-count": Math.max(
              1,
              game.rows.filter((row) => row.some(Boolean)).length,
            ),
            "--empty-count": game.rows.filter((row) => !row.some(Boolean))
              .length,
          } as CSSProperties
        }
        role="group"
        aria-label={
          scrollable
            ? "Tablero de canicas. Desliza para ver todas las filas."
            : "Tablero de canicas"
        }
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => {
          drag.current = null;
          suppressTap.current = true;
          if (frame.current !== null) cancelAnimationFrame(frame.current);
          frame.current = null;
        }}
        onLostPointerCapture={(event) => {
          // Touch browsers implicitly capture on the marble before we transfer
          // a horizontal drag to the grid; that transfer is not a cancellation.
          if (scrollable && event.target !== event.currentTarget) return;
          drag.current = null;
          if (frame.current !== null) cancelAnimationFrame(frame.current);
          frame.current = null;
        }}
      >
        {game.rows.map((cells, row) => {
          const {start:columnStart,end:columnEnd}=columnsFor(row);
          return <div
            key={row}
            data-row-index={row}
            className={`play-row ${selection?.rowIndex === row ? "is-selected-row" : ""} ${cells.some(Boolean) ? "" : "is-empty-row"}`}
            role="group"
            aria-label={`Fila ${row + 1}`}
          >
            <button
              type="button"
              className="row-number"
              disabled={disabled || !cells.some(Boolean)}
              aria-label={`Seleccionar fila ${row + 1}`}
              onClick={() => {
                const first = cells.indexOf(1);
                onRange(selectRange(game.rows, row, first, first, limit));
              }}
            >
              {row + 1}
            </button>
            <div className="row-marbles">
              {columnStart>0&&<span aria-hidden="true" style={{flex:`0 0 ${columnStart*43*scale}px`}}/>}
              {(!virtual || visibleRows.has(row) || selection?.rowIndex === row) && cells.slice(columnStart,columnEnd).map((cell, offset) => {
                const column=columnStart+offset;
                return cell ? (
                  <button
                    key={column}
                    type="button"
                    data-cell="true"
                    data-row={row}
                    data-column={column}
                    data-order={
                      selection?.rowIndex === row
                        ? column - selection.startIndex + 1
                        : undefined
                    }
                    data-range-start={
                      (selection?.rowIndex === row &&
                        column === selection.startIndex) ||
                      undefined
                    }
                    data-range-end={
                      (selection?.rowIndex === row &&
                        column === selection.endIndex) ||
                      undefined
                    }
                    style={
                      {
                        "--phase": `${-((row * 7 + column * 3) % 17) / 3}s`,
                        "--float-time": `${4.4 + ((row * 3 + column) % 7) * 0.37}s`,
                        "--intro": `${Math.min(360, row * 38 + column * 22)}ms`,
                        "--sway": column % 2 ? "1" : "-1",
                      } as CSSProperties
                    }
                    className={`marble-target ${preview.has(`${row}:${column}`)?"is-power-preview":""} ${affected.has(`${row}:${column}`) ? "was-dice" : ""} ${selection?.rowIndex === row && column >= selection.startIndex && column <= selection.endIndex ? "is-selected" : ""}`}
                    aria-label={`Fila ${row + 1}, canica ${column + 1}`}
                    title="Canica viva · Toca para seleccionar"
                    aria-pressed={
                      selection?.rowIndex === row &&
                      column >= selection.startIndex &&
                      column <= selection.endIndex
                    }
                    disabled={disabled}
                    onPointerDown={(event) => start(event, row, column)}
                    onClick={(event) => {
                      if(singlePick){onRange({rowIndex:row,startIndex:column,endIndex:column});return;}
                      if (suppressTap.current && event.detail !== 0) {
                        suppressTap.current = false;
                        return;
                      }
                      if (scrollable || event.detail === 0)
                        onRange(
                          tapSelection(
                            game.rows,
                            selection,
                            row,
                            column,
                            limit,
                          ),
                        );
                    }}
                    onKeyDown={(event) => navigate(event, row, column)}
                  >
                    <span className="orb-contact" aria-hidden="true" />
                    <span className="orb-float">
                      <span className="pocket-marble">
                        <span className="orb-ribbon" />
                        <SeasonalDetail variant={row + column} />
                      </span>
                    </span>
                  </button>
                ) : (
                  <span
                    key={column}
                    className={`marble-target is-removed ${lastMove?.dice?.power==="avalancha"&&affected.has(`${row}:${column}`)?"was-avalanche":""} ${affected.has(`${row}:${column}`) ? "was-dice" : ""}`}
                    data-owner={owners.get(`${row}:${column}`)}
                    role="img"
                    aria-label={`Fila ${row + 1}, canica ${column + 1}: eliminada${owners.has(`${row}:${column}`) ? ` por J${owners.get(`${row}:${column}`)}` : ""}`}
                  >
                    {lastMove?.dice?.power==="avalancha"&&affected.has(`${row}:${column}`)&&<span className="avalanche-echo" aria-hidden="true" style={{animationDelay:`${Math.max(0,row-(lastMove.dice.target?.row??row))*.12}s`}}/>}
                    {removedRecently(row, column) ? (
                      <span className="orb-exit" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : null}
                    <span className="dead-marble">
                      <b aria-hidden="true">×</b>
                      <small aria-hidden="true">
                        {owners.has(`${row}:${column}`)
                          ? `J${owners.get(`${row}:${column}`)}`
                          : ""}
                      </small>
                    </span>
                  </span>
                );
              })}
              {columnEnd<cells.length&&<span aria-hidden="true" style={{flex:`0 0 ${(cells.length-columnEnd)*43*scale}px`}}/>}
            </div>
          </div>;
        })}
      </div>
      </>}
    </div>
  );
});

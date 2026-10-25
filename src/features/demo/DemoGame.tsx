"use client";
import { useEffect, useState } from "react";
import { MIN_ROWS, MAX_ROWS, DEFAULT_ROWS } from "@/shared/gameConfig";
import Link from "next/link";
import { DICE_POWER_NAMES } from "@/backend/game/domain/DicePowers";
import { DICE_POWERS } from "@/features/game/components/DiceDisplay";
import { MatchArena } from "@/features/game/components/MatchArena";
import type { MarbleSelection } from "@/features/game/components/MatchBoard";
import { tapSelection } from "@/features/game/lib/selection";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { APPEARANCE_KEY, parseAppearance, type SeasonPreference } from "@/features/appearance/appearance";
import { WORLD_OPTIONS } from "@/features/appearance/worlds";
import { createDemoGame, demoView, playDemoBot, DEMO_YOU } from "./demoEngine";
import "./demo.css";

export function DemoGame(): React.ReactElement {
  const [round, setRound] = useState(0);
  const [numRows, setNumRows] = useState(DEFAULT_ROWS);
  const { update } = useAppearance();
  useEffect(() => () => {
    try { update(parseAppearance(localStorage.getItem(APPEARANCE_KEY)), false); }
    catch { /* The current appearance remains usable if storage is unavailable. */ }
  }, [update]);

  return <DemoRound key={`${round}:${numRows}`} numRows={numRows} onRows={setNumRows} onRestart={() => setRound(n => n + 1)} />;
}
function DemoRound({onRestart,numRows,onRows}: {onRestart: () => void;numRows:number;onRows:(rows:number)=>void}): React.ReactElement {
  const [engine] = useState(() => createDemoGame(numRows));
  const [game, setGame] = useState(() => demoView(engine));
  const [selection, setSelection] = useState<MarbleSelection>(null);
  const [toast, setToast] = useState("");
  const { preferences, theme, update } = useAppearance();
  useEffect(() => {
    if (game.currentTurn !== 2 || game.status !== "playing") return;
    const timer = setTimeout(() => { playDemoBot(engine); setGame(demoView(engine)); }, Math.max(2200,(game.moveHistory.at(-1)?.dice?.flight?.duration??0)*1000+500));
    return () => clearTimeout(timer);
  }, [engine, game.currentTurn, game.status,game.moveHistory]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  function publish(): void { setSelection(null); setGame(demoView(engine)); }
  return <div className="demo-shell">
    <nav className="demo-toolbar" aria-label="Controles de la demo">
      <Link href="/" aria-label="Salir de la demo">↗</Link>
      <strong>DEMO</strong>
      <label className="demo-row-choice">Filas <select aria-label="Filas de la demo" value={numRows} onChange={event=>onRows(Number(event.target.value))}>{Array.from({length:MAX_ROWS-MIN_ROWS+1},(_,i)=><option key={i} value={i+MIN_ROWS}>{i+MIN_ROWS}</option>)}</select></label>
      <label className="sr-only" htmlFor="demo-season">Evento de la demo</label>
      <select id="demo-season" value={preferences.season} onChange={e => update({season: e.target.value as SeasonPreference,backgroundPolicy:"auto"}, false)}>
        <option value="auto">Por fecha</option>
        {WORLD_OPTIONS.map(world => <option key={world.id} value={world.id}>{world.label}</option>)}
      </select>
      <details className="demo-powers"><summary aria-label="Probar poderes del dado"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4ZM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/></svg></summary><div>{DICE_POWER_NAMES.map((power,index)=><button key={power} type="button" aria-label={`Probar ${DICE_POWERS[power].name}`} disabled={!game.yourDiceAvailable||game.currentTurn!==1||game.status!=="playing"} onClick={event=>{engine.useDice(DEMO_YOU,()=>(index+.5)/DICE_POWER_NAMES.length);event.currentTarget.closest('details')?.removeAttribute('open');publish();}}>{DICE_POWERS[power].name}</button>)}</div></details>
      <button type="button" aria-label={theme === "dark" ? "Ver demo en claro" : "Ver demo en oscuro"} onClick={() => update({color: theme === "dark" ? "light" : "dark"}, false)}>{theme === "dark" ? "☀" : "◐"}</button>
      <button type="button" onClick={onRestart} aria-label="Reiniciar demo">↻</button>
    </nav>
    <MatchArena demo game={game} selection={selection} busy={false} syncing={false} connection="live" shareStatus=""
      onRange={setSelection} onSelect={(row,col) => setSelection(previous => tapSelection(game.rows,previous,row,col,game.moveHistory.length+1))}
      onConfirm={async () => {
        if (!selection) return;
        try { engine.makeMove({playerId:DEMO_YOU,rowIndex:selection.rowIndex,startIndex:selection.startIndex,removeCount:selection.endIndex-selection.startIndex+1}); publish(); }
        catch (error) { setToast(error instanceof Error ? error.message : "Revisa la selección."); }
      }}
      onCancel={() => setSelection(null)}
      onDice={async () => {
        try { const result = engine.useDice(DEMO_YOU); publish(); return result.dice; }
        catch (error) { setToast(error instanceof Error ? error.message : "No se pudo lanzar."); return null; }
      }}
      onDiceTarget={async target=>{try{const result=engine.resolveDiceTarget(DEMO_YOU,target);publish();return result.dice;}catch(error){setToast(error instanceof Error?error.message:"No se pudo confirmar.");return null;}}}
      onAncientShot={async (shot) => {
        try {const result=engine.launchAncientShot(DEMO_YOU,shot);publish();return result.dice;}
        catch(error){setToast(error instanceof Error?error.message:"No se pudo lanzar.");return null;}
      }}
      onRefresh={async () => setGame(demoView(engine))}
      onCopyCode={async () => setToast("Demo local contra un rival automático.")}
      onInvite={async () => setToast("Puedes abrir esta demo desde /demo.")}
      onLeave={async () => onRestart()} onExit={onRestart} onToast={setToast}
    />
    {toast ? <div className="demo-toast" role="status">{toast}</div> : null}
  </div>;
}

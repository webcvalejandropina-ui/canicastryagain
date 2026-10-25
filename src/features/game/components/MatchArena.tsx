"use client";

import { InstallAppButton, usePwa } from "@/features/pwa/PwaProvider";
import dynamic from "next/dynamic";
import { targetPowerCells } from "@/backend/game/domain/DicePowers";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PrivateWaitingInvite } from "./PrivateWaitingInvite";
import { AncientShotBoard } from "./AncientShotBoard";
import { MatchBoard, type MarbleSelection } from "./MatchBoard";
import { DiceCube, DICE_POWERS, DICE_COLORS, PowerGlyph } from "./DiceDisplay";
import { MatchResult } from "./MatchResult";
import { MoveHistory, moveAmount, moveDescription } from "./MoveHistory";
import { SeasonalScene } from "@/features/appearance/SeasonalScene";
import type { AncientShot, DiceResult, GameState } from "../types";
import type { ConnectionState } from "../lib/synchronization";
import "./match.css";
import "./match-focus.css";
import {
  AppearanceSettings,
  AppearanceIcon,
} from "@/features/appearance/AppearanceSettings";

const ThreeBoard = dynamic(
  () => import("./GameBoard").then((module) => module.GameBoard),
  {
    ssr: false,
    loading: () => <div className="engine-loading">Preparando vista 3D…</div>,
  },
);

type Props = {
  demo?: boolean;
  game: GameState;
  selection: MarbleSelection;
  busy: boolean;
  syncing: boolean;
  connection: ConnectionState;
  shareStatus: string;
  inviteUrl?: string;
  onRange: (selection: MarbleSelection) => void;
  onSelect: (row: number, column: number) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  onDice: () => Promise<DiceResult | null>;
  onDiceTarget: (target:import("../types").DiceTarget)=>Promise<DiceResult|null>;
  onAncientShot: (shot: AncientShot) => Promise<DiceResult | null>;
  onRefresh: () => Promise<void>;
  onCopyCode: () => Promise<void>;
  onInvite: () => Promise<void>;
  onLeave: () => Promise<void>;
  onExit: () => void;
  onOpenGames?: () => void;
  onToast: (message: string) => void;
};
type SheetName =
  | "appearance"
  | "menu"
  | "rules"
  | "history"
  | "dice"
  | "power"
  | "leave"
  | null;

function Glyph({
  name,
}: {
  name:
    | "menu"
    | "arrow"
    | "close"
    | "dice"
    | "undo"
    | "wifi"
    | "history"
    | "help";
}): React.ReactElement {
  const paths = {
    menu: (
      <>
        <path d="M5 8h14M5 16h14" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    dice: (
      <>
        <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4ZM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" />
      </>
    ),
    undo: (
      <>
        <path d="M4 10h9a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5" />
      </>
    ),
    wifi: (
      <>
        <path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0M12 20h.01" />
      </>
    ),
    history: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Sheet({
  title,
  children,
  onClose,
  locked = false,
  stableDice = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  locked?: boolean;
  stableDice?: boolean;
}): React.ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Preserve the die's screen position when the rules give way to the throw/result.
    dialog.style.height = "";
    if (stableDice) dialog.style.height = `${dialog.getBoundingClientRect().height}px`;
  }, [stableDice]);
  return (
    <dialog
      ref={ref}
      className="pocket-sheet"
      aria-labelledby="sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientY < r.top ||
            event.clientX < r.left ||
            event.clientX > r.right
          )
            onClose();
        }
      }}
    >
      <div className="sheet-handle" />
      <header>
        <h2 id="sheet-title">{title}</h2>
        <button
          type="button"
          className="pocket-icon"
          aria-label="Cerrar panel"
          disabled={locked}
          onClick={onClose}
        >
          <Glyph name="close" />
        </button>
      </header>
      <div className="sheet-content">{children}</div>
    </dialog>
  );
}

export function MatchArena(props: Props): React.ReactElement {
  const {
    game,
    selection,
    busy,
    connection,
    onRange,
    onCancel,
    onConfirm,
    onDice,
    onRefresh,
    onCopyCode,
    onInvite,
    onExit,
    onLeave,
    onToast,
  } = props;
  const {offlineReady}=usePwa();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [three, setThree] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [power, setPower] = useState<DiceResult | null>(null);
  const [shotReplay, setShotReplay] = useState<DiceResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const rollingLock = useRef(false);
  const latestGame = useRef(game);
  latestGame.current = game;
  const demo = props.demo === true;
  const [diceTarget,setDiceTarget]=useState<import("../types").DiceTarget|null>(null);
  const targetLock=useRef(false);
  const targetStage=game.pendingTargetPower??null;
  useEffect(()=>setDiceTarget(null),[targetStage,game.gameId]);
  const targetPreview=targetStage&&diceTarget?targetPowerCells(game.rows,targetStage,diceTarget):[];
  async function confirmDiceTarget():Promise<void>{
    if(!diceTarget||!targetStage||targetLock.current||!connected||busy)return;
    targetLock.current=true;
    try{await props.onDiceTarget(diceTarget);}finally{targetLock.current=false;}
  }
  const manualStage = Boolean(game.pendingAncientShot || shotReplay);
  const waiting = game.status === "waiting";
  const finished = game.status === "finished";
  const myTurn =
    game.status === "playing" && game.currentTurn === game.yourPlayerNumber;
  const connected = connection === "live" || connection === "polling";
  const canPlay = myTurn && connected && !busy && !manualStage && !targetStage;
  const turn = game.moveHistory.length + 1;
  const count = selection ? selection.endIndex - selection.startIndex + 1 : 0;
  const remaining = game.rows.reduce(
    (sum, row) => sum + row.filter(Boolean).length,
    0,
  );
  const mine = game.yourPlayerNumber === 1 ? game.player1 : game.player2;
  const opponent = game.yourPlayerNumber === 1 ? game.player2 : game.player1;
  const labels = {
    connecting: "Conectando",
    live: demo ? "Demo local" : "En vivo",
    polling: "Sincronizado",
    offline: "Sin conexión",
    reconnecting: "Reconectando",
  };
  const lastMove = game.moveHistory[game.moveHistory.length - 1];
  const myDice = game.moveHistory.find(
    (move) => move.player === game.yourPlayerNumber && move.dice,
  )?.dice ?? (targetStage&&myTurn?{power:targetStage,affected:[],pending:true} as DiceResult:undefined) ?? (game.pendingAncientShot && myTurn ? {power:"antigua",affected:[],pending:true} as DiceResult : undefined);

  const latestShotMove=game.moveHistory.slice().reverse().find(move=>move.dice?.power==="antigua"&&move.dice.shot);
  const replayMove=useRef(latestShotMove);
  replayMove.current=latestShotMove;
  const replayKey=latestShotMove?.timestamp??null;
  useEffect(() => {
    setShotReplay(null);
    const move=replayMove.current;
    const shot=move?.dice;
    if(!move || shot?.power!=="antigua" || !shot.shot || Date.now()-Date.parse(move.timestamp)>4000) return;
    setShotReplay(shot);
    const timer=window.setTimeout(()=>setShotReplay(null),Math.max(1000,(shot.flight?.duration??.65)*1000+450));
    return ()=>window.clearTimeout(timer);
  }, [replayKey]);

  useEffect(() => {
    setSheet(null);
  }, [game.status]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sheet && !busy) {if(targetStage)setDiceTarget(null);else onCancel();}
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [sheet, busy, onCancel,targetStage]);

  function adjust(step: number): void {
    if (!selection || !canPlay) return;
    const { rowIndex, startIndex, endIndex } = selection;
    if (step < 0) {
      onRange(
        endIndex > startIndex ? { ...selection, endIndex: endIndex - 1 } : null,
      );
      return;
    }
    if (count >= turn) return;
    if (game.rows[rowIndex][endIndex + 1] === 1)
      onRange({ ...selection, endIndex: endIndex + 1 });
    else if (game.rows[rowIndex][startIndex - 1] === 1)
      onRange({ ...selection, startIndex: startIndex - 1 });
  }
  const canIncrease =
    !!selection &&
    count < turn &&
    (game.rows[selection.rowIndex][selection.endIndex + 1] === 1 ||
      game.rows[selection.rowIndex][selection.startIndex - 1] === 1);

  async function dice(): Promise<void> {
    if (!canPlay || !game.yourDiceAvailable || rollingLock.current) return;
    rollingLock.current = true;
    setRolling(true);
    if (
      typeof navigator.vibrate === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      navigator.vibrate(12);
    onCancel();
    try {
      const [result] = await Promise.all([
        onDice(),
        new Promise((resolve) => setTimeout(resolve, 1650)),
      ]);
      if (result) {
        setPower(result);
        setSheet(latestGame.current.status === "finished" ? null : "power");
      } else setSheet(null);
    } finally {
      rollingLock.current = false;
      setRolling(false);
    }
  }

  return (
    <div
      className={`match-app pocket-app relative z-10 ${manualStage?"is-manual":""}`}
      data-player={game.yourPlayerNumber ?? 1}
      data-turn={game.currentTurn}
      data-sheet-open={!!sheet}
    >
      <header className="pocket-header">
        <button
          type="button"
          className="pocket-icon"
          aria-label="Abrir menú de partida"
          onClick={() => setSheet("menu")}
        >
          <Glyph name="menu" />
        </button>
        <span className="pocket-logo">
          canicas<span aria-hidden="true">/</span>
        </span>
        <span className="pocket-edition">{demo ? "PRÁCTICA / SIN REGISTRO" : `EN LÍNEA / ${game.gameCode}`}</span>
        <button
          type="button"
          className="pocket-icon header-history"
          aria-label="Ver historial"
          onClick={() => setSheet("history")}
        >
          <Glyph name="history" />
        </button>
        <button
          type="button"
          className={`network-chip state-${connection}`}
          onClick={() => {
            if (!connected) void onRefresh();
            else setSheet("menu");
          }}
          aria-label={`Conexión: ${demo ? "Demo local" : finished ? "Partida guardada" : labels[connection]}`}
        >
          <i />
          <span>{demo ? "Demo local" : finished ? "Guardada" : labels[connection]}</span>
        </button>
      </header>
      <section className="versus-strip" aria-label="Jugadores">
        {[
          { player: mine, you: true, number: game.yourPlayerNumber },
          {
            player: opponent,
            you: false,
            number: game.yourPlayerNumber === 1 ? 2 : 1,
          },
        ].map(({ player, you, number }) => (
          <div
            key={you ? "you" : "rival"}
            data-player={number}
            title={`${player?.name ?? "Esperando rival"} · J${number}`}
            className={`pocket-player ${you ? "is-you" : "is-opponent"} ${game.status === "playing" && game.currentTurn === number ? "is-active" : ""}`}
          >
            <span className="pocket-avatar" aria-hidden="true">
              J{number}
            </span>
            <div>
              <strong>{player?.name ?? "Esperando rival"}</strong>
              <span>
                {you ? "Tú" : player ? "Rival" : "Sitio libre"}
                {finished && game.winner === number
                  ? " · Ganador"
                  : game.status === "playing" && game.currentTurn === number
                    ? " · Jugando"
                    : ""}
              </span>
            </div>
            <i aria-hidden="true" />
          </div>
        ))}
        <span className="versus-mark" aria-hidden="true">
          vs
        </span>
      </section>

      <main className={`pocket-stage ${waiting ? "is-waiting" : ""}`}>
        <div className="pocket-status" role="status" aria-live="polite">
          <div>
            <span className="turn-kicker">
              {finished
                ? "PARTIDA FINALIZADA"
                : waiting
                  ? "PREPARANDO LA PARTIDA"
                  : `Jugada ${String(turn).padStart(2, "0")}`}
            </span>
            <h1 key={`${game.moveHistory.length}-${game.status}-${connected}`}>
              {finished
                ? game.winner === game.yourPlayerNumber
                  ? "Bien jugado."
                  : "¿La revancha?"
                : waiting
                  ? "Falta tu rival."
                  : !connected
                    ? "Recuperando conexión…"
                    : targetStage ? `${DICE_POWERS[targetStage].name}.`
                    : game.pendingAncientShot
                      ? myTurn ? "Tirada antigua." : "Tirada del rival."
                    : myTurn
                      ? "Tu turno."
                      : "Turno del rival."}
            </h1>
            <p>
              {finished
                ? demo ? "Demo terminada. Puedes jugar otra." : "El resultado está guardado."
                : waiting
                  ? game.privateInvitation ? "Envía tu enlace privado. Entra y empezáis." : "Comparte el código. Entra y empezáis."
                  : !connected
                    ? "Conservamos el tablero mientras vuelve la red."
                    : targetStage ? myTurn?"Elige una canica y revisa el efecto antes de confirmar.":"Tu rival está eligiendo el objetivo."
                    : game.pendingAncientShot
                      ? myTurn ? "Apunta, mantén para cargar y suelta." : "Tu rival está preparando el lanzamiento."
                    : myTurn
                      ? `Hasta ${turn} en una fila.`
                      : "Tu rival está eligiendo."}
            </p>
          </div>
          <div className="remaining-counter">
            <strong>
              {String(remaining).padStart(2, "0")}
              <small>/{(game.numRows * (game.numRows + 1)) / 2}</small>
            </strong>
            <span>EN LA MESA</span>
          </div>
        </div>
        {!manualStage && <div className="marble-legend" aria-label="Estados de las canicas">
          <span>
            <i className="legend-live" />
            Viva
          </span>
          <span>
            <i className="legend-selected" />
            Elegidas
          </span>
          <span>
            <i className="legend-dead">×</i>Eliminada
          </span>
        </div>}
        <div className={`pocket-board ${three && !manualStage && !targetStage ? "is-three" : ""}`}>
          <SeasonalScene moveNumber={game.moveHistory.length} />
          {targetStage ? <MatchBoard game={game} singlePick powerPreview={targetPreview} selection={diceTarget?{rowIndex:diceTarget.row,startIndex:diceTarget.col,endIndex:diceTarget.col}:null}
            disabled={!myTurn||!connected||busy||rolling||!!sheet} onRange={value=>setDiceTarget(value?{row:value.rowIndex,col:value.startIndex}:null)}/> : game.pendingAncientShot || shotReplay ? (
            <AncientShotBoard game={game} enabled={myTurn && connected && !busy && !rolling && !sheet}
              replay={shotReplay} onLaunch={props.onAncientShot}/>
          ) : three ? (
            <ThreeBoard
              game={game}
              selectedRowIndex={selection?.rowIndex ?? null}
              selectedStartIndex={selection?.startIndex ?? null}
              selectedEndIndex={selection?.endIndex ?? null}
              canInteract={canPlay}
              onBallClick={props.onSelect}
            />
          ) : (
            <MatchBoard
              game={game}
              selection={selection}
              disabled={!canPlay}
              onRange={onRange}
            />
          )}
          {waiting && game.privateInvitation ? (
            <PrivateWaitingInvite expiresAt={game.invitationExpiresAt} url={props.inviteUrl??""} status={props.shareStatus} onShare={onInvite} code={game.gameCode} onCopyCode={onCopyCode}/>
          ) : waiting ? (
            <div className="pocket-invite">
              <span className="invite-dot" />
              <p>Una partida. Dos cabezas.</p>
              <button
                type="button"
                onClick={() => void onCopyCode()}
                aria-label="Copiar código de partida"
              >
                <strong>{game.gameCode}</strong>
                <span>Toca para copiar ↗</span>
              </button>
              <button
                type="button"
                className="pocket-primary"
                onClick={() => void onInvite()}
              >
                Invitar por WhatsApp
                <Glyph name="arrow" />
              </button>
            </div>
          ) : null}
        </div>
        {!manualStage && <div className="move-receipt-space">
          {lastMove ? (
            <button
              type="button"
              className="move-receipt"
              data-player={lastMove.player}
              onClick={() => setSheet("history")}
              aria-label="Ver la última jugada en el historial"
            >
              <i />
              <span>
                {lastMove.player === game.yourPlayerNumber ? "Tú" : "Rival"} ·{" "}
                {moveDescription(lastMove)}
              </span>
              <strong>{moveAmount(lastMove)}</strong>
              <Glyph name="history" />
            </button>
          ) : null}
        </div>}
        <div className="board-footnote">
          <span>
            <i />{" "}
            {game.pendingAncientShot
              ? "Tirada manual · El dado ya está utilizado"
              : three
              ? "Vista 3D"
              : count
                ? `${count} seleccionada${count === 1 ? "" : "s"} · Fila ${selection!.rowIndex + 1}`
                : "Toca o desliza por una fila"}
          </span>
          <button type="button" onClick={() => setSheet("rules")}>
            La última pierde <Glyph name="help" />
          </button>
        </div>
      </main>

      <footer className={`thumb-dock ${count ? "has-selection" : ""}`}>
        {!connected && !finished ? (
          <div className="network-notice" role="status">
            <Glyph name="wifi" />
            <span>
              {connection === "offline"
                ? "Sin red. La partida sigue guardada."
                : "Volvemos a sincronizar antes de jugar."}
            </span>
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={props.syncing}
            >
              {props.syncing ? "…" : "Reintentar"}
            </button>
          </div>
        ) : null}
        {waiting ? (
          <div className="waiting-actions">
            <p>El juego empieza cuando entre tu rival.</p>
            <button
              type="button"
              className="pocket-secondary"
              onClick={() => setSheet("leave")}
            >
              Cancelar mesa
            </button>
          </div>
        ) : finished ? (
          <button
            type="button"
            className="pocket-primary"
            onClick={() => setInspect(false)}
          >
            Ver resultado
            <Glyph name="arrow" />
          </button>
        ) : targetStage ? (
          <div className="target-power-dock"><strong>{DICE_POWERS[targetStage].name}</strong><p>{myTurn?diceTarget?`${targetPreview.length} canicas marcadas. Si quitas la última, pierdes.`:"Toca una canica para previsualizar el efecto.":"El rival está eligiendo su objetivo."}</p>
          <button type="button" className="pocket-primary" disabled={!diceTarget||!myTurn||!connected||busy} onClick={()=>void confirmDiceTarget()}>Confirmar {DICE_POWERS[targetStage].name} ↗</button></div>
        ) : manualStage ? (
          <div className="ancient-dock"><div><strong>Tirada antigua</strong><p>{shotReplay ? `${shotReplay.affected.length} canicas eliminadas.` : myTurn ? "Tu lanzamiento completa este turno." : "El rival está apuntando."}</p></div>
            <button type="button" onClick={()=>setSheet("rules")}>Cómo lanzar ↗</button></div>
        ) : (
          <>
            <span className="sr-only" role="status">
              {count ? `${count} canicas seleccionadas` : "Sin selección"}
            </span>
            <div className="dock-topline">
              <div
                className="quantity-control"
                role="group"
                aria-label="Cantidad de canicas"
              >
                <span className="quantity-caption">TU SELECCIÓN</span>
                <button
                  type="button"
                  aria-label="Quitar una de la selección"
                  disabled={!count || !canPlay}
                  onClick={() => adjust(-1)}
                >
                  −
                </button>
                <span aria-live="polite">
                  <strong>{String(count).padStart(2, "0")}</strong>
                  <span> / {turn}</span>
                </span>
                <button
                  type="button"
                  aria-label="Añadir una a la selección"
                  disabled={!canIncrease || !canPlay}
                  onClick={() => adjust(1)}
                >
                  +
                </button>
              </div>
              <div className="dock-tools">
                <button
                  type="button"
                  className="pocket-icon"
                  disabled={!count || busy}
                  onClick={onCancel}
                  aria-label="Cancelar selección"
                >
                  <Glyph name="undo" />
                </button>
                <button
                  type="button"
                  className="pocket-icon"
                  aria-label="Ver historial"
                  data-dock-history="true"
                  onClick={() => setSheet("history")}
                >
                  <Glyph name="history" />
                </button>
              </div>
            </div>
            <div className="dock-action-row">
              <button
                type="button"
                className="dice-shortcut"
                data-used={!game.yourDiceAvailable}
                disabled={busy || rolling}
                aria-label={`Dado especial${!game.yourDiceAvailable ? ": usado" : ""}`}
                onClick={() => setSheet("dice")}
              >
                <Glyph name="dice" />
                <span>{game.yourDiceAvailable ? "Dado" : "Usado"}</span>
              </button>
              <button
                type="button"
                className="pocket-primary"
                disabled={!count || !canPlay}
                onClick={() => void onConfirm()}
              >
                {busy
                  ? "Enviando…"
                  : !connected
                    ? "Esperando conexión"
                    : !myTurn
                      ? "Esperando al rival"
                      : count
                        ? `Quitar ${count} canica${count === 1 ? "" : "s"}`
                        : "Selecciona canicas"}
                <Glyph name="arrow" />
              </button>
            </div>
          </>
        )}
      </footer>

      {sheet ? (
        <Sheet
          stableDice={sheet === "dice" || sheet === "power"}
          locked={rolling}
          title={
            {
              menu: "Tu partida",
              appearance: "A tu manera",
              rules: "Así se juega",
              history: "Jugada a jugada",
              dice: "Tu dado especial",
              power: "Resultado del dado",
              leave: "¿Sales de la partida?",
            }[sheet]
          }
          onClose={() => {
            if (!rollingLock.current) setSheet(null);
          }}
        >
          {sheet === "menu" ? (
            <>
              {demo ? <p className="sheet-subtle">Demo contra un rival automático. No suma puntos y puedes reiniciarla cuando quieras.</p> : game.privateInvitation ? <p className="sheet-subtle">Mesa privada para dos. {waiting ? "Comparte el enlace desde la mesa para invitar a tu rival." : "Tu rival ya ha entrado. La invitación está cerrada."}</p> : <div className="sheet-code">
                <span>CÓDIGO DE PARTIDA</span>
                <button type="button" onClick={() => void onCopyCode()}>
                  {game.gameCode}
                  <span>Copiar ↗</span>
                </button>
              </div>}
              <div className="sheet-menu">
                {!demo&&props.onOpenGames&&<button type="button" onClick={props.onOpenGames}><Glyph name="history"/>Mis partidas / crear otra<span>↗</span></button>}
                <InstallAppButton />
                <button type="button" onClick={() => setSheet("appearance")}>
                  <AppearanceIcon />
                  Aspecto y temporadas<span>↗</span>
                </button>
                <button type="button" onClick={() => setSheet("rules")}>
                  <Glyph name="help" />
                  Cómo jugar<span>↗</span>
                </button>
                <button type="button" onClick={() => setSheet("history")}>
                  <Glyph name="history" />
                  Historial<span>{game.moveHistory.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if(!three && !navigator.onLine && !offlineReady) {
                      setSheet(null);onToast("La vista 3D necesita conexión para descargarse. Puedes seguir con el tablero táctil.");return;
                    }
                    setThree(!three);
                    setSheet(null);
                  }}
                >
                  <Glyph name="dice" />
                  {three ? "Usar tablero táctil" : "Explorar vista 3D"}
                  <span>{three ? "2D" : "3D"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onRefresh();
                    setSheet(null);
                  }}
                >
                  <Glyph name="wifi" />
                  {demo ? "Actualizar tablero" : "Volver a sincronizar"}<span>↻</span>
                </button>
              </div>
              {!demo && <p className="sheet-subtle">Las partidas caducan tras 24 horas sin jugadas. La clasificación no cambia.</p>}
              <p className="sheet-subtle">
                {labels[connection]}.{" "}
                {three
                  ? "La vista 3D consume más batería."
                  : "Toca o arrastra para elegir tus canicas."}
              </p>
              <button
                type="button"
                className="pocket-danger"
                onClick={() => (finished ? onExit() : setSheet("leave"))}
              >
                {demo ? "Reiniciar demo" : finished ? "Volver al lobby" : "Salir de la partida"}
              </button>
            </>
          ) : null}
          {sheet === "appearance" ? <AppearanceSettings preview={demo} /> : null}
          {sheet === "rules" && <p className="sheet-subtle"><strong>Avalancha:</strong> elige el inicio; baja por ambas ramas y cada hueco corta esa rama. <strong>Fantasma:</strong> elige una canica y retira también la viva más cercana a cada lado de su fila, atravesando huecos. <strong>Remolino:</strong> mezcla las posiciones de cada fila conservando sus vivas. Todos consumen un turno; retirar la última pierde.</p>}
          {sheet === "rules" && <p className="sheet-subtle"><strong>Tirada antigua:</strong> si sale en el dado, elige una canica viva y apunta con la línea de tiro. Mantén pulsado para cargar la barra, que cambia de velocidad, y suelta para lanzar. En móvil, mantén el dedo en la canica y arrastra para apuntar. Cada choque elimina la canica tocada y gasta fuerza; los bordes también frenan y hacen rebotar el tiro. La canica lanzada se retira al parar. Puedes ajustar la dirección y mantener Espacio para cargar con teclado. Cuenta como una sola jugada; retirar la última también pierde.</p>}
          {sheet === "rules" ? (
            <>
              <div className="rule-hero">
                La última canica
                <br />
                <strong>se la queda quien pierde.</strong>
              </div>
              <ol className="pocket-rules">
                <li>
                  <span>01</span>
                  <div>
                    <strong>Toca o desliza.</strong>
                    <p>
                      Selecciona canicas seguidas de una fila. El bloque nunca
                      salta un hueco.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Tú decides cuántas.</strong>
                    <p>
                      En la jugada 1, hasta 1; en la 2, hasta 2. Toca o desliza para ampliar el bloque y confirma abajo.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Guarda tu sorpresa.</strong>
                    <p>
                      Cada jugador tiene un dado de un solo uso. Lanzarlo
                      consume tu turno, también cuando queda una sola canica. La
                      partida continúa hasta que una jugada normal o el dado
                      retire la última: quien la retira pierde.
                    </p>
                  </div>
                </li>
              </ol>
              <button
                type="button"
                className="pocket-primary"
                onClick={() => setSheet(null)}
              >
                Vamos a jugar
                <Glyph name="arrow" />
              </button>
            </>
          ) : null}
          {sheet === "history" ? <MoveHistory game={game} /> : null}
          {sheet === "dice" ? (
            <div className="dice-panel" aria-busy={rolling}>
              <DiceCube
                rolling={rolling}
                power={
                  !rolling && !game.yourDiceAvailable
                    ? myDice?.power
                    : undefined
                }
                onRoll={
                  game.yourDiceAvailable || rolling
                    ? () => void dice()
                    : undefined
                }
                disabled={!canPlay || !game.yourDiceAvailable || rolling}
              />
              <p className="dice-kicker">
                {rolling
                  ? "EL AZAR TIENE LA PALABRA"
                  : game.yourDiceAvailable
                    ? "8 PODERES / UN SOLO USO"
                    : "DADO YA UTILIZADO"}
              </p>
              <h3 className="dice-heading">
                {rolling
                  ? "Lanzando…"
                  : !game.yourDiceAvailable
                    ? myDice
                      ? `${DICE_POWERS[myDice.power].name}.`
                      : "El azar ya habló."
                    : "Cambia la partida."}
              </h3>
              <p className="dice-explainer">
                {rolling
                  ? demo ? "El evento acompaña la tirada." : "Estamos confirmando el efecto con el servidor."
                  : !game.yourDiceAvailable
                    ? "Tu tirada queda guardada. Puedes volver a ver su efecto."
                    : !connected
                      ? "Esperamos a recuperar la conexión antes de lanzar."
                      : !myTurn
                        ? "Podrás tentar a la suerte cuando sea tu turno."
                        : "Tócalo o desliza hacia un lado para lanzarlo."}
              </p>
              {!rolling ? (
                <div className="power-cards">
                  {Object.entries(DICE_POWERS).map(([name, detail]) => (
                    <div key={name} className={`power-card power-${name}`}>
                      <PowerGlyph power={name as DiceResult["power"]} />
                      <div>
                        <strong>
                          {detail.name}
                          <small>12,5 %</small>
                        </strong>
                        <p>{detail.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dice-wait" role="status">
                  No cierres la partida. Una sola tirada.
                </p>
              )}
              {!rolling ? (
                <p className="dice-warning">
                  {!game.yourDiceAvailable
                    ? "Ya usaste tu única tirada en esta partida."
                    : !myTurn
                      ? "Podrás lanzarlo cuando sea tu turno."
                      : "Consume tu turno. Si se lleva la última canica, pierdes."}
                </p>
              ) : null}
              <button
                type="button"
                className="pocket-primary dice-launch"
                disabled={
                  rolling || (game.yourDiceAvailable ? !canPlay : !myDice)
                }
                onClick={() => {
                  if (!game.yourDiceAvailable && myDice) {
                    setPower(myDice);
                    setSheet("power");
                  } else void dice();
                }}
              >
                <Glyph name="dice" />
                <span>
                  {rolling
                    ? "Lanzando…"
                    : !game.yourDiceAvailable
                      ? myDice
                        ? "Ver mi tirada"
                        : "Dado usado"
                      : !myTurn
                        ? "Espera tu turno"
                        : "Lanzar mi dado"}
                </span>
              </button>
            </div>
          ) : null}
          {sheet === "power" && power ? (
            <div className="dice-panel power-result" data-power={power.power} style={{"--result-color":DICE_COLORS[power.power].dark,"--result-ink":DICE_COLORS[power.power].light} as React.CSSProperties}>
              <DiceCube power={power.power} />
              <p className="dice-kicker">PODER CONFIRMADO</p>
              <h3 className="dice-heading">{DICE_POWERS[power.power].name}</h3>
              <p className="dice-explainer">
                {DICE_POWERS[power.power].description}
              </p>
              {!power.pending && <div
                className={`power-impact ${power.power === "resurreccion" ? "is-revival" : ""}`}
              >
                <strong>
                  {power.power === "remolino" ? "↔" : power.power === "resurreccion" ? "+" : "−"}
                  {power.affected.length}
                </strong>
                <span>
                  {power.power==="remolino"?"posiciones cambiadas":`canica${power.affected.length===1?"":"s"} ${power.power==="resurreccion"?"devuelta":"eliminada"}${power.affected.length===1?"":"s"}`}
                </span>
              </div>}
              <p className="dice-warning">
                {power.pending && power.power!=="antigua" ? "Toca una canica viva, revisa las canicas marcadas y confirma. El turno se reserva hasta elegir tu objetivo. Quitar la última también pierde." : power.pending ? "Elige una canica viva y apunta con la línea. Mantén el clic o el dedo para cargar la fuerza y suelta para lanzar. Cada choque elimina la canica tocada y frena el tiro; al detenerse, la lanzada también se retira. Si quitas la última, pierdes." : power.affected.length
                  ? `Filas afectadas: ${Array.from(
                      new Set(power.affected.map((cell) => cell.row + 1)),
                    )
                      .sort((a, b) => a - b)
                      .join(", ")}. ${demo ? "El tablero está actualizado." : "El tablero ya está sincronizado."}`
                  : power.power==="remolino"?"No había filas con vivas y huecos que mezclar. El turno se ha consumido.":"No había canicas eliminadas que devolver. El turno se ha consumido igualmente."}
              </p>
              <button
                type="button"
                className="pocket-primary"
                onClick={() => setSheet(null)}
              >
                {power.pending ? power.power==="antigua"?"Preparar lanzamiento":"Elegir objetivo" : "Ver el tablero"} <Glyph name="arrow" />
              </button>
            </div>
          ) : null}
          {sheet === "leave" ? (
            <>
              <p className="sheet-subtle">
                {demo ? "Empezarás una demo nueva. Tu partida online y sus puntos se conservan." : waiting
                  ? "Se cerrará esta mesa y su invitación."
                  : "Tu rival ganará. Abandonar resta 18 puntos."}
              </p>
              <button
                type="button"
                className="pocket-primary"
                onClick={() => setSheet(null)}
              >
                Seguir jugando
              </button>
              <button
                type="button"
                className="pocket-danger"
                disabled={busy}
                onClick={() => void onLeave()}
              >
                {busy
                  ? "Saliendo…"
                  : demo ? "Empezar otra demo" : waiting
                    ? "Cancelar mesa"
                    : "Abandonar partida"}
              </button>
            </>
          ) : null}
        </Sheet>
      ) : null}
      {finished && !inspect ? (
        <MatchResult
          game={game}
          exitLabel={demo ? "Jugar otra demo" : undefined}
          onExit={onExit}
          onInspect={() => setInspect(true)}
          onToast={onToast}
        />
      ) : null}
    </div>
  );
}

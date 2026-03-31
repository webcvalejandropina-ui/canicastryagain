import { useEffect, useRef, useState } from 'react';

import { DiceResult, GameState } from '@/features/game/types';

type Props = {
  game: GameState;
  yourDiceAvailable: boolean;
  lastDiceResult?: DiceResult | null;
  onNewGame?: () => void;
};

const DICE_POWER_SVG: Record<string, React.ReactElement> = {
  bomba: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="14" r="8" fill="#374151" stroke="#9ca3af" strokeWidth="1.5"/>
      <circle cx="8" cy="11" r="1.5" fill="#9ca3af"/>
      <circle cx="14" cy="9" r="1" fill="#9ca3af"/>
      <rect x="10.5" y="3" width="3" height="5" rx="1.5" fill="#6b7280"/>
      <path d="M12 3 Q14 1 15.5 2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  rayo: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  diagonal: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6l4 4M10 4l6 6M18 6l-4 4" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 18l4-4M10 20l6-6M18 18l-4-4" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  resurreccion: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12M12 21v-3M18.36 18.36l-2.12-2.12M21 12h-3M18.36 5.64l-2.12 2.12" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="4" fill="#10b981" stroke="#34d399" strokeWidth="1.5"/>
    </svg>
  )
};

const DICE_POWER_COLORS: Record<string, string> = {
  bomba: 'text-red-500',
  rayo: 'text-yellow-500',
  diagonal: 'text-purple-500',
  resurreccion: 'text-emerald-500'
};

// Inline SVG spark icon — replaces ✨ emoji for consistency and accessibility
function SparkIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className ?? 'inline h-3.5 w-3.5'} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L9.5 9.5L2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function playerCardClass(isYou: boolean, isActiveTurn: boolean): string {
  return [
    'rounded-xl border p-4 transition-all duration-200',
    isYou ? 'border-primary/40 bg-primary/10' : 'border-brown/15 bg-sand/40 dark:border-white/10 dark:bg-dark-surface',
    isActiveTurn ? 'ring-1 ring-primary/60 shadow-glow dark:shadow-casino-card-dark' : ''
  ]
    .filter(Boolean)
    .join(' ');
}

export function GameInfoPanel({ game, yourDiceAvailable, lastDiceResult, onNewGame }: Props): React.ReactElement {
  const player1Name = game.player1?.name ?? 'Esperando...';
  const player2Name = game.player2?.name ?? 'Esperando...';

  const turnName = game.currentTurn === 1 ? player1Name : player2Name;
  const isMyTurn = game.yourPlayerNumber === game.currentTurn;

  // Animate the turn-status box when the turn changes to "you"
  const [turnPulse, setTurnPulse] = useState(false);
  const prevCanInteractRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (game.status !== 'playing') return;
    const prev = prevCanInteractRef.current;
    if (prev === null || prev === isMyTurn) {
      prevCanInteractRef.current = isMyTurn;
      return;
    }
    if (!prev && isMyTurn) {
      // Turn just switched to us — fire the pulse
      setTurnPulse(true);
      const t = setTimeout(() => setTurnPulse(false), 1800);
      prevCanInteractRef.current = isMyTurn;
      return () => clearTimeout(t);
    }
    prevCanInteractRef.current = isMyTurn;
  }, [isMyTurn, game.status]);

  const turnText =
    game.status === 'waiting'
      ? 'Esperando a un segundo jugador...'
      : game.status === 'finished'
        ? `Partida finalizada. Ganador: ${game.winner === 1 ? player1Name : player2Name}`
        : isMyTurn
          ? `Tu turno · ${turnName}`
          : `Turno de ${turnName}`;

  const totalBalls = game.rows.reduce(
    (sum, row) => sum + row.reduce((rowSum, cell) => rowSum + (cell === 1 ? 1 : 0), 0),
    0
  );
  // Initial ball count for a triangular board: sum of 1..numRows = numRows*(numRows+1)/2
  const initialBalls = (game.numRows * (game.numRows + 1)) / 2;
  const ballProgress = initialBalls > 0 ? (totalBalls / initialBalls) * 100 : 100;
  const turnLimit = game.moveHistory.length + 1;
  const takenRows = new Set(game.moveHistory.map((move) => move.rowIndex)).size;

  return (
    <section className="glass-panel rounded-2xl p-5 md:p-6" aria-live="polite" role="status">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <article className={playerCardClass(game.yourPlayerNumber === 1, game.currentTurn === 1)}>
          <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Jugador 1
          </div>
          <p className="mt-3 text-xl font-bold tracking-tight text-brown dark:text-dark-text">{player1Name}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brown/80 dark:text-dark-muted">{game.yourPlayerNumber === 1 ? 'Tú' : 'Rival'}</p>
        </article>

        <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-brown/20 bg-sand/50 text-xs font-bold tracking-[0.18em] text-brown/70 dark:border-white/15 dark:bg-dark-surface dark:text-dark-muted md:flex">
          VS
        </div>

        <article className={playerCardClass(game.yourPlayerNumber === 2, game.currentTurn === 2)}>
          <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Jugador 2
          </div>
          <p className="mt-3 text-xl font-bold tracking-tight text-brown dark:text-dark-text">{player2Name}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brown/80 dark:text-dark-muted">{game.yourPlayerNumber === 2 ? 'Tú' : 'Rival'}</p>
        </article>
      </div>

      {game.status === 'finished' ? (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brown dark:text-dark-muted">Resultado</p>
          {game.winner ? (
            <div className="mt-2 flex items-center justify-center gap-2">
              {game.winner === game.yourPlayerNumber ? (
                <svg aria-hidden="true" className="h-7 w-7 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L9 9H2L7.5 13.5L5.5 21L12 16.5L18.5 21L16.5 13.5L22 9H15L12 2Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
                  <rect x="9" y="16" width="6" height="3" rx="0.5" fill="#f59e0b"/>
                  <rect x="7" y="18.5" width="10" height="2" rx="0.5" fill="#d97706"/>
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="4" stroke="#94a3b8" strokeWidth="1.75" fill="none"/>
                  <path d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20" stroke="#94a3b8" strokeWidth="1.75" strokeLinecap="round"/>
                </svg>
              )}
              <p className="text-lg font-bold text-brown dark:text-dark-text">
                {game.winner === 1 ? player1Name : player2Name}
              </p>
            </div>
          ) : null}
          <p className={`mt-1 text-sm font-semibold ${game.winner === game.yourPlayerNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {game.winner
              ? game.winner === game.yourPlayerNumber
                ? '¡Victoria!'
                : 'Derrota. ¡Ánimo, la revancha está cerca!'
              : 'Partida terminada sin ganador'}
          </p>
          {onNewGame ? (
            <button
              type="button"
              onClick={onNewGame}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#4a3f32] shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.97]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="12" cy="16" rx="6" ry="7" fill="#f4c542" stroke="#d4a82e" strokeWidth="1.25"/>
                <path d="M8 14c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5" stroke="#d4a82e" strokeWidth="1.25" strokeLinecap="round"/>
                <path d="M7 14c0-3 2-5 5-5s5 2 5 5" stroke="#d4a82e" strokeWidth="1.25" strokeLinecap="round"/>
                <path d="M9 9.5c0-1.5 1.5-3 3-3s3 1.5 3 3" stroke="#5c8d3a" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 8.5Q11 6 12 7Q13 5 14 7" stroke="#5c8d3a" strokeWidth="1.25" strokeLinecap="round" fill="none"/>
                <path d="M6 12c-1.5-0.5-2.5-2-2-3.5" stroke="#5c8d3a" strokeWidth="1.25" strokeLinecap="round" fill="none"/>
                <path d="M18 12c1.5-0.5 2.5-2 2-3.5" stroke="#5c8d3a" strokeWidth="1.25" strokeLinecap="round" fill="none"/>
              </svg>
              Nueva partida
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className={[
            'mt-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-center',
            'transition-all duration-200',
            turnPulse ? 'turn-info-pulse' : ''
          ].join(' ')}
        >
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-primary">Estado de turno</p>
          <p className="mt-1 text-base font-semibold text-brown dark:text-dark-text md:text-lg">{turnText}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-brown/20 bg-sand/50 p-3 text-center dark:border-white/10 dark:bg-dark-surface">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brown/70 dark:text-dark-muted">Canicas restantes</p>
          <p className="mt-1 text-2xl font-bold text-brown dark:text-dark-text">{totalBalls}</p>
          {/* Progress bar: visualises how many balls remain vs the starting total */}
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brown/15 dark:bg-white/10"
            role="progressbar"
            aria-valuenow={totalBalls}
            aria-valuemin={0}
            aria-valuemax={initialBalls}
            aria-label={`${totalBalls} de ${initialBalls} canicas restantes`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-leaf to-primary transition-all duration-500 ease-out"
              style={{ width: `${ballProgress}%` }}
            />
          </div>
          <p className="mt-1 text-[9px] text-brown/50 dark:text-dark-muted">{initialBalls} inicial</p>
        </div>
        <div className="rounded-xl border border-brown/20 bg-sand/50 p-3 text-center dark:border-white/10 dark:bg-dark-surface">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brown/70 dark:text-dark-muted">Límite de turno</p>
          <p className="mt-1 text-sm font-semibold text-primary">
            Hasta {turnLimit} canica{turnLimit > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-brown/20 bg-sand/50 p-3 text-center dark:border-white/10 dark:bg-dark-surface">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brown/70 dark:text-dark-muted">Filas tomadas</p>
          <p className="mt-1 text-sm font-semibold text-leaf dark:text-leaf-soft">{takenRows}</p>
        </div>
        <div className="rounded-xl border border-brown/20 bg-sand/50 p-3 text-center dark:border-white/10 dark:bg-dark-surface">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brown/70 dark:text-dark-muted">Última fila jugada</p>
          <p className="mt-1 text-sm font-semibold text-primary">
            {game.lastTouchedRowIndex !== null ? `Fila ${game.lastTouchedRowIndex + 1}` : 'Sin jugadas'}
          </p>
        </div>
      </div>

      {game.status === 'playing' ? (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">Tu dado especial</p>
            {yourDiceAvailable ? (
              <p className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                <SparkIcon /> Disponible
              </p>
            ) : lastDiceResult ? (
              <p className="dice-result-pop mt-1 flex items-center justify-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                {DICE_POWER_SVG[lastDiceResult.power] ?? lastDiceResult.power}
              </p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-brown/50 dark:text-dark-muted">— Gastado</p>
            )}
          </div>
          <div className="h-8 w-px bg-amber-500/20" />
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">Dado del rival</p>
            {(() => {
              const rivalDiceMove = [...game.moveHistory].reverse().find((m) => m.fromDice && m.player !== game.yourPlayerNumber);
              return rivalDiceMove ? (
                <p className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {DICE_POWER_SVG[rivalDiceMove.dicePower ?? ''] ?? rivalDiceMove.dicePower ?? '—'}
                </p>
              ) : (
                <p className="mt-1 text-sm font-semibold text-brown/50 dark:text-dark-muted">Sin uso</p>
              );
            })()}
          </div>
        </div>
      ) : null}

      {game.moveHistory.length > 0 && game.status !== 'finished' && (
        <div className="mt-3 rounded-xl border border-brown/15 bg-sand/30 p-3 dark:border-white/8 dark:bg-dark-surface/60">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-brown/60 dark:text-dark-muted">
            Historial
          </p>
          <div
            className="flex flex-col gap-1.5 max-h-28 overflow-y-auto custom-scrollbar"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(140,98,57,0.3) rgba(0,0,0,0.05)' }}
          >
            {game.moveHistory.slice(-10).map((move, i) => {
              const isYou = move.player === game.yourPlayerNumber;
              const moveNum = Math.max(0, game.moveHistory.length - 10) + i + 1;
              const actorLabel = isYou ? 'Tú' : `J${move.player}`;
              const actorClass = isYou
                ? 'shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary'
                : 'shrink-0 rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[9px] font-bold text-slate-500';

              const detail = move.fromDice ? (
                <span className={`text-[10px] font-semibold ${DICE_POWER_COLORS[move.dicePower ?? ''] ?? 'text-amber-500'}`}>
                  {DICE_POWER_SVG[move.dicePower ?? ''] ?? move.dicePower}
                </span>
              ) : (
                <span className="text-[10px] text-brown/70 dark:text-dark-muted">
                  −{move.count} <span className="text-[9px]">fila {move.rowIndex + 1}</span>
                </span>
              );

              return (
                <div key={`${moveNum}-${i}`} className="flex items-center gap-2 text-[11px]">
                  <span className={actorClass}>{actorLabel}</span>
                  <span className="text-[9px] text-slate-400/70 dark:text-slate-500">#{moveNum}</span>
                  {detail}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

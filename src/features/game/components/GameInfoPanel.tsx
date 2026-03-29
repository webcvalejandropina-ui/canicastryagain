import { DiceResult, GameState } from '@/features/game/types';

type Props = {
  game: GameState;
  yourDiceAvailable: boolean;
  lastDiceResult?: DiceResult | null;
  onNewGame?: () => void;
};

const DICE_POWER_LABELS: Record<string, string> = {
  bomba: '💣',
  rayo: '⚡',
  diagonal: '⚔️',
  resurreccion: '✨'
};

const DICE_POWER_COLORS: Record<string, string> = {
  bomba: 'text-red-500',
  rayo: 'text-yellow-500',
  diagonal: 'text-purple-500',
  resurreccion: 'text-emerald-500'
};

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
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary/70">Resultado</p>
          {game.winner ? (
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-2xl">{game.winner === game.yourPlayerNumber ? '🏆' : '👤'}</span>
              <p className="text-lg font-bold text-brown dark:text-dark-text">
                {game.winner === 1 ? player1Name : player2Name}
              </p>
            </div>
          ) : null}
          <p className="mt-1 text-sm font-semibold text-primary">
            {game.winner
              ? game.winner === game.yourPlayerNumber
                ? '¡Victoria! 🎉'
                : 'Derrota. ¡Ánimo, la revancha está cerca!'
              : 'Partida terminada sin ganador'}
          </p>
          {onNewGame ? (
            <button
              type="button"
              onClick={onNewGame}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/20 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-primary shadow-sm transition hover:bg-primary/30 active:scale-[0.97]"
            >
              <span aria-hidden="true">🍍</span>
              Nueva partida
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-primary">Estado de turno</p>
          <p className="mt-1 text-base font-semibold text-brown dark:text-dark-text md:text-lg">{turnText}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-brown/20 bg-sand/50 p-3 text-center dark:border-white/10 dark:bg-dark-surface">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brown/70 dark:text-dark-muted">Canicas restantes</p>
          <p className="mt-1 text-2xl font-bold text-brown dark:text-dark-text">{totalBalls}</p>
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
                <span aria-hidden="true">✨</span> Disponible
              </p>
            ) : lastDiceResult ? (
              <p className="dice-result-pop mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                {DICE_POWER_LABELS[lastDiceResult.power] ?? lastDiceResult.power}
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
                <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {DICE_POWER_LABELS[rivalDiceMove.dicePower ?? ''] ?? rivalDiceMove.dicePower ?? '—'}
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
          <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto">
            {game.moveHistory.slice(-10).map((move, i) => {
              const isYou = move.player === game.yourPlayerNumber;
              const moveNum = Math.max(0, game.moveHistory.length - 10) + i + 1;
              const actorLabel = isYou ? 'Tú' : `J${move.player}`;
              const actorClass = isYou
                ? 'shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary'
                : 'shrink-0 rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[9px] font-bold text-slate-500';

              const detail = move.fromDice ? (
                <span className={`text-[10px] font-semibold ${DICE_POWER_COLORS[move.dicePower ?? ''] ?? 'text-amber-500'}`}>
                  {DICE_POWER_LABELS[move.dicePower ?? ''] ?? move.dicePower}
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

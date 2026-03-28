import { GameState } from '@/features/game/types';

type Props = {
  game: GameState;
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

export function GameInfoPanel({ game }: Props): React.ReactElement {
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

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-primary">Estado de turno</p>
        <p className="mt-1 text-base font-semibold text-brown dark:text-dark-text md:text-lg">{turnText}</p>
      </div>

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
    </section>
  );
}

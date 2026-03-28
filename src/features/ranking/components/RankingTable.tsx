import { RankingEntry } from '@/features/game/types';

type Props = {
  rankings: RankingEntry[];
};

export function RankingTable({ rankings }: Props): React.ReactElement {
  if (rankings.length === 0) {
    return <p className="text-sm text-brown/70 dark:text-dark-muted">No hay rankings todavía.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brown/20 dark:border-white/15">
      <table className="min-w-[520px] w-full text-sm">
        <thead>
          <tr className="bg-primary/20 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-brown dark:text-dark-text">
            <th className="px-3 py-3">#</th>
            <th className="px-3 py-3">Jugador</th>
            <th className="px-3 py-3 text-center">Pts</th>
            <th className="px-3 py-3 text-center">V</th>
            <th className="px-3 py-3 text-center">D</th>
            <th className="px-3 py-3 text-center">WR</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((entry, index) => (
            <tr key={entry.playerId} className="border-t border-brown/15 bg-sand/30 text-brown even:bg-sand/50 dark:border-white/10 dark:bg-dark-surface dark:text-dark-text dark:even:bg-dark-card">
              <td className="px-3 py-3 font-bold text-brown dark:text-dark-text">{index + 1}</td>
              <td className="px-3 py-3 font-semibold">{entry.playerName}</td>
              <td className={`px-3 py-3 text-center font-bold ${entry.score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {entry.score > 0 ? '+' : ''}{entry.score}
              </td>
              <td className="px-3 py-3 text-center">{entry.wins}</td>
              <td className="px-3 py-3 text-center">{entry.losses}</td>
              <td className="px-3 py-3 text-center font-semibold text-primary">{entry.winRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

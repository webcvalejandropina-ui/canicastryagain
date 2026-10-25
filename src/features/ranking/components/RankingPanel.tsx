import type {RankingEntry} from '@/features/game/types';
import {RankingTable} from './RankingTable';
export function RankingPanel({rankings,loading,error,onRefresh,currentPlayerId}:{rankings:RankingEntry[];loading:boolean;error?:string|null;onRefresh:()=>Promise<void>;currentPlayerId?:string}):React.ReactElement{
 return <section id="ranking" className="leaderboard" aria-labelledby="leaderboard-title" aria-busy={loading}>
  <header className="leaderboard-header"><div><p>EL CLUB / TOP 10</p><h3 id="leaderboard-title">Las buenas jugadas<br/><em>dejan huella.</em></h3></div><button type="button" className="leaderboard-refresh" onClick={()=>void onRefresh()} disabled={loading} aria-label={loading?'Actualizando clasificación':'Actualizar clasificación'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg><span>{loading?'Actualizando…':'Actualizar'}</span></button></header>
  <p className="leaderboard-intro">Un duelo, una revancha y un puesto por conquistar. Aquí cuentan las partidas terminadas.</p>
  {error&&<p className="leaderboard-error" role="alert">{error} Puedes volver a intentarlo con «Actualizar».</p>}
  {loading&&!rankings.length?<div className="leaderboard-loading" role="status"><span/><p>Preparando la clasificación…</p></div>:error&&!rankings.length?null:<RankingTable rankings={rankings} currentPlayerId={currentPlayerId}/>}
 </section>;
}

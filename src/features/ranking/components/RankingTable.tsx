import Image from 'next/image';
import {Fragment} from 'react';
import type {RankingEntry} from '@/features/game/types';

type Props={rankings:RankingEntry[];currentPlayerId?:string};
const points=new Intl.NumberFormat('es-ES');
const percent=new Intl.NumberFormat('es-ES',{maximumFractionDigits:1});
function Score({value}:{value:number}){return <span className="leaderboard-score" data-negative={value<0}><strong>{points.format(value)}</strong><small>puntos</small></span>;}
function PlayerName({value}:{value:string}){return <>{value.split('_').map((part,index)=><Fragment key={index}>{index>0&&<>_<wbr/></>}{part}</Fragment>)}</>;}
function Stats({entry}:{entry:RankingEntry}){return <span className="leaderboard-stats"><span>{entry.wins} <span>{entry.wins===1?'victoria':'victorias'}</span></span><span aria-hidden="true">·</span><span>{entry.games} <span>{entry.games===1?'partida':'partidas'}</span></span><span className="leaderboard-rate">{percent.format(Number(entry.winRate))}% <span>victorias</span></span></span>;}
export function RankingTable({rankings,currentPlayerId}:Props):React.ReactElement{
 const entries=rankings.slice(0,10),self=rankings.findIndex(entry=>entry.playerId===currentPlayerId);
 if(!entries.length)return <div className="leaderboard-empty"><Image unoptimized src="/glass/crystal.aaf794a68863.webp" alt="" width={76} height={76}/><h4>La primera historia está por jugar.</h4><p>Termina una partida para estrenar la clasificación.<br/>Cada victoria cuenta; cada revancha, también.</p><a href="#inicio">A por la primera ↗</a></div>;
 return <>
  {currentPlayerId&&<p className="leaderboard-personal">{self>=0?<><span>Tu posición</span><strong>#{self+1}</strong><span>{points.format(rankings[self].score)} puntos</span></>:<span>Sigue jugando para subir en la clasificación.</span>}</p>}
  <ol className="leaderboard-podium" aria-label="Los tres primeros">
   {entries.slice(0,3).map((entry,index)=><li key={entry.playerId} className="leaderboard-finalist" data-rank={index+1} data-self={entry.playerId===currentPlayerId}>
    <div className="leaderboard-place"><span>0{index+1}</span>{index===0?<svg aria-label="Líder de la clasificación" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 6 5 4 4-6 4 6 5-4-2 12H5L3 6Z"/><path d="M6 21h12"/></svg>:<small>{index===1?'Segundo':'Tercero'}</small>}</div>
    <div className="leaderboard-orb" aria-hidden="true"><Image unoptimized src="/glass/crystal.aaf794a68863.webp" alt="" width={80} height={80}/></div>
    <h4><PlayerName value={entry.playerName}/>{entry.playerId===currentPlayerId&&<span className="leaderboard-you">Tú</span>}</h4>
    <Score value={entry.score}/><p>{entry.wins} {entry.wins===1?'victoria':'victorias'} <span>· {entry.games} {entry.games===1?'partida':'partidas'}</span></p>
   </li>)}
  </ol>
  {entries.length>3&&<><div className="leaderboard-list-heading"><span>La clasificación</span><span>Puntos</span></div><ol className="leaderboard-list" start={4} aria-label="Del cuarto al décimo puesto">
   {entries.slice(3).map((entry,index)=><li key={entry.playerId} data-self={entry.playerId===currentPlayerId}>
    <span className="leaderboard-rank" aria-label={`Puesto ${index+4}`}>{String(index+4).padStart(2,'0')}</span>
    <div className="leaderboard-player"><h4><PlayerName value={entry.playerName}/>{entry.playerId===currentPlayerId&&<span className="leaderboard-you">Tú</span>}</h4><Stats entry={entry}/></div><Score value={entry.score}/>
   </li>)}
  </ol></>}
  <p className="leaderboard-footnote">Orden por puntos. En empate: victorias, porcentaje de victorias y partidas jugadas.</p>
 </>;
}

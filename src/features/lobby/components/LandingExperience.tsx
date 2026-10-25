'use client';

import { useEffect, useState } from 'react';
import { CanicasBrand } from '@/features/brand/components/CanicasBrand';
import { RankingPanel } from '@/features/ranking/components/RankingPanel';
import { useRankings } from '@/features/ranking/hooks/useRankings';
import { InstallAppButton } from '@/features/pwa/PwaProvider';
import { ParallaxWorld } from '@/features/appearance/ParallaxWorld';
import { useAppearance } from '@/features/appearance/AppearanceProvider';
import { AppearanceButton } from '@/features/appearance/AppearanceSettings';
import { SeasonalDetail } from '@/features/appearance/SeasonalDetail';

type Props = {
  alias: string;
  onAliasChange: (value: string) => void;
  onLogin: () => void;
  invited: boolean;
};

const lessons = [
  { number: '01', title: 'Una fila. Tu decisión.', text: 'Retira un bloque de canicas consecutivas de una sola fila. En la primera jugada puedes quitar 1; en la segunda, hasta 2; y así sucesivamente.' },
  { number: '02', title: 'Guarda un as bajo la manga.', text: 'Tienes un dado especial de un solo uso. El momento de lanzarlo puede cambiar toda la partida.' },
  { number: '03', title: 'La última no es para ti.', text: 'Evita retirar la última canica del tablero. Si aún te queda el dado, puedes usarlo también en el último turno.' }
];

function LobbyLandscape():React.ReactElement|null {
  const {season,preferences}=useAppearance();
  return preferences.landscape==='plain'?null:<ParallaxWorld season={season}/>;
}

export function MarblePreview(): React.ReactElement {

  const [selected, setSelected] = useState<number[]>([]);
  const [row, setRow] = useState<number | null>(null);

  function select(r: number, c: number): void {
    if (r !== row) {
      setRow(r);
      setSelected([c]);
      return;
    }
    if (selected.includes(c) && selected.length === 1) {
      setSelected([]);
      return;
    }
    const start = Math.min(selected[0] ?? c, c);
    const end = Math.max(selected[0] ?? c, c);
    setSelected(Array.from({ length: end - start + 1 }, (_, i) => start + i));
  }

  return (
    <div className="marble-preview">
      <div className="preview-topline"><span><i /> Tu próxima buena jugada</span><span>01 / 03</span></div>
      <div className="preview-board" role="group" aria-label="Demostración de selección de canicas">
        {[1, 3, 5, 7].map((count, r) => (
          <div className="preview-row" key={r}>
            <span className="preview-row-number" aria-hidden="true">0{r + 1}</span>
            <div className="preview-balls">
              {Array.from({ length: count }, (_, c) => (
                <button type="button" key={c} aria-label={`Seleccionar canica ${c + 1} de la fila ${r + 1}`} aria-pressed={row === r && selected.includes(c)} onClick={() => select(r, c)} className={`preview-marble marble-tone-${r} ${row === r && selected.includes(c) ? 'is-selected' : ''}`}><SeasonalDetail variant={r+c} /></button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="preview-bottomline"><span aria-live="polite">{selected.length ? `${selected.length} canica${selected.length === 1 ? '' : 's'} seleccionada${selected.length === 1 ? '' : 's'}` : 'Toca las canicas. Traza tu estrategia.'}</span><button type="button" disabled={!selected.length} onClick={() => { setSelected([]); setRow(null); }} aria-label="Limpiar selección">↺</button></div>
      <div className="preview-note"><span>↗</span> Un juego sencillo. Una revancha inevitable.</div>
    </div>
  );
}

export function LandingExperience({ alias, onAliasChange, onLogin, invited }: Props): React.ReactElement {
  const {rankings,loading:rankingLoading,error:rankingError,fetchRankings}=useRankings();
  useEffect(()=>{void fetchRankings();},[fetchRankings]);
  return (
    <div className="landing-experience relative z-10">
      <a className="skip-link" href="#player-name-input">Saltar a jugar</a>
      <header className="landing-header">
        <CanicasBrand/>
        <nav aria-label="Navegación principal"><a href="#reglas">Cómo se juega <span>↗</span></a><a href="#ranking">La competición <span>↗</span></a></nav>
        <AppearanceButton /><a href="#player-name-input" className="header-play">Vamos a jugar <span>↗</span></a>
      </header>
      <main id="inicio">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span /> PARA DOS. PARA PICARSE. PARA REPETIR.</p>
            <h1 id="hero-title">Pequeñas canicas.<br />Grandes <em>piques.</em></h1>
            <p className="hero-description">Un duelo de ingenio entre amigos. Retira canicas, piensa tu siguiente movimiento y recuerda: <strong>quien se lleva la última, pierde.</strong></p>
            <div className="hero-facts"><span>2 jugadores</span><span>En tiempo real</span><span>100% gratis</span></div>
            <form className="landing-login" onSubmit={(event) => { event.preventDefault(); onLogin(); }}>
              <label htmlFor="player-name-input">{invited ? 'TE HAN RETADO. ACEPTA EL DESAFÍO.' : 'LA MESA ESTÁ LISTA. SOLO FALTAS TÚ.'}</label>
              <div className="login-field"><span aria-hidden="true">☺</span><input id="player-name-input" name="alias" value={alias} onChange={(event) => onAliasChange(event.target.value)} maxLength={32} autoComplete="nickname" required placeholder="¿Cómo te llamamos?" /><button type="submit" aria-label="Entrar al lobby">A jugar <span>↗</span></button></div>
              <p>Elige tu alias y protege tu cuenta con una contraseña.</p>
            </form>
            <div className="landing-install"><InstallAppButton /></div>
          </div>
          <div className="hero-art"><LobbyLandscape/><div className="art-orbit" aria-hidden="true" /><div className="art-stamp" aria-hidden="true">MENOS SUERTE<br /><span>MÁS CABEZA</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg></div><MarblePreview /><div className="art-caption"><span>EL CLÁSICO, CON UN GIRO.</span><span>♪ Buen rollo incluido</span></div></div>
        </section>
        <div className="landing-divider"><span>FÁCIL DE APRENDER. DIFÍCIL DE DEJAR.</span><span aria-hidden="true">↓</span><span>UNA MÁS Y LO DEJO.</span></div>
        <section id="reglas" className="landing-rules" aria-labelledby="rules-title"><div className="rules-intro"><p className="eyebrow">EL PLAN DE JUEGO</p><h2 id="rules-title">Tres claves.<br />Mil estrategias.</h2><p>Sin tutoriales eternos.<br />Aprende lo esencial y entra al tablero.</p></div><div className="lesson-grid">{lessons.map((lesson) => <article className="lesson" key={lesson.number}><span className="lesson-number">{lesson.number}</span><h3>{lesson.title}</h3><p>{lesson.text}</p></article>)}</div><details className="full-rules"><summary>Los detalles que hacen una buena jugada <span>+</span></summary><ul><li>Elige canicas consecutivas de una sola fila, sin saltarte huecos. Puedes empezar por cualquier punto del bloque.</li><li>El máximo permitido coincide con el número de jugada global, compartido entre ambos jugadores.</li><li>Selecciona las canicas y confirma con Aplicar. Puedes corregir tu selección antes de enviarla.</li><li>Puedes repetir la última fila utilizada mientras queden canicas; el bloque seleccionado no puede saltar huecos.</li><li>Cada jugador tiene un dado especial de un solo uso. Lanzarlo también cuenta como jugada.</li><li>Quien retira la última canica pierde, tanto con una jugada normal como con el dado. Dejar una sola canica no termina la partida: el rival todavía puede jugar o usar su dado.</li></ul></details></section>
        <RankingPanel rankings={rankings} loading={rankingLoading} error={rankingError} onRefresh={fetchRankings}/>

      </main>
      <footer className="landing-footer"><span>canicas <strong>try again.</strong></span><p>Hecho para jugar. Y volver a jugar.</p><span>© 2026 · Buen rollo siempre ↗</span></footer>
    </div>
  );
}

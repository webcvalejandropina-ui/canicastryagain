"use client";
import { BirthdayFields } from "@/features/session/BirthdayFields";
import type { Birthday } from "@/shared/birthday";
import { useEffect, useRef, useState } from "react";
import {
  SEASON_LABELS,
  EVENT_CALENDAR,
  eventForSeason,
  type ColorPreference,

} from "./appearance";
import { useAppearance } from "./AppearanceProvider";
import { SCENERIES, DEFAULT_SCENERY, type SceneryId } from "./sceneries";
import { WorldPicker } from "./WorldPicker";
import { worldFor } from "./worlds";
import { SeasonalDetail } from "./SeasonalDetail";

export function AppearanceSettings({preview = false}: {preview?: boolean}): React.ReactElement {
  const { preferences, season, theme, update, events, occasion, registered, accountBirthday, saveBirthday } = useAppearance();
  const [birthdayBusy,setBirthdayBusy]=useState(false);
  const [birthdayError,setBirthdayError]=useState('');
  const changeBirthday=async(value:Birthday|null)=>{
    setBirthdayBusy(true);setBirthdayError('');
    try{await saveBirthday(value);}catch(error){setBirthdayError(error instanceof Error?error.message:'No se pudo guardar');}finally{setBirthdayBusy(false);}
  };
  const activeEvent = eventForSeason(season);
  const choose: typeof update = (patch) => update(patch, !preview);
  const world = worldFor(season);
  const manual = preferences.season !== "auto" && preferences.season !== "none";
  return (
    <div className="appearance-settings">
      <fieldset>
        <legend>Color de la interfaz</legend>
        <div className="appearance-colors">
          {(
            [
              ["system", "Sistema"],
              ["light", "Claro"],
              ["dark", "Oscuro"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={preferences.color === value}
              onClick={() => choose({ color: value as ColorPreference })}
            >
              <span
                className={`appearance-swatch swatch-${value}`}
                aria-hidden="true"
              />
              {label}
            </button>
          ))}
        </div>
        <p>
          {preview ? "Vista previa de la demo. Tus ajustes guardados se conservan." : preferences.color === "system"
            ? `Sigue tu dispositivo. Ahora está en modo ${theme === "light" ? "claro" : "oscuro"}.`
            : "Tu elección se recuerda en este navegador."}
        </p>
      </fieldset>
      <fieldset>
        <legend>Tu pequeño mundo</legend>
        <div
          className="event-mode-options"
          role="group"
          aria-label="Modo de eventos"
        >
          <button
            type="button"
            aria-pressed={preferences.season === "auto"}
            onClick={() => choose({ season: "auto",backgroundPolicy:"auto" })}
          >
            <strong>Automático</strong>
            <span>Sigue el calendario</span>
          </button>
        </div>
        <WorldPicker preview={preview}/>
        <label className="occasion-location">Fiestas de tu localidad<select value={preferences.area??''} onChange={e=>choose({area:e.target.value})}><option value="">Solo celebraciones generales</option>{Array.from(new Set(events.map(e=>e.area).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es')).map(area=><option key={area} value={area}>{area}</option>)}</select></label>
        <p>Opcional. No usamos tu ubicación. En Automático verás las fiestas programadas de la localidad que elijas.</p>
        <div
          className="appearance-preview"
          aria-live="polite"
          aria-label={`Vista previa: ${SEASON_LABELS[season]}`}
        >
          <span className="appearance-preview-orb">
            <SeasonalDetail variant={0} />
          </span>
          <div>
            <strong>
              {occasion || (season === "birthday" ? "¡Feliz cumpleaños!" : world.label)}
            </strong>
            <p>
              {preferences.season === "none"
                ? "Tu escenario habitual, sin eventos. Puedes dejar el fondo liso más abajo."
                : season === "birthday" && !manual ? "Celebramos tu cumpleaños durante tres días, con canicas decoradas y un dado de fiesta." : manual
                  ? "Evento elegido manualmente. Activa Automático para volver al calendario."
                  : occasion ? "Celebración programada. Al terminar, el aspecto cambia automáticamente." : activeEvent
                    ? `Activo por fecha · ${activeEvent.dates}. Al terminar, el aspecto cambia automáticamente.`
                    : "No hay ningún evento activo. El siguiente se activará por su fecha."}
            </p>
          </div>
        </div>
        <details className="event-calendar">
          <summary>Calendario anual</summary>
          <p>
            Las fiestas anuales se repiten. Las ediciones con año caducan. El administrador puede ampliar este calendario; se usa la fecha de España peninsular.
          </p>
          <ol>
            {(events.length ? events.filter(e=>['summer','halloween','christmas'].includes(e.id)).map(e=>({id:e.world,label:e.title,dates:`${e.start} – ${e.end}`})) : EVENT_CALENDAR).map(event=><li key={event.id}><strong>{event.label}</strong><span>{event.dates}</span></li>)}
          </ol>
          <ol>{events.filter(e=>!e.area||e.area===preferences.area).filter(e=>!['summer','halloween','christmas'].includes(e.id)).map(e=><li key={e.id}><strong>{e.title}</strong><span>{e.start} – {e.end}{e.recurrence==='annual'?' · anual':''}</span></li>)}</ol>
        </details>

      </fieldset>
      <fieldset className="background-preferences">
        <legend>El fondo lo eliges tú</legend>
        <label>Tu escenario habitual<select aria-label="Escenario habitual" value={preferences.scenery??DEFAULT_SCENERY} onChange={e=>choose({scenery:e.target.value as SceneryId})}>
          {Object.entries(SCENERIES).filter(([id])=>id!=='holy-week').map(([id,place])=><option key={id} value={id}>{place.label}{id===DEFAULT_SCENERY?' · principal':''}</option>)}
        </select></label>
        <p>Sin celebraciones se usa este paisaje. En Automático, cumpleaños y eventos tienen su propio fondo; puedes conservar siempre tu escenario habitual.</p>
        <label>Qué fondos quieres ver<select aria-label="Preferencia de fondos" value={preferences.backgroundPolicy??'auto'} onChange={e=>choose({backgroundPolicy:e.target.value as 'auto'|'calendar'|'original',season:'auto'})}>
          <option value="auto">Calendario y fondos del administrador</option><option value="calendar">Solo el calendario · sin personalizaciones</option><option value="original">Conservar siempre mi escenario habitual</option>
        </select></label>
        <label>Ambiente<select aria-label="Animaciones ambientales" value={preferences.weather??'auto'} onChange={e=>choose({weather:e.target.value as 'auto'|'none'|'rain'|'snow'|'fireflies'})}>
          <option value="auto">Según la estación · automático</option><option value="none">Sin efectos ambientales</option><option value="rain">Lluvia suave</option><option value="snow">Nieve ligera</option><option value="fireflies">Luciérnagas</option>
        </select></label>
        <p>En invierno puede llover; en Navidad, nevar. Puedes desactivarlo. El fondo estático y el movimiento reducido también detienen estos efectos.</p>
      </fieldset>
      <fieldset>
        <legend>Fondo del tablero</legend>
        <div className="landscape-options" role="group" aria-label="Movimiento del fondo">
          {([ ["parallax", "Con profundidad"], ["still", "Estático"], ["plain", "Liso"] ] as const).map(([value,label]) =>
            <button type="button" key={value} aria-pressed={(preferences.landscape ?? "parallax") === value} onClick={() => choose({landscape:value})}>{label}</button>
          )}
        </div>
        <p>El paisaje nunca mueve las canicas. Si tu dispositivo reduce el movimiento, el fondo permanece quieto.</p>
      </fieldset>
      <details className="birthday-settings">
        <summary>Tu cumpleaños</summary>
        {registered?<BirthdayFields value={accountBirthday} disabled={birthdayBusy} onChange={value=>void changeBirthday(value)}/>:<p>Inicia sesión o regístrate para guardar tu día y mes y activar los tres días de cumpleaños. Una fecha antigua guardada solo en el navegador no activa esta celebración.</p>}
        {birthdayBusy&&<p role="status">Guardando en tu cuenta…</p>}
        {birthdayError&&<p role="alert">{birthdayError}</p>}
        <p>Se guarda en tu cuenta y se recupera al iniciar sesión en otro dispositivo. Tiene prioridad sobre otros eventos en Automático; Normal o conservar tu fondo habitual lo desactivan.</p>
      </details>
    </div>
  );
}
export function AppearanceButton(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="appearance-trigger"
        aria-label="Cambiar aspecto"
        onClick={() => setOpen(true)}
      >
        <AppearanceIcon />
      </button>
      {open ? (
        <dialog
          ref={dialog}
          className="appearance-dialog"
          aria-labelledby="appearance-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <header>
            <h2 id="appearance-title">A tu manera.</h2>
            <button type="button" aria-label="Cerrar aspecto" onClick={close}>
              ×
            </button>
          </header>
          <AppearanceSettings />
          <button type="button" className="appearance-done" onClick={close}>
            Listo
          </button>
        </dialog>
      ) : null}
    </>
  );
}
export function AppearanceIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5v14" />
      <path fill="currentColor" stroke="none" d="M12 5a7 7 0 0 1 0 14Z" />
    </svg>
  );
}

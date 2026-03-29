'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { GameBoard } from '@/features/game/components/GameBoard';
import { useRemoteGame } from '@/features/game/hooks/useRemoteGame';
import { validateMove } from '@/features/game/lib/validateMove';
import { RankingTable } from '@/features/ranking/components/RankingTable';
import { useRankings } from '@/features/ranking/hooks/useRankings';
import { usePlayerIdentity } from '@/features/session/hooks/usePlayerIdentity';
import { PasswordModal } from '@/features/lobby/components/PasswordModal';
import { DeleteAccountModal } from '@/features/lobby/components/DeleteAccountModal';
import { AdminPanel } from '@/features/admin/components/AdminPanel';

type NavigationItem = {
  label: string;
  target: 'inicio' | 'reglas' | 'ranking' | 'admin';
};

const baseNavItems: NavigationItem[] = [
  { label: 'Inicio', target: 'inicio' },
  { label: 'Reglas', target: 'reglas' },
  { label: 'Ranking', target: 'ranking' }
];

const MIN_ROWS = 3;
const MAX_ROWS = 50;
const DEFAULT_ROWS = 7;
const RUNTIME_CONFIG_ENDPOINT = '/api/runtime-config';

type RuntimeConfigPayload = {
  publicShareOrigin?: string | null;
};

type BrowserLocationState = {
  origin: string;
  pathname: string;
  hostname: string;
  isPrivateOrigin: boolean;
};

function normalizeRowsInput(rawValue: string): number {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ROWS;
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, parsed));
}

function sanitizeRowsDraft(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(0, 2);
  if (!digits) return '';
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed)) return '';
  return String(Math.min(MAX_ROWS, Math.max(0, parsed)));
}

function isPrivateShareHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
  if (/\.local$/i.test(hostname)) return true;
  return false;
}

function normalizePublicShareOrigin(rawValue: string | null | undefined): string | null {
  const candidate = rawValue?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function buildInviteUrl(baseOrigin: string, pathname: string, gameCode: string, inviteToken: string): string {
  const inviteUrl = new URL(pathname || '/', baseOrigin);
  inviteUrl.searchParams.set('code', gameCode);
  inviteUrl.searchParams.set('inv', inviteToken);
  return inviteUrl.toString();
}

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Seguimos con fallback para HTTP, WebViews y navegadores quisquillosos.
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  textarea.blur();
  document.body.removeChild(textarea);

  if (selection) {
    selection.removeAllRanges();
    if (originalRange) {
      selection.addRange(originalRange);
    }
  }

  return copied;
}

/** Reglas detalladas (lobby y menú). */
const quickRules = [
  'Objetivo (misère): pierdes si quitas la última canica que queda en el tablero.',
  'Cada turno solo una fila con canicas; en ese turno quitas entre 1 y N canicas, donde N es el número de jugada global (1.ª jugada → 1 como máx., 2.ª → 2, etc.).',
  'Las canicas deben ser consecutivas en la fila, sin saltar huecos: un solo bloque continuo por jugada.',
  'Si en la fila quedan menos canicas que tu máximo permitido, solo puedes quitar las que haya en ese bloque.',
  'Puedes elegir cualquier bloque válido dentro de la fila; no hace falta empezar por un extremo.',
  'Selecciona canicas tocándolas (o clic); cuando el bloque sea válido, pulsa Aplicar para enviar la jugada.',
  'La fila que acabas de jugar puede aparecer marcada (bloqueada) para el rival en el siguiente turno según el estado de la partida.',
  'Dado especial: una sola vez por jugador en la partida; en vista 3D suele estar arriba a la derecha. Cuenta como una jugada para el contador de turno.',
  'Una misma fila puede usarse en varios turnos mientras queden canicas.',
  'Si no ves el tablero 3D, la app usará la vista 2D; las reglas son las mismas.'
];

/** Resumen muy corto para cabeceras y guías. */
const gameKeyInstructions: string[] = [
  'Pierdes si quitas la última canica (misère).',
  'Solo una fila por turno; bloque consecutivo de canicas.',
  'Máximo por turno = número de jugada global (ver chip “max N”).',
  'Selecciona tocando → Aplicar para confirmar.',
  'Dado: 1 uso por jugador; en 3D, arriba a la derecha.'
];

const waitingRoomTips: string[] = [
  'Comparte el código o el enlace con tu rival.',
  'Cuando entre, la partida empezará sola.',
  'Si tarda, comprueba que el enlace no haya caducado (al salir se invalida).',
  'Si estáis en móvil, mejor usar una URL pública estable y no localhost.'
];

const quickFaq = [
  {
    q: '¿Qué hago si no veo cambios?',
    a: 'Pulsa refrescar en el encabezado. Si sigues sin ver turno nuevo, vuelve al lobby y entra otra vez con el código.'
  },
  {
    q: '¿Cómo se gana?',
    a: 'En misère, pierdes si quitas la última canica. El truco está en dejarle esa jugada al rival.'
  },
  {
    q: '¿Qué pasa con el dado?',
    a: 'Cada jugador puede usarlo una vez por partida. Cuenta como jugada y puede cambiar el ritmo por completo.'
  }
];

function KeyInstructionsCard(): React.ReactElement {
  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 dark:border-primary/35 dark:from-primary/20 dark:via-primary/10 dark:to-transparent">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Instrucciones clave</p>
      <ul className="mt-2.5 space-y-2 text-xs font-semibold leading-snug text-[#4a3f32] dark:text-dark-text">
        {gameKeyInstructions.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-primary" aria-hidden>
              ▸
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DICE_POWER_LABELS: Record<string, string> = {
  bomba: 'Bomba',
  rayo: 'Rayo',
  diagonal: 'Diagonal',
  resurreccion: 'Resurrección'
};

function formatAffectedCountLabel(affectedCount: number | undefined): string {
  if (!affectedCount || affectedCount <= 0) return 'sin efecto';
  return `${affectedCount} canica${affectedCount === 1 ? '' : 's'}`;
}

function formatDiceEffectSummary(power: string | undefined, affectedCount: number | undefined): string {
  const powerLabel = DICE_POWER_LABELS[power ?? ''] ?? 'Dado especial';
  const impactLabel = formatAffectedCountLabel(affectedCount);

  if (power === 'bomba') return `${powerLabel} · fila barrida (${impactLabel})`;
  if (power === 'rayo') return `${powerLabel} · descarga sobre el tablero (${impactLabel})`;
  if (power === 'diagonal') return `${powerLabel} · corte diagonal (${impactLabel})`;
  if (power === 'resurreccion') return `${powerLabel} · fila restaurada (${impactLabel})`;
  return `${powerLabel} · ${impactLabel}`;
}

function formatLatestMoveSummary(game: NonNullable<ReturnType<typeof useRemoteGame>['game']>): string {
  const latestMove = game.moveHistory[game.moveHistory.length - 1];
  if (!latestMove) return 'Aún no hay jugadas';

  const actorName = latestMove.player === 1 ? game.player1?.name : game.player2?.name;
  if (latestMove.fromDice) {
    return `${actorName ?? `J${latestMove.player}`} usó ${formatDiceEffectSummary(latestMove.dicePower, latestMove.affectedCount)}`;
  }

  return `${actorName ?? `J${latestMove.player}`} quitó ${latestMove.count} en fila ${latestMove.rowIndex + 1}`;
}

const scoringRulesRows = [
  { label: 'Victoria ante rival mucho mejor', pts: '+15' },
  { label: 'Victoria ante rival mejor', pts: '+13' },
  { label: 'Victoria ante rival similar', pts: '+10' },
  { label: 'Victoria ante rival peor', pts: '+8' },
  { label: 'Victoria ante rival mucho peor', pts: '+5' },
  { label: 'Derrota ante rival mucho mejor', pts: '-2' },
  { label: 'Derrota ante rival mejor', pts: '-4' },
  { label: 'Derrota ante rival similar', pts: '-6' },
  { label: 'Derrota ante rival peor', pts: '-10' },
  { label: 'Derrota ante rival mucho peor', pts: '-12' },
  { label: 'Abandono', pts: '-18' }
];

const scoringDescription =
  'La puntuación depende del resultado y del win rate relativo entre ambos jugadores. Ganar contra rivales con mejor win rate da más puntos; perder contra rivales con peor win rate resta más. Abandonar siempre resta -18.';

function IconUser({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function IconHome({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="m4.5 11 7.5-6 7.5 6" />
      <path d="M7 10.5v7.5h10v-7.5" />
    </svg>
  );
}

function IconBook({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M6.5 5.5h8.5a2 2 0 0 1 2 2v11H8.5a2 2 0 0 0-2-2Z" />
      <path d="M6.5 5.5A2 2 0 0 0 4.5 7v11a2 2 0 0 1 2-2h10.5" />
    </svg>
  );
}

function IconTrophy({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <path d="M8 4.5h8v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4Z" />
      <path d="M10 16.5h4" />
      <path d="M9 19.5h6" />
      <path d="M16 6.5h2.5a2 2 0 0 1-2 3.5" />
      <path d="M8 6.5H5.5a2 2 0 0 0 2 3.5" />
    </svg>
  );
}

function IconHelp({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M11.4 9.1a1.7 1.7 0 0 1 3.1.9c0 1.3-1 1.8-1.6 2.2-.6.4-1 .8-1 1.7v.3" />
      <circle cx="12" cy="16" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M10 5.5H6.8A1.8 1.8 0 0 0 5 7.3v9.4A1.8 1.8 0 0 0 6.8 18.5H10" />
      <path d="M14 8.5 18 12l-4 3.5" />
      <path d="M17.5 12H10" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconJoin({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="3" />
      <path d="M4.5 18.5A4.5 4.5 0 0 1 9 15h0a4.5 4.5 0 0 1 4.5 3.5" />
      <path d="M16 8.5h3" />
      <path d="M17.5 7v3" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <rect x="9" y="9" width="9" height="9" rx="1.8" />
      <path d="M7 15H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconLinkExternal({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M10 6.5H7.8A1.8 1.8 0 0 0 6 8.3v7.9a1.8 1.8 0 0 0 1.8 1.8h7.9a1.8 1.8 0 0 0 1.8-1.8V14" />
      <path d="M13 5h5v5" />
      <path d="M11 13 18 6" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="m7 7 10 10" />
      <path d="M17 7 7 17" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M5.5 12.5 10 17l8.5-10" />
    </svg>
  );
}

function IconHistory({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M5 13a7 7 0 1 0 2-5.1" />
      <path d="M5 7v4h4" />
      <path d="M12 9.5V13l2.2 1.3" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M5 11a7 7 0 0 1 11.5-4.9L18.5 9" />
      <path d="M18.5 5.5V9h-3.5" />
      <path d="M19 13a7 7 0 0 1-11.5 4.9L5.5 15" />
      <path d="M5.5 18.5V15H9" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function Brand(): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl" role="img" aria-label="piña">🍍</span>
        <h2 className="text-lg font-black uppercase tracking-tight text-[#4a3f32] dark:text-dark-text sm:text-xl">
          Canicas<span className="ml-1 font-black text-primary">Try Again</span>
        </h2>
      </div>
      <p className="pl-[2.25rem] text-[9px] font-bold uppercase tracking-[0.2em] text-[#a89880] dark:text-dark-muted sm:pl-0 sm:text-[10px]">
        Gratis · 2 jugadores · Buen rollo
      </p>
    </div>
  );
}

function AmbientBackground(): React.ReactElement {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="grainy-bg absolute inset-0" />
        <div className="absolute left-[-8%] top-[-8%] h-[34%] w-[34%] rounded-full bg-sand/40 blur-[120px] dark:bg-primary/10" />
        <div className="absolute bottom-[-8%] right-[-8%] h-[24%] w-[24%] rounded-full bg-leaf-soft/20 blur-[100px] dark:bg-primary/8" />
      </div>
    </>
  );
}

const CONFETTI_COLORS = ['#F4C542', '#5C8D3A', '#8FBF5A', '#E9D8A6', '#8C6239', '#F2E9D0', '#d4a82e', '#a67c52'];
const CONFETTI_COUNT = 60;

const WHOLESOME_LOSS_LINES = [
  'El misère es así: hoy toca aplaudir al rival. Sin drama, solo respeto.',
  'Partida limpia = victoria moral. La revancha queda pendiente con una sonrisa.',
  'Perder con buen rollo también es ganar en amistad. Gracias por jugar.',
  'Tu rival jugó muy bien. Disfruta del momento y pásale el juego a otro amigo.',
  'Aquí no hay toxicidad: solo canicas, risas y “try again”.'
];

function IconShare({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98" />
      <path d="M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function VictoryOverlay({
  isWin,
  winnerName,
  playerName,
  rivalName,
  shareOrigin,
  onToast,
  onExit,
  onNewGame
}: {
  isWin: boolean;
  winnerName: string;
  playerName: string;
  rivalName: string;
  shareOrigin: string;
  onToast: (text: string) => void;
  onExit: () => void;
  onNewGame?: () => void;
}): React.ReactElement {
  const confettiRef = useRef<HTMLDivElement>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const wholesomeLine = useMemo(() => {
    const seed = `${playerName}:${winnerName}:${rivalName}`;
    let h = 0;
    for (let i = 0; i < seed.length; i += 1) h = (h + seed.charCodeAt(i) * (i + 1)) % 997;
    return WHOLESOME_LOSS_LINES[h % WHOLESOME_LOSS_LINES.length];
  }, [playerName, winnerName, rivalName]);

  const handleShareResult = useCallback(async (): Promise<void> => {
    const trimmedShareOrigin = shareOrigin.trim();
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const base = trimmedShareOrigin || fallbackOrigin;
    const publicBaseAvailable = Boolean(trimmedShareOrigin);
    const text = isWin
      ? `¡Acabo de ganar en Canicas Try Again 🍍 contra ${rivalName || 'un crack'}! ¿Quién se apunta a un misère con buen rollo?${publicBaseAvailable ? ` ${base}` : ''}`
      : `Partidazo en Canicas Try Again 🍍: ganó ${winnerName || 'mi rival'}. Yo sigo con buen rollo y ganas de revancha 😄${publicBaseAvailable ? ` ${base}` : ''}`;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Canicas Try Again 🍍',
          text,
          ...(publicBaseAvailable ? { url: base } : {})
        });
        onToast(
          publicBaseAvailable
            ? '¡Gracias por compartir! Esta vez el reto sale con enlace bueno, no con localhost travieso 🍍'
            : 'Resultado compartido. Si quieres incluir enlace público, abre la app desde la URL del túnel.'
        );
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    const copied = await copyTextWithFallback(text);
    if (copied) {
      onToast(
        publicBaseAvailable
          ? 'Texto copiado con enlace listo para retar por WhatsApp, Instagram o donde quieras 🍍'
          : 'Texto copiado sin URL pública. Si quieres enlace compartible, abre la app con la URL del túnel.'
      );
    } else {
      onToast(
        publicBaseAvailable
          ? 'No pude copiarlo solo. Usa compartir del sistema o copia el enlace desde el menú de partida (⋮).'
          : 'No pude copiarlo solo. Primero consigue una URL pública (npm run dev:public o túnel) y luego comparte.'
      );
    }
  }, [isWin, rivalName, winnerName, shareOrigin, onToast]);

  useEffect(() => {
    const container = confettiRef.current;
    if (!container || !isWin) return;

    const pieces: HTMLDivElement[] = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const el = document.createElement('div');
      const size = 6 + Math.random() * 8;
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const left = Math.random() * 100;
      const delay = Math.random() * 2.5;
      const duration = 2.5 + Math.random() * 2;
      const drift = (Math.random() - 0.5) * 120;
      const rotation = Math.random() * 720 - 360;
      const shape = Math.random() > 0.5 ? '50%' : `${2 + Math.random() * 4}px`;

      Object.assign(el.style, {
        position: 'absolute',
        width: `${size}px`,
        height: `${size * (0.4 + Math.random() * 0.6)}px`,
        backgroundColor: color,
        borderRadius: shape,
        left: `${left}%`,
        top: '-12px',
        opacity: '0',
        pointerEvents: 'none',
        zIndex: '1',
        animation: `confetti-fall ${duration}s ${delay}s ease-in forwards`
      });
      el.style.setProperty('--drift', `${drift}px`);
      el.style.setProperty('--rotation', `${rotation}deg`);

      container.appendChild(el);
      pieces.push(el);
    }

    return () => {
      pieces.forEach((p) => p.remove());
    };
  }, [isWin]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          background: isWin
            ? 'radial-gradient(ellipse at center, rgba(34,211,238,0.15) 0%, rgba(0,0,0,0.75) 70%)'
            : 'radial-gradient(ellipse at center, rgba(244,197,66,0.14) 0%, rgba(92,141,58,0.08) 45%, rgba(0,0,0,0.78) 72%)',
          opacity: showContent ? 1 : 0
        }}
      />

      {isWin ? <div ref={confettiRef} className="pointer-events-none absolute inset-0 overflow-hidden" /> : null}

      <div
        className="relative z-10 w-full max-w-md px-6 text-center transition-all duration-700"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.9)'
        }}
      >
        {winnerName ? (
          <div
            className={[
              'mx-auto mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em]',
              isWin
                ? 'border-primary/40 bg-primary/20 text-primary shadow-[0_0_12px_rgba(212,175,55,0.25)]'
                : 'border-white/20 bg-white/10 text-white/80'
            ].join(' ')}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">{isWin ? '🏆' : '👤'}</span>
            <span>{winnerName}</span>
          </div>
        ) : null}

        {isWin ? (
          <div className="victory-trophy-glow mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full sm:h-28 sm:w-28">
            <span className="text-5xl sm:text-6xl">🏆</span>
          </div>
        ) : (
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-primary/25 bg-primary/10 sm:h-28 sm:w-28">
            <span className="text-5xl sm:text-6xl" role="img" aria-label="apretón de manos">
              🤝
            </span>
          </div>
        )}

        <h2
          className={[
            'text-4xl font-black uppercase tracking-tight sm:text-5xl',
            isWin ? 'victory-text-shimmer' : 'text-white/90'
          ].join(' ')}
        >
          {isWin ? '¡Victoria!' : '¡Qué partida!'}
        </h2>

        <p className="mt-3 text-sm text-white/60 sm:text-base">
          {winnerName ? (
            <>
              <span className={isWin ? 'font-bold text-primary' : 'font-bold text-primary/90'}>{winnerName}</span>
              {isWin ? ' se lleva la victoria. ¡A celebrar con deportividad! 🏆' : ' jugó genial. Chapeau y hasta la revancha.'}
            </>
          ) : (
            'La sesión terminó (abandono o desconexión). Sin culpas: se puede volver a intentar cuando quieras.'
          )}
        </p>

        {!isWin && winnerName ? (
          <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-white/50 sm:text-sm">{wholesomeLine}</p>
        ) : null}

        {isWin ? (
          <p className="mt-3 text-xs text-white/45 sm:text-sm">Pásale el juego a alguien: aquí mandan el respeto y las risas.</p>
        ) : null}

        <div className="mt-4 flex items-center justify-center gap-2">
          <div className={['h-0.5 w-10 rounded-full', isWin ? 'bg-primary/40' : 'bg-primary/25'].join(' ')} />
          <span className="text-sm">🍍</span>
          <div className={['h-0.5 w-10 rounded-full', isWin ? 'bg-primary/40' : 'bg-primary/25'].join(' ')} />
        </div>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            autoFocus
            onClick={() => void handleShareResult()}
            aria-label="Compartir resultado"
            title="Compartir resultado"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-black uppercase tracking-wider text-white backdrop-blur transition-all hover:bg-white/20 active:scale-[0.97]"
          >
            <IconShare className="h-4 w-4 shrink-0" />
            <span>Compartir y retar</span>
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label="Volver al lobby"
            title="Volver al lobby"
            className={[
              'inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-black uppercase tracking-wider transition-all active:scale-[0.97]',
              isWin
                ? 'bg-primary text-[#4a3f32] shadow-lg shadow-primary/30 hover:brightness-110'
                : 'border border-primary/40 bg-primary/15 text-white hover:bg-primary/25'
            ].join(' ')}
          >
            <IconHome className="h-4 w-4 shrink-0" />
            <span>Volver al lobby</span>
          </button>
          {onNewGame ? (
            <button
              type="button"
              onClick={onNewGame}
              aria-label="Nueva partida"
              title="Nueva partida"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-leaf/40 bg-leaf/20 px-6 py-3.5 text-sm font-black uppercase tracking-wider text-leaf transition-all hover:border-leaf hover:bg-leaf/30 active:scale-[0.97] dark:text-leaf-soft dark:border-leaf-soft/40 dark:bg-leaf-soft/15 dark:hover:bg-leaf-soft/25"
            >
              <IconPlus className="h-4 w-4 shrink-0" />
              <span>Nueva partida</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function HomePage(): React.ReactElement {
  const router = useRouter();
  const [sharedCode, setSharedCode] = useState('');
  const [sharedInviteToken, setSharedInviteToken] = useState('');
  const [publicShareOrigin, setPublicShareOrigin] = useState<string | null>(null);
  const [publicShareOriginStatus, setPublicShareOriginStatus] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle');
  const [browserLocation, setBrowserLocation] = useState<BrowserLocationState | null>(null);

  const { ready, playerId, playerName, isAdmin, loginWithServer, logout } = usePlayerIdentity();
  const {
    game,
    isBusy,
    isSyncing,
    hasLiveChannel,
    lastSyncedAt,
    error,
    errorCode,
    clearError,
    clearGame,
    createNewGame,
    joinExistingGame,
    leaveCurrentGame,
    refreshGame,
    sendMove,
    sendDice
  } = useRemoteGame(playerId);
  const { rankings, loading: rankingsLoading, error: rankingsError, fetchRankings } = useRankings();

  const [rowsInput, setRowsInput] = useState(String(DEFAULT_ROWS));
  const normalizedRowsInput = useMemo(() => normalizeRowsInput(rowsInput), [rowsInput]);
  const [aliasInput, setAliasInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAlias, setPendingAlias] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [showKeyRulesInMenu, setShowKeyRulesInMenu] = useState(false);
  const [gameGuideCollapsed, setGameGuideCollapsed] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ rowIndex: number; startIndex: number; endIndex: number } | null>(null);
  const [turnBannerKey, setTurnBannerKey] = useState(0);
  const [showTurnSpotlight, setShowTurnSpotlight] = useState(false);
  const [boardAttentionPulse, setBoardAttentionPulse] = useState(false);
  const [yourTurnGlow, setYourTurnGlow] = useState(false);

  const autoJoinAttemptedRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const turnSpotlightTimerRef = useRef<number | null>(null);
  const boardAttentionTimerRef = useRef<number | null>(null);
  const yourTurnGlowTimerRef = useRef<number | null>(null);
  const moveInFlightRef = useRef(false);
  const pendingActionBarRef = useRef<HTMLDivElement | null>(null);
  const applyMoveButtonRef = useRef<HTMLButtonElement | null>(null);
  const gameMenuTriggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const gameMenuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const gameMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const previousCanInteractRef = useRef(false);
  const gameFeedbackRef = useRef<{
    gameId: string;
    moveCount: number;
    currentTurn: 1 | 2;
    status: 'waiting' | 'playing' | 'finished';
  } | null>(null);
  const recoverableJoinErrorCodes = useMemo(
    () => new Set(['GAME_NOT_FOUND', 'INVITE_TOKEN_REVOKED', 'INVALID_INVITE_TOKEN']),
    []
  );

  const loggedIn = playerId.length > 0 && playerName.trim().length > 0;

  const topNavItems = useMemo<NavigationItem[]>(() => {
    if (!isAdmin) return baseNavItems;
    return [...baseNavItems, { label: 'Admin', target: 'admin' }];
  }, [isAdmin]);

  const isWaitingForOpponent = game?.status === 'waiting';
  const isGameMode = Boolean(game) && !isWaitingForOpponent;
  const activeGameCode = game?.gameCode ?? '';
  const activeInviteToken = game?.inviteToken ?? '';
  const isPrivateOrigin = browserLocation?.isPrivateOrigin ?? false;
  const canInteract =
    game?.status === 'playing' && game.yourPlayerNumber !== null && game.yourPlayerNumber === game.currentTurn;
  const canSelectBalls = canInteract && !isBusy;
  const turnLimit = (game?.moveHistory.length ?? 0) + 1;
  const pendingRemoveCount = useMemo(
    () => (pendingMove ? pendingMove.endIndex - pendingMove.startIndex + 1 : 0),
    [pendingMove]
  );
  const pendingRowLabel = useMemo(
    () => (pendingMove ? pendingMove.rowIndex + 1 : null),
    [pendingMove]
  );
  const remainingSelectionCapacity = useMemo(
    () => Math.max(0, turnLimit - pendingRemoveCount),
    [turnLimit, pendingRemoveCount]
  );
  const selectionUsagePercent = useMemo(
    () => (turnLimit > 0 ? Math.min(100, (pendingRemoveCount / turnLimit) * 100) : 0),
    [pendingRemoveCount, turnLimit]
  );
  const latestMoveSummary = useMemo(() => (game ? formatLatestMoveSummary(game) : ''), [game]);
  const turnBannerText = useMemo(() => {
    if (!game || game.status !== 'playing') return '';
    if (pendingMove) {
      return `Fila ${pendingMove.rowIndex + 1} · ${pendingMove.endIndex - pendingMove.startIndex + 1} canica${pendingMove.endIndex - pendingMove.startIndex === 0 ? '' : 's'} lista${pendingMove.endIndex - pendingMove.startIndex === 0 ? '' : 's'} para aplicar.`;
    }
    if (canInteract) {
      return `Tu turno: hasta ${turnLimit} canica${turnLimit > 1 ? 's' : ''} seguidas en una sola fila.`;
    }
    return 'Esperando la jugada del rival…';
  }, [game, pendingMove, canInteract, turnLimit]);
  const gameMenuSummaryText = useMemo(() => {
    if (!game || game.status !== 'playing') return '';
    if (pendingMove) {
      return `Fila ${pendingMove.rowIndex + 1} preparada · ${pendingRemoveCount}/${turnLimit}`;
    }
    return canInteract ? `Te toca · máximo ${turnLimit}` : 'Turno del rival';
  }, [game, pendingMove, pendingRemoveCount, canInteract, turnLimit]);
  const showTurnCoach = isGameMode && game?.status === 'playing' && canInteract && !pendingMove;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setBrowserLocation({
      origin: window.location.origin,
      pathname: window.location.pathname,
      hostname: window.location.hostname,
      isPrivateOrigin: isPrivateShareHost(window.location.hostname)
    });
  }, []);

  const loadPublicShareOrigin = useCallback(async (): Promise<string | null> => {
    if (!browserLocation) return null;

    if (!browserLocation.isPrivateOrigin) {
      setPublicShareOrigin(browserLocation.origin);
      setPublicShareOriginStatus('ready');
      return browserLocation.origin;
    }

    setPublicShareOriginStatus('loading');

    try {
      const response = await fetch(RUNTIME_CONFIG_ENDPOINT, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('No se pudo consultar la URL publica');
      }

      const payload = (await response.json().catch(() => ({}))) as RuntimeConfigPayload;
      const resolvedOrigin = normalizePublicShareOrigin(payload.publicShareOrigin);
      setPublicShareOrigin(resolvedOrigin);
      setPublicShareOriginStatus(resolvedOrigin ? 'ready' : 'missing');
      return resolvedOrigin;
    } catch {
      setPublicShareOrigin(null);
      setPublicShareOriginStatus('missing');
      return null;
    }
  }, [browserLocation]);

  const lastSyncLabel = useMemo(() => {
    if (!lastSyncedAt) return null;
    return new Date(lastSyncedAt).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, [lastSyncedAt]);

  const syncStatus = useMemo(() => {
    const staleMs = lastSyncedAt ? Date.now() - lastSyncedAt : Number.POSITIVE_INFINITY;
    const isLagging = !hasLiveChannel && staleMs > 9_000;

    if (hasLiveChannel) {
      return {
        tone: 'live' as const,
        shortLabel: 'En vivo',
        detail: 'Canal en vivo activo',
        hint: 'Los turnos deberían llegar solos.'
      };
    }

    if (isSyncing) {
      return {
        tone: 'syncing' as const,
        shortLabel: 'Sync',
        detail: 'Sincronizando tablero…',
        hint: 'Estamos pidiendo el estado más reciente.'
      };
    }

    if (isLagging) {
      return {
        tone: 'lagging' as const,
        shortLabel: 'Reconectando',
        detail: lastSyncLabel ? `Sin canal en vivo · última sync ${lastSyncLabel}` : 'Sin canal en vivo · reintento automático',
        hint: 'Si tarda demasiado, pulsa refrescar.'
      };
    }

    return {
      tone: 'polling' as const,
      shortLabel: 'Auto-sync',
      detail: lastSyncLabel ? `Última sync ${lastSyncLabel}` : 'Preparando sincronización',
      hint: 'Seguimos comprobando cambios en segundo plano.'
    };
  }, [hasLiveChannel, isSyncing, lastSyncedAt, lastSyncLabel]);

  const shareUrl = useMemo(() => {
    if (!browserLocation) return '';
    if (!activeGameCode || !activeInviteToken) return '';
    const baseOrigin = isPrivateOrigin ? publicShareOrigin : browserLocation.origin;
    if (!baseOrigin) return '';

    return buildInviteUrl(baseOrigin, browserLocation.pathname, activeGameCode, activeInviteToken);
  }, [activeGameCode, activeInviteToken, browserLocation, isPrivateOrigin, publicShareOrigin]);

  const shareStatusText = useMemo(() => {
    if (!isWaitingForOpponent || !browserLocation) return '';

    if (!isPrivateOrigin) {
      return 'Comparte el enlace o el código con tu rival.';
    }

    if (shareUrl) {
      try {
        return `Invitación pública lista: ${new URL(shareUrl).host}`;
      } catch {
        return 'Invitación pública lista para compartir.';
      }
    }

    if (publicShareOriginStatus === 'loading') {
      return 'Buscando la URL pública para compartir...';
    }

    return 'Estás en localhost o red local. Para invitar desde el móvil usa npm run dev:public o abre la app con la URL pública.';
  }, [browserLocation, isWaitingForOpponent, isPrivateOrigin, shareUrl, publicShareOriginStatus]);

  const shareResultOrigin = useMemo(() => {
    if (!browserLocation) return '';
    if (isPrivateOrigin) {
      return publicShareOrigin ?? '';
    }
    return browserLocation.origin;
  }, [browserLocation, isPrivateOrigin, publicShareOrigin]);

  useEffect(() => {
    if (!browserLocation) return;
    void loadPublicShareOrigin();
  }, [browserLocation, loadPublicShareOrigin]);

  useEffect(() => {
    if (!isWaitingForOpponent || !isPrivateOrigin || shareUrl) return;
    void loadPublicShareOrigin();
  }, [isWaitingForOpponent, isPrivateOrigin, shareUrl, loadPublicShareOrigin]);

  useEffect(() => {
    if (!browserLocation) return;

    if (!activeGameCode || !activeInviteToken) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('code') || url.searchParams.has('inv')) {
        url.searchParams.delete('code');
        url.searchParams.delete('inv');
        const clean = url.searchParams.toString();
        window.history.replaceState({}, '', clean ? `${url.pathname}?${clean}` : url.pathname);
      }
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('code', activeGameCode);
    url.searchParams.set('inv', activeInviteToken);
    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
  }, [activeGameCode, activeInviteToken, browserLocation]);

  useEffect(() => {
    if (!browserLocation) return;

    const searchParams = new URLSearchParams(window.location.search);
    const queryCode = searchParams.get('code')?.trim().toUpperCase() ?? '';
    const queryInviteToken = searchParams.get('inv')?.trim() ?? '';
    setSharedCode(queryCode);
    setSharedInviteToken(queryInviteToken);
  }, [browserLocation]);

  useEffect(() => {
    setAliasInput(playerName);
  }, [playerName]);

  const showTemporaryMessage = useCallback((text: string) => {
    setMessage(text);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    const durationMs = Math.min(10_000, 2600 + text.length * 42);
    toastTimerRef.current = window.setTimeout(() => {
      setMessage('');
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  const focusBoard = useCallback(() => {
    if (typeof window === 'undefined') return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const boardNode = document.getElementById('board');
    boardNode?.scrollIntoView({
      block: 'start',
      behavior: reduceMotion ? 'auto' : 'smooth'
    });

    setBoardAttentionPulse(false);
    window.requestAnimationFrame(() => setBoardAttentionPulse(true));
    if (boardAttentionTimerRef.current) {
      window.clearTimeout(boardAttentionTimerRef.current);
    }
    boardAttentionTimerRef.current = window.setTimeout(() => {
      setBoardAttentionPulse(false);
      boardAttentionTimerRef.current = null;
    }, reduceMotion ? 120 : 980);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (!game || isSyncing || isBusy) return;
    showTemporaryMessage('Sincronizando partida...');
    await refreshGame();
  }, [game, isSyncing, isBusy, refreshGame, showTemporaryMessage]);

  const handleUseDice3D = useCallback(async () => {
    if (!game || !canInteract || isBusy) return null;
    if (!game.yourDiceAvailable) {
      showTemporaryMessage('Ya usaste tu dado en esta partida');
      return null;
    }

    try {
      const dice = await sendDice();
      if (dice) {
        showTemporaryMessage(`Dado especial: ${formatDiceEffectSummary(dice.power, dice.affected.length)}`);
        return dice;
      }
    } catch {
      // error handled in hook
    }
    return null;
  }, [game, canInteract, isBusy, sendDice, showTemporaryMessage]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (turnSpotlightTimerRef.current) {
        window.clearTimeout(turnSpotlightTimerRef.current);
      }
      if (boardAttentionTimerRef.current) {
        window.clearTimeout(boardAttentionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (error) {
      if (errorCode && recoverableJoinErrorCodes.has(errorCode)) {
        return;
      }
      showTemporaryMessage(error);
      clearError();
      if (!game) {
        setSharedCode('');
        setSharedInviteToken('');
        setJoinCode('');
      }
    }
  }, [error, errorCode, game, recoverableJoinErrorCodes, clearError, showTemporaryMessage]);

  useEffect(() => {
    if (!errorCode || !recoverableJoinErrorCodes.has(errorCode)) return;

    const candidateCode = joinCode.trim().toUpperCase() || sharedCode || activeGameCode;
    const params = new URLSearchParams();
    if (candidateCode) {
      params.set('code', candidateCode);
    }
    params.set('reason', errorCode);

    router.push(`/partida-no-encontrada?${params.toString()}`);
    clearError();
  }, [errorCode, recoverableJoinErrorCodes, joinCode, sharedCode, activeGameCode, router, clearError]);

  useEffect(() => {
    if (rankingsError) {
      showTemporaryMessage(rankingsError);
    }
  }, [rankingsError, showTemporaryMessage]);

  useEffect(() => {
    setPendingMove(null);
    moveInFlightRef.current = false;
  }, [game?.moveHistory.length, game?.currentTurn, game?.status]);

  useEffect(() => {
    if (game?.status !== 'playing') return;
    setTurnBannerKey((previous) => previous + 1);
  }, [game?.gameId, game?.status, game?.currentTurn, game?.moveHistory.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pendingMove) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(18);
    }

    const frameId = window.requestAnimationFrame(() => {
      pendingActionBarRef.current?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    });

    const focusTimer = window.setTimeout(() => {
      applyMoveButtonRef.current?.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 180);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(focusTimer);
    };
  }, [pendingMove]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!game || game.status !== 'playing') {
      previousCanInteractRef.current = false;
      setShowTurnSpotlight(false);
      if (turnSpotlightTimerRef.current) {
        window.clearTimeout(turnSpotlightTimerRef.current);
        turnSpotlightTimerRef.current = null;
      }
      if (yourTurnGlowTimerRef.current) {
        window.clearTimeout(yourTurnGlowTimerRef.current);
        yourTurnGlowTimerRef.current = null;
      }
      setYourTurnGlow(false);
      return;
    }

    const becameInteractive = canInteract && !previousCanInteractRef.current;
    if (becameInteractive) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([24, 40, 24]);
      }
      setShowTurnSpotlight(true);
      if (turnSpotlightTimerRef.current) {
        window.clearTimeout(turnSpotlightTimerRef.current);
      }
      turnSpotlightTimerRef.current = window.setTimeout(() => {
        setShowTurnSpotlight(false);
        turnSpotlightTimerRef.current = null;
      }, 2400);

      // Board emerald glow: plays once when it becomes the user's turn
      if (yourTurnGlowTimerRef.current) {
        window.clearTimeout(yourTurnGlowTimerRef.current);
      }
      setYourTurnGlow(true);
      yourTurnGlowTimerRef.current = window.setTimeout(() => {
        setYourTurnGlow(false);
        yourTurnGlowTimerRef.current = null;
      }, 1200);
    }

    previousCanInteractRef.current = canInteract;
  }, [game, canInteract]);

  useEffect(() => {
    if (!game) {
      gameFeedbackRef.current = null;
      return;
    }

    const previous = gameFeedbackRef.current;
    if (previous && previous.gameId === game.gameId) {
      if (previous.status === 'waiting' && game.status === 'playing') {
        if (game.yourPlayerNumber === game.currentTurn) {
          const maxN = game.moveHistory.length + 1;
          const diceHint = game.yourDiceAvailable ? ' Dado especial 1× (vista 3D, arriba derecha).' : '';
          showTemporaryMessage(
            `¡Partida en marcha! Empiezas tú: hasta ${maxN} canica${maxN > 1 ? 's' : ''} en una fila (bloque seguido). Toca y luego Aplicar.${diceHint}`
          );
        } else {
          showTemporaryMessage('¡Partida en marcha! Empieza tu rival; te avisaremos cuando sea tu turno.');
        }
      }

      if (game.status === 'playing' && game.moveHistory.length > previous.moveCount) {
        const latestMove = game.moveHistory[game.moveHistory.length - 1];
        const isMyMove = latestMove?.player === game.yourPlayerNumber;
        if (!isMyMove && latestMove) {
          const rivalName = latestMove.player === 1 ? game.player1?.name : game.player2?.name;
          if (latestMove.fromDice) {
            showTemporaryMessage(
              `${rivalName ?? 'Rival'} usó ${formatDiceEffectSummary(latestMove.dicePower, latestMove.affectedCount)}.`
            );
          } else {
            showTemporaryMessage(
              `${rivalName ?? 'Rival'} quitó ${latestMove.count} canica${latestMove.count > 1 ? 's' : ''} (fila ${latestMove.rowIndex + 1}).`
            );
          }
        }
        if (isMyMove && latestMove && !latestMove.fromDice) {
          showTemporaryMessage('Tu jugada quedó registrada. Turno del rival.');
        }
      }

      if (game.status === 'playing' && game.currentTurn === game.yourPlayerNumber && previous.currentTurn !== game.currentTurn) {
        const maxN = game.moveHistory.length + 1;
        const diceHint = game.yourDiceAvailable ? ' Dado 1× disponible (3D).' : '';
        showTemporaryMessage(`Tu turno: hasta ${maxN} canica${maxN > 1 ? 's' : ''} en una fila (seguidas).${diceHint}`);
      }
    }

    gameFeedbackRef.current = {
      gameId: game.gameId,
      moveCount: game.moveHistory.length,
      currentTurn: game.currentTurn,
      status: game.status
    };
  }, [game, showTemporaryMessage]);

  useEffect(() => {
    if (game?.status === 'finished') {
      void fetchRankings();
    }
  }, [game?.status, fetchRankings]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!showGameMenu) return;

    const previousOverflow = document.body.style.overflow;
    const triggerButton = gameMenuTriggerButtonRef.current;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      gameMenuCloseButtonRef.current?.focus({ preventScroll: true });
    }, 10);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      triggerButton?.focus({ preventScroll: true });
    };
  }, [showGameMenu]);

  useEffect(() => {
    if (!showGameMenu || typeof window === 'undefined') return;

    const handleTrapFocus = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;

      const panel = gameMenuPanelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleTrapFocus);
    return () => window.removeEventListener('keydown', handleTrapFocus);
  }, [showGameMenu]);

  useEffect(() => {
    if (!game && loggedIn) {
      void fetchRankings();
    }
  }, [game, loggedIn, fetchRankings]);

  useEffect(() => {
    if (!ready || !loggedIn || autoJoinAttemptedRef.current || game) {
      return;
    }

    const hasCode = sharedCode.length > 0;
    const hasInviteToken = sharedInviteToken.length > 0;
    if (!hasCode && !hasInviteToken) {
      return;
    }

    autoJoinAttemptedRef.current = true;
    if (hasCode) {
      setJoinCode(sharedCode);
    }

    void joinExistingGame({
      playerName,
      gameCode: hasCode ? sharedCode : undefined,
      inviteToken: hasInviteToken ? sharedInviteToken : undefined
    })
      .then(() => {
        showTemporaryMessage(`Te uniste a la partida ${hasCode ? sharedCode : 'compartida'}`);
      })
      .catch(() => {
        setSharedCode('');
        setSharedInviteToken('');
        setJoinCode('');
      });
  }, [ready, loggedIn, sharedCode, sharedInviteToken, game, joinExistingGame, playerName, showTemporaryMessage]);

  const handleLogin = useCallback(() => {
    const normalized = aliasInput.trim();
    if (!normalized) {
      showTemporaryMessage('Ingresa tu nombre para continuar');
      return;
    }

    setPendingAlias(normalized);
    setShowPasswordModal(true);
  }, [aliasInput, showTemporaryMessage]);

  const handlePasswordSuccess = useCallback((serverPlayerId: string, serverAlias: string, serverIsAdmin: boolean) => {
    loginWithServer(serverPlayerId, serverAlias, serverIsAdmin);
    setShowPasswordModal(false);
    setPendingAlias('');
    showTemporaryMessage(`Bienvenido, ${serverAlias}`);
  }, [loginWithServer, showTemporaryMessage]);

  const handlePasswordCancel = useCallback(() => {
    setShowPasswordModal(false);
    setPendingAlias('');
  }, []);

  const handleAccountDeleted = useCallback(() => {
    setShowDeleteModal(false);
    logout();
    setAliasInput('');
    setJoinCode('');
    setSharedCode('');
    setSharedInviteToken('');
    clearGame();
    showTemporaryMessage('Cuenta eliminada correctamente');
  }, [logout, clearGame, showTemporaryMessage]);

  const handleLogout = useCallback(() => {
    logout();
    setAliasInput('');
    setJoinCode('');
    setSharedCode('');
    setSharedInviteToken('');
    clearGame();
    showTemporaryMessage('Sesión cerrada');
  }, [logout, clearGame, showTemporaryMessage]);

  const handleLeaveGame = useCallback(async () => {
    if (!game) return;

    try {
      await leaveCurrentGame();
      clearGame();
      setSharedCode('');
      setSharedInviteToken('');
      setJoinCode('');
      showTemporaryMessage('Has salido de la partida. El enlace de invitación anterior quedó invalidado.');
    } catch {
      // Se maneja en el hook
    }
  }, [game, leaveCurrentGame, clearGame, showTemporaryMessage]);

  const handleCreateGame = useCallback(async () => {
    if (!loggedIn) {
      showTemporaryMessage('Debes iniciar sesión primero');
      return;
    }

    try {
      await createNewGame({
        playerName,
        numRows: normalizedRowsInput
      });

      showTemporaryMessage('Partida creada. Envía el código o el enlace a tu rival; cuando entre, empezará la partida.');
    } catch {
      // Se maneja en el hook
    }
  }, [loggedIn, createNewGame, playerName, normalizedRowsInput, showTemporaryMessage]);

  const handleRowsInputChange = useCallback((rawValue: string) => {
    setRowsInput(sanitizeRowsDraft(rawValue));
  }, []);

  const handleRowsInputBlur = useCallback(() => {
    setRowsInput(String(normalizeRowsInput(rowsInput)));
  }, [rowsInput]);

  const stepRowsInput = useCallback((delta: number) => {
    setRowsInput((previous) => {
      const nextValue = normalizeRowsInput(previous) + delta;
      return String(Math.min(MAX_ROWS, Math.max(MIN_ROWS, nextValue)));
    });
  }, []);

  const handleJoinGame = useCallback(async () => {
    if (!loggedIn) {
      showTemporaryMessage('Debes iniciar sesión primero');
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      showTemporaryMessage('Ingresa el código de la partida');
      return;
    }

    try {
      await joinExistingGame({
        playerName,
        gameCode: code
      });

      setJoinCode(code);
      showTemporaryMessage(`Te uniste a la partida ${code}`);
    } catch {
      // Se maneja en el hook
    }
  }, [loggedIn, joinCode, joinExistingGame, playerName, showTemporaryMessage]);

  const handleBallClick = useCallback(
    (rowIndex: number, ballIndex: number) => {
      if (!game) return;

      if (!canInteract) {
        showTemporaryMessage('Ahora le toca a tu rival. Espera a que juegue.');
        return;
      }

      if (isBusy || moveInFlightRef.current) {
        if (isBusy) {
          showTemporaryMessage('Espera un momento, se está aplicando la jugada…');
        }
        return;
      }

      const baseStartIndex = ballIndex;
      const baseRemoveCount = 1;
      const validation = validateMove(game, rowIndex, baseStartIndex, baseRemoveCount);
      if (!validation.valid) {
        showTemporaryMessage(validation.reason ?? 'Jugada inválida');
        return;
      }

      setPendingMove((previous) => {
        if (!previous || previous.rowIndex !== rowIndex) {
          return { rowIndex, startIndex: ballIndex, endIndex: ballIndex };
        }

        const isInsideBlock = ballIndex >= previous.startIndex && ballIndex <= previous.endIndex;

        if (isInsideBlock) {
          // Click dentro del bloque: quitar del extremo si es el borde
          if (ballIndex === previous.startIndex) {
            const newStart = previous.startIndex + 1;
            if (newStart > previous.endIndex) return null;
            return { rowIndex, startIndex: newStart, endIndex: previous.endIndex };
          }
          if (ballIndex === previous.endIndex) {
            const newEnd = previous.endIndex - 1;
            if (newEnd < previous.startIndex) return null;
            return { rowIndex, startIndex: previous.startIndex, endIndex: newEnd };
          }
          // Click en el medio del bloque: no cambiar selección
          showTemporaryMessage('Toca un extremo del bloque para quitar una canica, o otra fila para empezar de nuevo.');
          return previous;
        }

        // Click fuera del bloque: extender selección (debe ser contiguo)
        const nextStart = Math.min(previous.startIndex, ballIndex);
        const nextEnd = Math.max(previous.endIndex, ballIndex);
        const nextCount = nextEnd - nextStart + 1;
        const nextValidation = validateMove(game, rowIndex, nextStart, nextCount);
        if (!nextValidation.valid) {
          showTemporaryMessage(nextValidation.reason ?? 'Jugada inválida');
          return previous;
        }

        return { rowIndex, startIndex: nextStart, endIndex: nextEnd };
      });
    },
    [game, canInteract, isBusy, showTemporaryMessage]
  );

  const applyPendingMove = useCallback(
    async () => {
      if (!game || !pendingMove) return;

      if (!canInteract) {
        showTemporaryMessage('Ahora le toca a tu rival.');
        return;
      }

      if (isBusy || moveInFlightRef.current) {
        if (isBusy) {
          showTemporaryMessage('Espera un momento…');
        }
        return;
      }

      const { rowIndex, startIndex, endIndex } = pendingMove;
      const removeCount = endIndex - startIndex + 1;
      const validation = validateMove(game, rowIndex, startIndex, removeCount);
      if (!validation.valid) {
        showTemporaryMessage(validation.reason ?? 'Jugada inválida');
        setPendingMove(null);
        return;
      }

      moveInFlightRef.current = true;
      try {
        await sendMove(rowIndex, startIndex, removeCount);
      } catch {
        // Se maneja en el hook
      } finally {
        moveInFlightRef.current = false;
        setPendingMove(null);
      }
    },
    [game, pendingMove, canInteract, isBusy, sendMove, showTemporaryMessage]
  );

  const clearPendingMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isGameMode) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (showGameMenu) {
          event.preventDefault();
          setShowGameMenu(false);
          return;
        }

        if (pendingMove) {
          event.preventDefault();
          clearPendingMove();
        }
        return;
      }

      if (event.key === 'Enter' && pendingMove && canInteract && !isBusy) {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName;
        if (tagName === 'BUTTON' || tagName === 'INPUT' || tagName === 'TEXTAREA') return;

        event.preventDefault();
        void applyPendingMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameMode, showGameMenu, pendingMove, canInteract, isBusy, clearPendingMove, applyPendingMove]);

  const handleCopyCode = useCallback(async () => {
    if (!game?.gameCode) return;

    const copied = await copyTextWithFallback(game.gameCode);
    showTemporaryMessage(copied ? 'Código copiado' : 'No se pudo copiar el código automáticamente');
  }, [game?.gameCode, showTemporaryMessage]);

  const handleCopyUrl = useCallback(async () => {
    let inviteUrl = shareUrl;

    if (!inviteUrl && activeGameCode && activeInviteToken && browserLocation?.isPrivateOrigin) {
      const resolvedOrigin = await loadPublicShareOrigin();
      if (resolvedOrigin) {
        inviteUrl = buildInviteUrl(resolvedOrigin, browserLocation.pathname, activeGameCode, activeInviteToken);
      }
    }

    if (!inviteUrl) {
      showTemporaryMessage('No hay una URL pública disponible. Usa npm run dev:public o abre esta app con la URL del túnel.');
      return;
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Canicas Try Again 🍍',
          text: `🍍 ¿Un misère de canicas con buen rollo? Entra gratis (sin instalar nada). Código: ${game?.gameCode ?? '—'} — te espero.`,
          url: inviteUrl
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    const copied = await copyTextWithFallback(inviteUrl);
    showTemporaryMessage(copied ? 'URL copiada' : 'No se pudo copiar la URL automáticamente');
  }, [shareUrl, activeGameCode, activeInviteToken, browserLocation, game?.gameCode, loadPublicShareOrigin, showTemporaryMessage]);

  const handleViewRankings = useCallback(async () => {
    await fetchRankings();
  }, [fetchRankings]);

  const handleNavigate = useCallback((target: NavigationItem['target']) => {
    const section = document.getElementById(target);
    if (!section) return;

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!ready) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div className="glass-panel rounded-2xl px-8 py-6 text-sm uppercase tracking-[0.2em] text-brown/80 dark:text-dark-muted">Inicializando plataforma...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden selection:bg-primary/25 selection:text-brown dark:selection:text-dark-text">
      <AmbientBackground />

      {!loggedIn ? (
        <div className="relative z-10 flex min-h-screen w-full flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-10">
            <Brand />
            <div className="flex items-center gap-3 sm:gap-8">
              <nav className="hidden gap-6 text-sm font-medium text-brown/80 dark:text-dark-muted md:flex">
                {topNavItems.map((item) => (
                  <button
                    key={item.target}
                    type="button"
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => handleNavigate(item.target)}
                    className="transition-colors hover:text-primary"
                  >
                    {item.target === 'inicio' ? (
                      <IconHome className="h-5 w-5 shrink-0" />
                    ) : item.target === 'reglas' ? (
                      <IconBook className="h-5 w-5 shrink-0" />
                    ) : item.target === 'admin' ? (
                      <IconShield className="h-5 w-5 shrink-0" />
                    ) : (
                      <IconTrophy className="h-5 w-5 shrink-0" />
                    )}
                  </button>
                ))}
              </nav>
              <button
                type="button"
                aria-label="Ayuda"
                title="Ayuda"
                onClick={() => handleNavigate('reglas')}
                className="hidden h-10 w-10 shrink-0 rounded-full border border-brown/30 bg-beige/80 text-sm font-semibold text-brown transition-all hover:bg-primary/20 hover:border-primary/40 hover:text-primary active:scale-[0.98] dark:border-white/15 dark:bg-dark-card dark:text-dark-text dark:hover:bg-primary/15 sm:inline-flex sm:items-center sm:justify-center"
              >
                <IconHelp className="h-5 w-5 shrink-0" />
              </button>
            </div>
          </header>
          <nav className="mx-4 mb-3 flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
            {topNavItems.map((item) => (
              <button
                key={`mobile-login-${item.target}`}
                type="button"
                aria-label={item.label}
                title={item.label}
                onClick={() => handleNavigate(item.target)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brown/20 bg-beige/80 text-xs font-semibold text-brown transition-colors hover:border-leaf hover:text-leaf active:scale-[0.98] dark:border-white/15 dark:bg-dark-card dark:text-dark-text dark:hover:text-primary"
              >
                {item.target === 'inicio' ? (
                  <IconHome className="h-4 w-4 shrink-0" />
                ) : item.target === 'reglas' ? (
                  <IconBook className="h-4 w-4 shrink-0" />
                ) : item.target === 'admin' ? (
                  <IconShield className="h-4 w-4 shrink-0" />
                ) : (
                  <IconTrophy className="h-4 w-4 shrink-0" />
                )}
              </button>
            ))}
          </nav>

          <main id="inicio" className="flex flex-1 items-start justify-center px-4 pb-6 pt-2 sm:px-6 md:items-center md:px-12">
            <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-primary/15 bg-white/80 shadow-2xl shadow-primary/10 backdrop-blur-xl dark:border-primary/20 dark:bg-dark-card/90 dark:shadow-primary/5 md:grid md:grid-cols-5">
              <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary/10 via-transparent to-leaf/10 p-8 dark:from-primary/15 dark:to-leaf/10 md:col-span-3 md:flex lg:p-10">
                <div className="absolute -right-10 -top-10 text-[120px] opacity-[0.06]">🍍</div>
                <div className="absolute -bottom-6 -left-6 text-[80px] opacity-[0.04]">🎯</div>
                <div className="relative space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-leaf/30 bg-leaf/10 px-3 py-1 dark:border-leaf-soft/30 dark:bg-leaf-soft/10">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-leaf dark:bg-leaf-soft" />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-leaf dark:text-leaf-soft">Modo competitivo</span>
                  </div>
                  <h3 className="text-3xl font-black leading-[1.05] tracking-tight text-[#4a3f32] dark:text-dark-text lg:text-4xl">
                    Piensa cada jugada.<br />
                    <span className="text-primary">Evita la última canica.</span>
                  </h3>
                  <p className="max-w-sm text-sm leading-relaxed text-[#6b5d4f] dark:text-dark-muted lg:text-base">
                    Reto 1v1 con regla misère: estrategia en vivo, gratis y con buen rollo. Reta a un amigo y comparte el enlace: así crece el juego.
                  </p>
                </div>
                <div className="relative mt-8 flex gap-6">
                  <div className="flex items-center gap-3 rounded-xl bg-white/50 px-4 py-3 dark:bg-dark-surface/60">
                    <span className="text-2xl">🤝</span>
                    <div>
                      <p className="text-xl font-black text-[#4a3f32] dark:text-dark-text">1v1</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Fair play</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/50 px-4 py-3 dark:bg-dark-surface/60">
                    <span className="text-2xl">🧠</span>
                    <div>
                      <p className="text-xl font-black text-[#4a3f32] dark:text-dark-text">Misère</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Regla inversa</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center p-6 sm:p-8 md:col-span-2 md:p-8 lg:p-10">
                <div className="mb-6 text-center md:text-left">
                  <span className="text-3xl md:hidden">🍍</span>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-[#4a3f32] dark:text-dark-text sm:text-3xl md:mt-0">Entrar</h1>
                  <p className="mt-2 text-sm text-[#8c7d6b] dark:text-dark-muted">
                    Elige tu alias. Aquí mandan el respeto, las risas y las revanchas con abrazo virtual.
                  </p>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleLogin();
                  }}
                >
                  <div className="space-y-1.5">
                    <label htmlFor="player-name-input" className="text-[10px] font-black uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">
                      Tu nombre
                    </label>
                    <div className="group relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#b5a898] transition-colors group-focus-within:text-primary">
                        <IconUser className="h-5 w-5" />
                      </div>
                      <input
                        id="player-name-input"
                        className="h-12 w-full rounded-xl border border-[#d4cbbf] bg-white/90 pl-11 pr-4 text-sm font-medium text-[#4a3f32] placeholder:text-[#b5a898] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-white/15 dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:border-primary"
                        placeholder="Escribe tu alias..."
                        type="text"
                        value={aliasInput}
                        onChange={(event) => setAliasInput(event.target.value)}
                        maxLength={32}
                      />
                    </div>
                  </div>

                  <button
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold uppercase tracking-wider text-[#4a3f32] shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97] dark:shadow-primary/15"
                    type="submit"
                    aria-label="Entrar al lobby"
                    title="Entrar al lobby"
                  >
                    <span className="text-sm">Jugar</span>
                    <IconArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                </form>

                <div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-[#b5a898] dark:text-dark-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    Online
                  </span>
                  <span>·</span>
                  <span>Tiempo real</span>
                  <span>·</span>
                  <span>Registro automático</span>
                </div>
              </div>
            </div>
          </main>

          <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-6 sm:px-6 md:px-12 md:pb-8 lg:grid-cols-2">
            <article id="reglas" className="overflow-hidden rounded-2xl border border-leaf/10 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-dark-card/80 md:p-6">
              <div className="flex items-center gap-2">
                <span className="text-lg">📜</span>
                <h3 className="text-sm font-black uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">Reglas</h3>
              </div>
              <KeyInstructionsCard />
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Detalle</p>
              <ul className="mt-1 space-y-1.5 text-sm leading-relaxed text-[#6b5d4f] dark:text-dark-muted">
                {quickRules.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span className="mt-0.5 text-primary">●</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article id="ranking" className="overflow-hidden rounded-2xl border border-primary/10 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-dark-card/80 md:p-6">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h3 className="text-sm font-black uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">Puntuación</h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#8c7d6b] dark:text-dark-muted">{scoringDescription}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {scoringRulesRows.map((r) => (
                  <div key={r.label} className="rounded-lg bg-white/60 px-3 py-2 text-center dark:bg-dark-surface/80">
                    <p className={`text-lg font-black ${r.pts.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{r.pts}</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">{r.label}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <footer className="px-6 pb-6 pt-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#b5a898] dark:text-dark-muted">
              🍍 Canicas Try Again · Juega bien · Comparte mejor · 2026
            </p>
          </footer>
        </div>
      ) : (
        <div className="relative z-10 flex min-h-screen w-full flex-col">
          {!isWaitingForOpponent ? (
            <>
              <header className={[
                'flex items-center justify-between gap-3',
                isGameMode ? 'px-3 py-2 sm:px-4' : 'px-4 py-3 sm:px-6 md:px-8'
              ].join(' ')}>
                {isGameMode ? (
                  <div className="flex w-full items-center gap-2 rounded-2xl bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur dark:bg-dark-card/90 dark:shadow-none sm:px-3">
                    <button
                      ref={gameMenuTriggerButtonRef}
                      type="button"
                      onClick={() => setShowGameMenu((previous) => !previous)}
                      aria-label="Abrir menú"
                      title="Abrir menú"
                      aria-expanded={showGameMenu}
                      aria-controls="game-menu-drawer"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#4a3f32] transition-colors hover:bg-primary/10 hover:text-primary active:scale-95 dark:text-dark-text dark:hover:bg-primary/15"
                    >
                      <IconMenu className="h-5 w-5 shrink-0" />
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <div
                          className={[
                            'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider',
                            canInteract
                              ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                              : 'bg-slate-500/10 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400'
                          ].join(' ')}
                        >
                          {canInteract ? '🟢 Tu turno' : '⏳ Rival'} · max {turnLimit}
                        </div>
                        <div
                          aria-live="polite"
                          className={[
                            'rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]',
                            syncStatus.tone === 'live'
                              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400'
                              : syncStatus.tone === 'syncing'
                                ? 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300'
                                : syncStatus.tone === 'lagging'
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
                                  : 'border-brown/15 bg-sand/55 text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface dark:text-dark-muted'
                          ].join(' ')}
                          title={syncStatus.detail}
                        >
                          {syncStatus.shortLabel}
                        </div>
                      </div>
                      {game && (
                        <div className="flex min-w-0 flex-col items-center gap-0.5">
                          <span className="max-w-full truncate text-[9px] font-medium text-[#8c7d6b] dark:text-dark-muted">
                            {game.player1?.name ?? '?'} vs {game.player2?.name ?? '?'}
                          </span>
                          <span className="max-w-full truncate text-[9px] font-semibold text-[#9a8c7c] dark:text-dark-muted/90">
                            {syncStatus.detail}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleManualRefresh()}
                      disabled={isSyncing || isBusy}
                      aria-label="Refrescar"
                      title="Refrescar"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8c7d6b] transition-colors hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-40 dark:text-dark-muted dark:hover:bg-primary/15"
                    >
                      <IconRefresh className="h-4 w-4 shrink-0" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Brand />
                    <div className="flex items-center gap-4">
                      <nav className="hidden gap-6 text-sm font-medium text-brown/80 dark:text-dark-muted md:flex">
                        {topNavItems.map((item) => (
                          <button
                            key={`menu-${item.target}`}
                            type="button"
                            aria-label={item.label}
                            title={item.label}
                            onClick={() => handleNavigate(item.target)}
                            className="transition-colors hover:text-primary"
                          >
                            {item.target === 'inicio' ? (
                              <IconHome className="h-5 w-5 shrink-0" />
                            ) : item.target === 'reglas' ? (
                              <IconBook className="h-5 w-5 shrink-0" />
                            ) : item.target === 'admin' ? (
                              <IconShield className="h-5 w-5 shrink-0" />
                            ) : (
                              <IconTrophy className="h-5 w-5 shrink-0" />
                            )}
                          </button>
                        ))}
                      </nav>
                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        aria-label="Eliminar cuenta"
                        title="Eliminar cuenta"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/10 text-sm font-semibold text-rose-500 transition-all hover:bg-rose-500 hover:text-white active:scale-[0.98]"
                      >
                        <IconTrash className="h-5 w-5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        aria-label="Cerrar sesión"
                        title="Cerrar sesión"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary transition-all hover:bg-primary hover:text-brown active:scale-[0.98]"
                      >
                        <IconLogout className="h-5 w-5 shrink-0" />
                      </button>
                    </div>
                  </>
                )}
              </header>
              {!isGameMode ? (
                <nav className="mx-4 mb-2 flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
                  {topNavItems.map((item) => (
                    <button
                      key={`mobile-game-${item.target}`}
                      type="button"
                      aria-label={item.label}
                      title={item.label}
                      onClick={() => handleNavigate(item.target)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brown/20 bg-beige/80 text-xs font-semibold text-brown transition-colors hover:border-leaf hover:text-leaf active:scale-[0.98] dark:border-white/15 dark:bg-dark-card dark:text-dark-text dark:hover:text-primary"
                    >
                      {item.target === 'inicio' ? (
                        <IconHome className="h-4 w-4 shrink-0" />
                      ) : item.target === 'reglas' ? (
                        <IconBook className="h-4 w-4 shrink-0" />
                      ) : item.target === 'admin' ? (
                        <IconShield className="h-4 w-4 shrink-0" />
                      ) : (
                        <IconTrophy className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  ))}
                </nav>
              ) : null}
            </>
          ) : null}

          <main className={[
            'flex w-full flex-1 flex-col',
            isGameMode ? 'gap-0' : 'mx-auto max-w-7xl gap-6 px-4 pb-24 md:px-8'
          ].join(' ')}>
            {isWaitingForOpponent ? (
              <section id="inicio" className="flex flex-1 items-center justify-center px-4">
                <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-primary/20 bg-white/90 p-6 text-center shadow-2xl shadow-primary/10 backdrop-blur-xl dark:border-primary/25 dark:bg-dark-card/95 dark:shadow-primary/5 sm:p-8">
                  <div className="absolute -left-6 -top-6 text-[80px] opacity-[0.05]">🍍</div>
                  <div className="absolute -bottom-4 -right-4 text-[60px] opacity-[0.04]">⏳</div>

                  <div className="relative">
                    <div
                      className="mx-auto h-16 w-16 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
                      role="status"
                      aria-label="Esperando rival"
                    />
                    <p className="mt-5 text-sm font-black uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">Esperando rival...</p>
                    <p className="mt-2 text-[11px] text-[#8c7d6b] dark:text-dark-muted">
                      {hasLiveChannel
                        ? '🟢 Canal en vivo activo'
                        : isSyncing
                          ? 'Sincronizando...'
                          : lastSyncLabel
                            ? `Última sync: ${lastSyncLabel}`
                            : 'Conectando...'}
                    </p>

                    <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-[10px] leading-relaxed text-[#8c7d6b] dark:text-dark-muted">
                      {waitingRoomTips.map((tip) => (
                        <li key={tip} className="flex gap-2">
                          <span className="shrink-0 text-primary">💡</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mx-auto mt-6 w-fit rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 px-6 py-4 dark:from-primary/15 dark:to-primary/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#8c7d6b] dark:text-dark-muted">Código</p>
                      <p className="mt-1 text-3xl font-black tracking-[0.25em] text-primary">{game?.gameCode}</p>
                    </div>

                    <div className="mt-6 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleCopyCode()}
                        className="flex h-11 items-center gap-2 rounded-xl border border-[#d4cbbf] bg-white/80 px-4 text-xs font-bold uppercase tracking-wider text-[#4a3f32] transition-all hover:border-primary hover:text-primary active:scale-[0.97] dark:border-white/15 dark:bg-dark-surface dark:text-dark-text dark:hover:border-primary"
                        aria-label="Copiar código"
                        title="Copiar código"
                      >
                        <IconCopy className="h-4 w-4 shrink-0" />
                        <span>Copiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyUrl()}
                        className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold uppercase tracking-wider text-[#4a3f32] shadow-md shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.97]"
                        aria-label="Compartir enlace"
                        title="Compartir enlace"
                      >
                        <IconLinkExternal className="h-4 w-4 shrink-0" />
                        <span>Invitar</span>
                      </button>
                    </div>

                    <p className="mt-4 text-[11px] leading-relaxed text-[#8c7d6b] dark:text-dark-muted">
                      {shareStatusText}
                    </p>

                    <div className="mt-5 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleManualRefresh()}
                        disabled={isSyncing || isBusy}
                        aria-label="Actualizar"
                        title="Actualizar"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#8c7d6b] transition-colors hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-40 dark:text-dark-muted"
                      >
                        <IconRefresh className="h-4 w-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleLeaveGame()}
                        disabled={isBusy}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#8c7d6b] transition-colors hover:bg-rose-500/10 hover:text-rose-500 active:scale-95 disabled:opacity-40 dark:text-dark-muted"
                        aria-label="Cancelar partida"
                        title="Cancelar partida"
                      >
                        <IconClose className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <>
            {!game ? (
              <>
                <section id="inicio" className="space-y-6">
                  <div className="text-center">
                    <span className="text-4xl">🍍</span>
                    <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-[#4a3f32] dark:text-dark-text sm:text-2xl">
                      ¡A jugar!
                    </h2>
                    <p className="mt-1 text-xs text-[#8c7d6b] dark:text-dark-muted">Elige tu modo y empieza la partida</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/15 p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 dark:border-primary/25 dark:from-primary/10 dark:to-primary/5 dark:hover:shadow-primary/5">
                      <div className="absolute -right-3 -top-3 text-5xl opacity-10">🎯</div>
                      <p className="relative text-xs font-black uppercase tracking-wider text-primary">Crear partida</p>
                      <p className="relative mt-1 text-[11px] text-[#8c7d6b] dark:text-dark-muted">Elige las filas y espera rival</p>
                      <div className="relative mt-4 flex items-end gap-3">
                        <div className="flex flex-col gap-1">
                          <label htmlFor="rows-input" className="text-[10px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">
                            Filas
                          </label>
                          <div className="inline-flex h-11 items-center rounded-xl border border-primary/30 bg-white/80 px-1.5 dark:border-primary/40 dark:bg-dark-surface">
                            <button
                              type="button"
                              onClick={() => stepRowsInput(-1)}
                              aria-label="Reducir filas"
                              title="Reducir filas"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold text-[#6b5d4f] transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.96] dark:text-dark-muted"
                            >
                              -
                            </button>
                            <input
                              id="rows-input"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={2}
                              value={rowsInput}
                              onChange={(event) => handleRowsInputChange(event.target.value)}
                              onBlur={handleRowsInputBlur}
                              className="h-9 w-12 bg-transparent px-1 text-center text-sm font-black text-[#4a3f32] outline-none dark:text-dark-text"
                            />
                            <button
                              type="button"
                              onClick={() => stepRowsInput(1)}
                              aria-label="Aumentar filas"
                              title="Aumentar filas"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold text-[#6b5d4f] transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.96] dark:text-dark-muted"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCreateGame()}
                          disabled={isBusy}
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-bold uppercase tracking-wider text-[#4a3f32] shadow-md shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
                          aria-label="Crear partida"
                          title="Crear partida"
                        >
                          <IconPlus className="h-4 w-4 shrink-0" />
                          <span className="text-xs">Crear</span>
                        </button>
                      </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl border border-leaf/20 bg-gradient-to-br from-leaf/5 to-leaf-soft/15 p-5 transition-all hover:border-leaf/40 hover:shadow-lg hover:shadow-leaf/10 dark:border-leaf-soft/25 dark:from-leaf/10 dark:to-leaf-soft/5 dark:hover:shadow-leaf/5">
                      <div className="absolute -right-3 -top-3 text-5xl opacity-10">🎮</div>
                      <p className="relative text-xs font-black uppercase tracking-wider text-leaf dark:text-leaf-soft">Unirse</p>
                      <p className="relative mt-1 text-[11px] text-[#8c7d6b] dark:text-dark-muted">Introduce el código de tu rival</p>
                      <div className="relative mt-4 flex items-end gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <label htmlFor="join-code-input" className="text-[10px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">
                            Código
                          </label>
                          <input
                            id="join-code-input"
                            type="text"
                            value={joinCode}
                            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                            maxLength={6}
                            placeholder="ABC123"
                            className="h-11 w-full min-w-0 rounded-xl border border-leaf/30 bg-white/80 px-3 text-center text-sm font-bold uppercase tracking-[0.15em] text-[#4a3f32] placeholder:text-[#b5a898] outline-none transition-colors focus:border-leaf focus:ring-2 focus:ring-leaf/25 dark:border-leaf-soft/40 dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleJoinGame()}
                          disabled={isBusy}
                          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-leaf bg-leaf/10 px-5 font-bold uppercase tracking-wider text-leaf transition-all hover:bg-leaf hover:text-white active:scale-[0.97] disabled:opacity-40 dark:border-leaf-soft dark:text-leaf-soft dark:hover:bg-leaf-soft dark:hover:text-[#1c1912]"
                          aria-label="Unirme a partida"
                          title="Unirme a partida"
                        >
                          <IconJoin className="h-4 w-4 shrink-0" />
                          <span className="text-xs">Unirse</span>
                        </button>
                      </div>
                    </div>
                  </div>

                <div className="space-y-5">
                  <article id="ranking" className="overflow-hidden rounded-2xl border border-primary/10 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-dark-card/80 md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏆</span>
                        <h3 className="text-sm font-black uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">Top 10</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleViewRankings()}
                        disabled={rankingsLoading}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#8c7d6b] transition-colors hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-50 dark:text-dark-muted dark:hover:bg-primary/15"
                        aria-label={rankingsLoading ? 'Actualizando…' : 'Actualizar'}
                        title={rankingsLoading ? 'Actualizando…' : 'Actualizar'}
                      >
                        <IconRefresh className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                    <div className="mt-3">
                      {rankingsLoading && rankings.length === 0 ? (
                        <p className="text-sm text-[#8c7d6b] dark:text-dark-muted">Cargando ranking…</p>
                      ) : (
                        <RankingTable rankings={rankings.slice(0, 10)} />
                      )}
                    </div>
                  </article>

                  <article id="reglas" className="overflow-hidden rounded-2xl border border-leaf/10 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-dark-card/80 md:p-6">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📜</span>
                      <h3 className="text-sm font-black uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">Reglas</h3>
                    </div>
                    <KeyInstructionsCard />
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">Detalle</p>
                    <ul className="mt-1 space-y-1.5 text-sm leading-relaxed text-[#6b5d4f] dark:text-dark-muted">
                      {quickRules.map((rule) => (
                        <li key={`lobby-rule-${rule}`} className="flex gap-2">
                          <span className="mt-0.5 text-primary">●</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-4 dark:border-primary/20 dark:bg-primary/10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⚡</span>
                        <h4 className="text-xs font-black uppercase tracking-wider text-primary">Puntuación</h4>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#8c7d6b] dark:text-dark-muted">{scoringDescription}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {scoringRulesRows.map((r) => (
                          <div key={`sr-${r.label}`} className="rounded-lg bg-white/60 px-3 py-2 text-center dark:bg-dark-surface/80">
                            <p className={`text-lg font-black ${r.pts.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{r.pts}</p>
                            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">{r.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-brown/10 bg-white/60 p-4 dark:border-white/10 dark:bg-dark-surface/80">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🛟</span>
                        <h4 className="text-xs font-black uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">Preguntas rápidas</h4>
                      </div>
                      <div className="mt-3 space-y-3">
                        {quickFaq.map((item) => (
                          <div key={item.q} className="rounded-lg border border-brown/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-dark-card/70">
                            <p className="text-[11px] font-black text-[#4a3f32] dark:text-dark-text">{item.q}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#8c7d6b] dark:text-dark-muted">{item.a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                </div>

                {isAdmin ? (
                  <div className="mt-5">
                    <AdminPanel adminId={playerId} />
                  </div>
                ) : null}
                </section>
              </>
            ) : null}

            {game ? (
              <section className={isGameMode ? 'flex flex-1 flex-col' : 'order-2'}>
                {isGameMode && game.status === 'playing' ? (
                  <div className="mx-2 mb-1.5 shrink-0 sm:mx-3">
                    <div className="rounded-2xl border border-leaf/25 bg-white/90 shadow-sm backdrop-blur dark:border-leaf-soft/20 dark:bg-dark-card/92">
                      <div className="flex items-center justify-between gap-2 border-b border-leaf/10 px-3 py-2 dark:border-white/10">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-leaf dark:text-leaf-soft">Guía y avisos</p>
                        <button
                          type="button"
                          onClick={() => setGameGuideCollapsed((c) => !c)}
                          aria-expanded={!gameGuideCollapsed}
                          className="rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#8c7d6b] transition-colors hover:bg-primary/10 hover:text-primary dark:text-dark-muted"
                        >
                          {gameGuideCollapsed ? 'Mostrar' : 'Ocultar'}
                        </button>
                      </div>
                      {!gameGuideCollapsed ? (
                        <div className="space-y-2 px-3 py-2.5">
                          <ul className="space-y-1 text-[10px] leading-snug text-[#5c5248] dark:text-dark-muted">
                            {gameKeyInstructions.map((line) => (
                              <li key={`guide-${line}`} className="flex gap-1.5">
                                <span className="shrink-0 text-primary" aria-hidden>
                                  ·
                                </span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                          <div
                            className={[
                              'rounded-xl border px-2.5 py-2 text-[10px] font-bold leading-snug',
                              canInteract
                                ? 'border-primary/30 bg-primary/10 text-[#4a3f32] dark:border-primary/35 dark:bg-primary/15 dark:text-dark-text'
                                : 'border-slate-200/80 bg-slate-500/5 text-[#6b5d4f] dark:border-white/10 dark:bg-white/[0.04] dark:text-dark-muted'
                            ].join(' ')}
                            role="status"
                          >
                            {!canInteract
                              ? 'Turno del rival. Si el tablero no cambia, usa el botón de refrescar del encabezado.'
                              : pendingMove
                                ? `Selección lista: fila ${pendingMove.rowIndex + 1}, ${pendingMove.endIndex - pendingMove.startIndex + 1} canica(s). Confirma con Aplicar abajo o Cancelar para empezar otra vez.`
                                : game.yourDiceAvailable
                                  ? `Te toca jugar: hasta ${turnLimit} canica(s) en una sola fila (bloque seguido). Opcional: dado especial una vez (vista 3D, arriba a la derecha).`
                                  : `Te toca jugar: elige hasta ${turnLimit} canica(s) consecutivas en una sola fila y confirma con Aplicar.`}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {isGameMode && game.status === 'playing' ? (
                  <div key={turnBannerKey} className="turn-banner-enter mx-2 mb-2 shrink-0 sm:mx-3" aria-live="polite">
                    <div className="rounded-2xl border border-brown/15 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-dark-card/92">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8c7d6b] dark:text-dark-muted">
                            {pendingMove ? 'Selección activa' : canInteract ? 'Momento de jugar' : 'Estado de turno'}
                          </p>
                          <p className="mt-1 text-sm font-bold leading-snug text-[#4a3f32] dark:text-dark-text">
                            {turnBannerText}
                          </p>
                        </div>
                        <div
                          className={[
                            'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                            canInteract
                              ? 'turn-badge-pulse bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                              : 'bg-slate-500/10 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400'
                          ].join(' ')}
                        >
                          {canInteract ? 'Tu turno' : 'Rival'}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                          Max {turnLimit}
                        </span>
                        <span className="rounded-full border border-brown/15 bg-sand/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface dark:text-dark-muted">
                          {game.yourDiceAvailable ? 'Dado listo' : 'Dado gastado'}
                        </span>
                        <span className="rounded-full border border-brown/15 bg-sand/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface dark:text-dark-muted">
                          {latestMoveSummary}
                        </span>
                      </div>

                      <div
                        className={[
                          'mt-2 rounded-xl border px-2.5 py-2 text-[11px] font-semibold leading-snug',
                          syncStatus.tone === 'live'
                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : syncStatus.tone === 'lagging'
                              ? 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200'
                              : 'border-brown/10 bg-sand/45 text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface/80 dark:text-dark-muted'
                        ].join(' ')}
                        role="status"
                        aria-live="polite"
                      >
                        <span className="font-black uppercase tracking-[0.14em]">{syncStatus.shortLabel}</span>
                        <span className="mx-1.5 opacity-50">·</span>
                        <span>{syncStatus.hint}</span>
                      </div>

                      {canInteract ? (
                        <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 px-2.5 py-2 dark:border-primary/20 dark:bg-primary/10">
                          <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.14em]">
                            <span className="text-[#6b5d4f] dark:text-dark-muted">
                              {pendingMove ? 'Selección preparada' : 'Aún puedes elegir'}
                            </span>
                            <span className="text-primary">
                              {pendingMove
                                ? `${pendingRemoveCount}/${turnLimit} · restan ${remainingSelectionCapacity}`
                                : `${turnLimit} disponibles`}
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-brown/10 dark:bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-leaf transition-all duration-200"
                              style={{ width: `${pendingMove ? selectionUsagePercent : 0}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] leading-snug text-[#6b5d4f] dark:text-dark-muted">
                            {pendingMove
                              ? remainingSelectionCapacity > 0
                                ? `Puedes ampliar el bloque hasta ${remainingSelectionCapacity} canica${remainingSelectionCapacity === 1 ? '' : 's'} más si siguen siendo contiguas.`
                                : 'Has llegado al máximo de este turno. Ya puedes aplicar la jugada.'
                              : 'Toca una fila para empezar. Si quieres más de una, amplía solo con canicas contiguas.'}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <GameBoard
                  game={game}
                  selectedRowIndex={pendingMove?.rowIndex ?? null}
                  selectedStartIndex={pendingMove?.startIndex ?? null}
                  selectedEndIndex={pendingMove?.endIndex ?? null}
                  canInteract={canSelectBalls}
                  hasPendingMove={!!pendingMove}
                  hasTurnCoach={showTurnCoach}
                  boardAttentionPulse={boardAttentionPulse}
                  yourTurnGlow={yourTurnGlow}
                  hasLiveChannel={hasLiveChannel}
                  onBallClick={handleBallClick}
                  onDiceRoll={handleUseDice3D}
                  diceAvailable={!!game.yourDiceAvailable && canInteract}
                />
              </section>
            ) : null}
              </>
            )}
          </main>
        </div>
      )}

      {showTurnSpotlight && isGameMode && canInteract && !pendingMove ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-[4.4rem] z-[78] flex justify-center px-4 sm:top-[5rem]"
          aria-live="assertive"
        >
          <div className="turn-spotlight-enter max-w-md rounded-2xl border border-emerald-400/25 bg-emerald-500/92 px-4 py-3 text-center text-white shadow-2xl shadow-emerald-900/30 backdrop-blur-xl dark:border-emerald-300/20 dark:bg-emerald-500/82">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-50/90">Piiiiiiiishi, te toca</p>
            <p className="mt-1 text-base font-black leading-tight sm:text-lg">Haz tu jugada · máximo {turnLimit}</p>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-emerald-50/90">
              Toca el tablero y selecciona un bloque seguido en una sola fila.
            </p>
          </div>
        </div>
      ) : null}

      {showTurnCoach ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[75] flex justify-center px-4 pt-2 sm:hidden"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          aria-live="polite"
        >
          <div className="turn-coach-enter pointer-events-auto w-full max-w-lg rounded-2xl border border-emerald-500/20 bg-white/94 px-3 py-3 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-emerald-500/25 dark:bg-dark-card/94 dark:shadow-black/35">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="turn-badge-pulse rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    Tu turno
                  </span>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                    Max {turnLimit}
                  </span>
                  <span className="rounded-full border border-brown/15 bg-sand/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface dark:text-dark-muted">
                    {game?.yourDiceAvailable ? 'Dado listo' : 'Sin dado'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold leading-snug text-[#4a3f32] dark:text-dark-text">
                  Toca una fila para empezar y amplía solo con canicas contiguas.
                </p>
                <p className="mt-1 text-[11px] leading-snug text-[#8c7d6b] dark:text-dark-muted">
                  Última jugada: {latestMoveSummary}. Cuando tengas bloque válido, abajo te saldrá “Aplicar jugada”.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 self-stretch sm:self-auto">
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <button
                    type="button"
                    onClick={focusBoard}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#4a3f32] shadow-md shadow-primary/20 transition-all hover:brightness-110 active:scale-95"
                    aria-label="Ir al tablero"
                    title="Ir al tablero"
                  >
                    <span aria-hidden>🎯</span>
                    <span>Tablero</span>
                  </button>
                  {game?.yourDiceAvailable ? (
                    <button
                      type="button"
                      onClick={() => {
                        focusBoard();
                        void handleUseDice3D();
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-amber-300/45 bg-black/70 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100 shadow-lg shadow-amber-950/20 transition-all hover:border-amber-200/70 hover:bg-black/80 active:scale-95"
                      aria-label="Lanzar dado especial"
                      title="Lanzar dado especial"
                    >
                      <span aria-hidden>✨</span>
                      <span>Dado</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowGameMenu(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brown/15 bg-white/80 text-[#4a3f32] transition-colors hover:border-primary/30 hover:text-primary active:scale-95 dark:border-white/10 dark:bg-dark-surface dark:text-dark-text"
                    aria-label="Abrir menú de partida"
                    title="Abrir menú de partida"
                  >
                    <IconMenu className="h-4 w-4 shrink-0" />
                  </button>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8c7d6b] dark:text-dark-muted">
                  acceso rápido móvil
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isGameMode && pendingMove ? (
        <div
          ref={pendingActionBarRef}
          className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pt-2 sm:justify-end sm:px-6 md:px-8"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="selection-sheet-enter pointer-events-auto w-full max-w-md rounded-2xl border border-primary/20 bg-white/95 p-3 shadow-2xl shadow-black/15 backdrop-blur-xl dark:border-primary/25 dark:bg-dark-card/95 dark:shadow-black/35">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Jugada lista</p>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                    {pendingRemoveCount}/{turnLimit}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-[#4a3f32] dark:text-dark-text">
                  Fila {pendingRowLabel} · {pendingRemoveCount} canica{pendingRemoveCount === 1 ? '' : 's'}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-brown/10 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-leaf transition-all duration-200"
                    style={{ width: `${selectionUsagePercent}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[#8c7d6b] dark:text-dark-muted">
                  {remainingSelectionCapacity > 0
                    ? `Puedes ampliar ${remainingSelectionCapacity} canica${remainingSelectionCapacity === 1 ? '' : 's'} más si siguen siendo contiguas.`
                    : 'Límite del turno completado. Ya puedes aplicar la jugada.'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={clearPendingMove}
                  disabled={isBusy}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[#d4cbbf] bg-white/80 px-4 text-xs font-black uppercase tracking-wider text-[#4a3f32] transition-all hover:border-rose-400 hover:text-rose-500 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:bg-dark-surface dark:text-dark-text dark:hover:border-rose-400"
                >
                  Cancelar
                </button>
                <button
                  ref={applyMoveButtonRef}
                  type="button"
                  onClick={() => void applyPendingMove()}
                  disabled={!canInteract || isBusy}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black uppercase tracking-wider text-[#4a3f32] shadow-lg shadow-primary/25 transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 dark:focus-visible:ring-offset-[#1c1912]"
                >
                  <IconCheck className="h-4 w-4 shrink-0" />
                  <span>Aplicar jugada</span>
                </button>
              </div>
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8c7d6b] dark:text-dark-muted">
              Tip: Enter aplica · Escape cancela.
            </p>
          </div>
        </div>
      ) : null}

      {isGameMode && showGameMenu && game ? (
        <>
          <div className="drawer-backdrop fixed inset-0 z-[89] bg-black/40 backdrop-blur-sm dark:bg-black/60" onClick={() => setShowGameMenu(false)} aria-hidden />
          <div
            id="game-menu-drawer"
            ref={gameMenuPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de partida"
            className="drawer-slide-in fixed inset-y-0 right-0 z-[90] flex w-full max-w-xs flex-col bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-dark-card sm:max-w-sm"
          >
            <div className="flex items-center justify-between border-b border-brown/10 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">🍍</span>
                <p className="text-sm font-bold uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">Partida</p>
              </div>
              <button
                ref={gameMenuCloseButtonRef}
                type="button"
                onClick={() => setShowGameMenu(false)}
                aria-label="Cerrar menú"
                title="Cerrar menú"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#4a3f32] transition-colors hover:bg-black/5 active:scale-95 dark:text-dark-text dark:hover:bg-white/10"
              >
                <IconClose className="h-5 w-5 shrink-0" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
              <div className="mx-1 mb-2 rounded-2xl border border-primary/15 bg-primary/5 p-3 dark:border-primary/20 dark:bg-primary/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                      canInteract
                        ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'bg-slate-500/10 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400'
                    ].join(' ')}
                  >
                    {gameMenuSummaryText}
                  </span>
                  <span className="rounded-full border border-brown/15 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface dark:text-dark-muted">
                    {syncStatus.shortLabel}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-snug text-[#4a3f32] dark:text-dark-text">
                  Última jugada: {latestMoveSummary}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#8c7d6b] dark:text-dark-muted">
                  {syncStatus.detail}
                </p>
                {game.gameCode ? (
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8c7d6b] dark:text-dark-muted">
                    Código · <span className="text-primary">{game.gameCode}</span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGameMenu(false);
                  void handleManualRefresh();
                }}
                disabled={isSyncing || isBusy}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#4a3f32] transition-colors hover:bg-primary/10 active:scale-[0.98] disabled:opacity-40 dark:text-dark-text dark:hover:bg-primary/15"
              >
                <IconRefresh className="h-5 w-5 shrink-0 text-primary" />
                <span>Actualizar estado</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGameMenu(false);
                  void handleCopyUrl();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#4a3f32] transition-colors hover:bg-primary/10 active:scale-[0.98] dark:text-dark-text dark:hover:bg-primary/15"
              >
                <IconLinkExternal className="h-5 w-5 shrink-0 text-primary" />
                <span>Compartir enlace</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                aria-expanded={showHistory}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#4a3f32] transition-colors hover:bg-primary/10 active:scale-[0.98] dark:text-dark-text dark:hover:bg-primary/15"
              >
                <IconHistory className="h-5 w-5 shrink-0 text-primary" />
                <span>{showHistory ? 'Ocultar historial' : 'Ver historial'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowKeyRulesInMenu((prev) => !prev)}
                aria-expanded={showKeyRulesInMenu}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#4a3f32] transition-colors hover:bg-primary/10 active:scale-[0.98] dark:text-dark-text dark:hover:bg-primary/15"
              >
                <IconBook className="h-5 w-5 shrink-0 text-primary" />
                <span>{showKeyRulesInMenu ? 'Ocultar instrucciones' : 'Instrucciones clave'}</span>
              </button>
              {showKeyRulesInMenu ? (
                <div className="mx-1 rounded-xl border border-brown/10 bg-background-dark/50 p-3 dark:border-white/10 dark:bg-dark-surface/90">
                  <ul className="space-y-2 text-[11px] font-medium leading-snug text-[#4a3f32] dark:text-dark-text">
                    {gameKeyInstructions.map((line) => (
                      <li key={`menu-rule-${line}`} className="flex gap-2">
                        <span className="shrink-0 text-primary">▸</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[10px] leading-relaxed text-[#8c7d6b] dark:text-dark-muted">
                    Reglas completas en la pantalla principal del lobby (sección Reglas). Objetivo: misère (quien quita la última canica pierde).
                  </p>
                </div>
              ) : null}
              {game.status !== 'finished' ? (
                <button
                  type="button"
                  onClick={() => { void handleLeaveGame(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/10 active:scale-[0.98] dark:text-rose-400 dark:hover:bg-rose-500/15"
                >
                  <IconLogout className="h-5 w-5 shrink-0" />
                  <span>Abandonar partida</span>
                </button>
              ) : null}

              {showHistory ? (
                <div className="mt-2 max-h-[40vh] space-y-1.5 overflow-y-auto rounded-xl border border-brown/10 bg-background-dark/60 p-2 dark:border-white/10 dark:bg-dark-surface/80">
                  {game.moveHistory.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#8c7d6b] dark:text-dark-muted">Sin jugadas todavía</p>
                  ) : (
                    game.moveHistory
                      .slice()
                      .reverse()
                      .map((move, index) => {
                        const turnNumber = game.moveHistory.length - index;
                        const player = move.player === 1 ? game.player1?.name : game.player2?.name;
                        const detail = move.fromDice
                          ? formatDiceEffectSummary(move.dicePower, move.affectedCount)
                          : `×${move.count} fila ${move.rowIndex + 1}`;
                        return (
                          <div
                            key={`${move.timestamp}-${index}`}
                            className="flex items-center justify-between rounded-lg px-3 py-2 text-[11px] text-[#5c5248] dark:text-dark-muted"
                          >
                            <span className="font-bold text-primary">T{turnNumber}</span>
                            <span className="text-right">
                              <span className="font-semibold text-[#4a3f32] dark:text-dark-text">
                                {player ?? `J${move.player}`}
                              </span>{' '}
                              <span className="text-[#8c7d6b] dark:text-dark-muted">{detail}</span>
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              ) : null}
            </div>

            <div className="border-t border-brown/10 px-4 py-3 dark:border-white/10">
              <p className="text-center text-[9px] font-bold uppercase tracking-widest text-[#8c7d6b] dark:text-dark-muted">
                🍍 Canicas Try Again
              </p>
            </div>
          </div>
        </>
      ) : null}

      {message ? (
        <div className="toast-slide-down fixed inset-x-4 top-4 z-[100] rounded-2xl border border-primary/20 bg-white/95 px-4 py-3 text-sm font-bold text-[#4a3f32] shadow-xl shadow-primary/10 backdrop-blur-xl dark:border-primary/25 dark:bg-dark-card/95 dark:text-dark-text dark:shadow-primary/5 sm:inset-x-auto sm:right-6 sm:max-w-sm" role="status" aria-live="polite">
          <span className="mr-2">🍍</span>{message}
        </div>
      ) : null}

      {game?.status === 'finished' ? (
        <VictoryOverlay
          isWin={game.winner === game.yourPlayerNumber}
          winnerName={game.winner ? (game.winner === 1 ? game.player1?.name : game.player2?.name) ?? '' : ''}
          playerName={playerName}
          rivalName={
            game.yourPlayerNumber === 1
              ? game.player2?.name ?? ''
              : game.yourPlayerNumber === 2
                ? game.player1?.name ?? ''
                : ''
          }
          shareOrigin={shareResultOrigin}
          onToast={showTemporaryMessage}
          onExit={() => {
            clearGame();
            clearError();
            setPendingMove(null);
            setShowGameMenu(false);
            setShowKeyRulesInMenu(false);
            setGameGuideCollapsed(false);
            setSharedCode('');
            setSharedInviteToken('');
            setJoinCode('');
          }}
          onNewGame={() => {
            clearGame();
            clearError();
            setPendingMove(null);
            setShowGameMenu(false);
            setShowKeyRulesInMenu(false);
            setGameGuideCollapsed(false);
            setSharedCode('');
            setSharedInviteToken('');
            setJoinCode('');
            void createNewGame({ playerName, numRows: normalizedRowsInput });
          }}
        />
      ) : null}

      {showPasswordModal ? (
        <PasswordModal
          alias={pendingAlias}
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
        />
      ) : null}

      {showDeleteModal ? (
        <DeleteAccountModal
          alias={playerName}
          playerId={playerId}
          onDeleted={handleAccountDeleted}
          onCancel={() => setShowDeleteModal(false)}
        />
      ) : null}
    </div>
  );
}

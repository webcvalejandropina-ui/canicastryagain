"use client";

import Image from "next/image";
import { MIN_ROWS, MAX_ROWS, DEFAULT_ROWS, marbleCount } from "@/shared/gameConfig";

import { InstallAppButton } from "@/features/pwa/PwaProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { MatchArena } from "@/features/game/components/MatchArena";
import { request } from "@/features/game/api/gameApi";
import { useRemoteGame } from "@/features/game/hooks/useRemoteGame";
import { validateMove } from "@/features/game/lib/validateMove";
import { RivalsPanel } from "@/features/social/RivalsPanel";
import { RankingPanel } from "@/features/ranking/components/RankingPanel";
import { CanicasBrand } from "@/features/brand/components/CanicasBrand";
import { useRankings } from "@/features/ranking/hooks/useRankings";
import { usePlayerIdentity } from "@/features/session/hooks/usePlayerIdentity";
import { PasswordModal } from "@/features/lobby/components/PasswordModal";
import { DeleteAccountModal } from "@/features/lobby/components/DeleteAccountModal";
import { LandingExperience } from "@/features/lobby/components/LandingExperience";
import { AppearanceButton } from "@/features/appearance/AppearanceSettings";
import { AdminPanel } from "@/features/admin/components/AdminPanel";

type NavigationItem = {
  label: string;
  target: "inicio" | "reglas" | "ranking" | "admin";
};

const baseNavItems: NavigationItem[] = [
  { label: "Inicio", target: "inicio" },
  { label: "Reglas", target: "reglas" },
  { label: "Ranking", target: "ranking" },
];


const RUNTIME_CONFIG_ENDPOINT = "/api/runtime-config";

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
  const digits = rawValue.replace(/\D/g, "").slice(0, 3);
  if (!digits) return "";
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.min(MAX_ROWS, Math.max(0, parsed)));
}

function isPrivateShareHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  )
    return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
  if (/\.local$/i.test(hostname)) return true;
  return false;
}

function normalizePublicShareOrigin(
  rawValue: string | null | undefined,
): string | null {
  const candidate = rawValue?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function buildInviteUrl(
  baseOrigin: string,
  pathname: string,
  gameCode: string,
  inviteToken: string,
): string {
  void pathname;
  const inviteUrl = new URL("/invitar", baseOrigin);
  if (inviteToken.startsWith("cta2.")) {
    inviteUrl.hash = new URLSearchParams({invite:inviteToken}).toString();
    return inviteUrl.toString();
  }
  inviteUrl.searchParams.set("code", gameCode);
  inviteUrl.searchParams.set("inv", inviteToken);
  return inviteUrl.toString();
}

/** Reglas detalladas (lobby y menú). */
const quickRules = [
  "Objetivo (misère): pierdes si retiras la última canica, con una jugada normal o con el dado.",
  "Dejar una sola canica no termina la partida: el rival todavía puede jugar o usar su dado si lo conserva.",
  "Cada turno solo una fila con canicas; en ese turno quitas entre 1 y N canicas, donde N es el número de jugada global (1.ª jugada → 1 como máx., 2.ª → 2, etc.).",
  "Las canicas deben ser consecutivas en la fila, sin saltar huecos: un solo bloque continuo por jugada.",
  "Si en la fila quedan menos canicas que tu máximo permitido, solo puedes quitar las que haya en ese bloque.",
  "Puedes elegir cualquier bloque válido dentro de la fila; no hace falta empezar por un extremo.",
  "Selecciona canicas tocándolas (o clic); cuando el bloque sea válido, pulsa Quitar para enviar la jugada.",
  "Dado especial: una sola vez por jugador, desde el panel de partida. Su efecto es aleatorio y cuenta como una jugada.",
  "Una misma fila puede usarse en varios turnos mientras queden canicas.",
  "Elige la vista Mesa o 3D. Las reglas y la selección son las mismas en ambas.",
];

/** Resumen muy corto para cabeceras y guías. */
const gameKeyInstructions: string[] = [
  "Pierdes si quitas la última canica (misère).",
  "Solo una fila por turno; bloque consecutivo de canicas.",
  "El número de jugada indica el máximo de canicas que puedes retirar.",
  "Selecciona tocando → Aplicar para confirmar.",
  "Dado especial: un uso por jugador desde el panel de partida.",
];

function KeyInstructionsCard(): React.ReactElement {
  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 dark:border-primary/35 dark:from-primary/20 dark:via-primary/10 dark:to-transparent">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
        Instrucciones clave
      </p>
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
  antigua: "Tirada antigua — elige una canica y lánzala con el dedo",
  bomba: "Bomba — destruyó toda una fila",
  rayo: "Rayo — eliminó una canica de cada fila",
  diagonal: "Diagonal — eliminó canicas en diagonal",
  resurreccion: "Resurrección — recuperó canicas al azar",
  avalancha:"Avalancha — caída en cadena",
  remolino:"Remolino — mezcló las posiciones",
  fantasma:"Fantasma — atravesó los huecos de una fila",
};

const scoringRulesRows = [
  { label: "Victoria ante rival mucho mejor", pts: "+15" },
  { label: "Victoria ante rival mejor", pts: "+13" },
  { label: "Victoria ante rival similar", pts: "+10" },
  { label: "Victoria ante rival peor", pts: "+8" },
  { label: "Victoria ante rival mucho peor", pts: "+5" },
  { label: "Derrota ante rival mucho mejor", pts: "-2" },
  { label: "Derrota ante rival mejor", pts: "-4" },
  { label: "Derrota ante rival similar", pts: "-6" },
  { label: "Derrota ante rival peor", pts: "-10" },
  { label: "Derrota ante rival mucho peor", pts: "-12" },
  { label: "Abandono", pts: "-18" },
];

const scoringDescription =
  "La puntuación depende del resultado y del win rate relativo entre ambos jugadores. Ganar contra rivales con mejor win rate da más puntos; perder contra rivales con peor win rate resta más. Abandonar siempre resta -18.";

function IconLogout({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 5.5H6.8A1.8 1.8 0 0 0 5 7.3v9.4A1.8 1.8 0 0 0 6.8 18.5H10" />
      <path d="M14 8.5 18 12l-4 3.5" />
      <path d="M17.5 12H10" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconJoin({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="3" />
      <path d="M4.5 18.5A4.5 4.5 0 0 1 9 15h0a4.5 4.5 0 0 1 4.5 3.5" />
      <path d="M16 8.5h3" />
      <path d="M17.5 7v3" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function Brand(): React.ReactElement {return <CanicasBrand tagline/>;}

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

export function HomePage(): React.ReactElement {
  const router = useRouter();
  const [privateInvitation, setPrivateInvitation] = useState(true);
  const [invitationReady, setInvitationReady] = useState("");
  const [invitationEntryError, setInvitationEntryError] = useState("");
  const [invitationRetry, setInvitationRetry] = useState(0);
  const invitationBoot = useRef("");
  const [sharedCode, setSharedCode] = useState("");
  const [sharedInviteToken, setSharedInviteToken] = useState("");
  const [publicShareOrigin, setPublicShareOrigin] = useState<string | null>(
    null,
  );
  const [publicShareOriginStatus, setPublicShareOriginStatus] = useState<
    "idle" | "loading" | "ready" | "missing"
  >("idle");
  const [browserLocation, setBrowserLocation] =
    useState<BrowserLocationState | null>(null);

  const { ready, playerId, playerName, isAdmin, loginWithServer, logout } =
    usePlayerIdentity();
  const {
    game,
    openGames,openGame,
    isBusy,
    isSyncing,
    connection,
    error,
    errorCode,
    clearError,
    clearGame,
    createNewGame,
    joinExistingGame,
    leaveCurrentGame,
    refreshGame,
    sendMove,
    sendDice,
  } = useRemoteGame(playerId);
  const {
    rankings,
    loading: rankingsLoading,
    error: rankingsError,
    fetchRankings,
  } = useRankings();

  const [rowsInput, setRowsInput] = useState(String(DEFAULT_ROWS));
  const normalizedRowsInput = useMemo(
    () => normalizeRowsInput(rowsInput),
    [rowsInput],
  );
  const [aliasInput, setAliasInput] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAlias, setPendingAlias] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    rowIndex: number;
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const autoJoinAttemptedRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const moveInFlightRef = useRef(false);
  const recoverableJoinErrorCodes = useMemo(
    () =>
      new Set([
        "GAME_NOT_FOUND",
        "GAME_EXPIRED",
        "INVITE_TOKEN_REVOKED",
        "INVALID_INVITE_TOKEN",
      ]),
    [],
  );

  const loggedIn = playerId.length > 0 && playerName.trim().length > 0;

  const topNavItems = useMemo<NavigationItem[]>(() => {
    if (!isAdmin) return baseNavItems;
    return [...baseNavItems, { label: "Admin", target: "admin" }];
  }, [isAdmin]);

  const isWaitingForOpponent = game?.status === "waiting";
  const activeGameCode = game?.gameCode ?? "";
  const activeInviteToken = game?.inviteToken ?? "";
  const isPrivateOrigin = browserLocation?.isPrivateOrigin ?? false;
  const canInteract =
    game?.status === "playing" &&
    !game.pendingAncientShot &&
    game.yourPlayerNumber !== null &&
    game.yourPlayerNumber === game.currentTurn;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    setSharedCode(params.get("code")?.trim().toUpperCase() ?? "");
    setSharedInviteToken(params.get("inv")?.trim() ?? new URLSearchParams(window.location.hash.slice(1)).get("invite")?.trim() ?? "");
    setBrowserLocation({
      origin: window.location.origin,
      pathname: window.location.pathname,
      hostname: window.location.hostname,
      isPrivateOrigin: isPrivateShareHost(window.location.hostname),
    });
  }, []);

  const loadPublicShareOrigin = useCallback(async (): Promise<
    string | null
  > => {
    if (!browserLocation) return null;

    if (!browserLocation.isPrivateOrigin) {
      setPublicShareOrigin(browserLocation.origin);
      setPublicShareOriginStatus("ready");
      return browserLocation.origin;
    }

    setPublicShareOriginStatus("loading");

    try {
      const response = await fetch(RUNTIME_CONFIG_ENDPOINT, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudo consultar la URL publica");
      }

      const payload = (await response
        .json()
        .catch(() => ({}))) as RuntimeConfigPayload;
      const resolvedOrigin = normalizePublicShareOrigin(
        payload.publicShareOrigin,
      );
      setPublicShareOrigin(resolvedOrigin);
      setPublicShareOriginStatus(resolvedOrigin ? "ready" : "missing");
      return resolvedOrigin;
    } catch {
      setPublicShareOrigin(null);
      setPublicShareOriginStatus("missing");
      return null;
    }
  }, [browserLocation]);

  const shareUrl = useMemo(() => {
    if (!browserLocation) return "";
    if (!activeGameCode || !activeInviteToken) return "";
    const baseOrigin = isPrivateOrigin
      ? publicShareOrigin
      : browserLocation.origin;
    if (!baseOrigin) return "";

    return buildInviteUrl(
      baseOrigin,
      browserLocation.pathname,
      activeGameCode,
      activeInviteToken,
    );
  }, [
    activeGameCode,
    activeInviteToken,
    browserLocation,
    isPrivateOrigin,
    publicShareOrigin,
  ]);

  const shareStatusText = useMemo(() => {
    if (!isWaitingForOpponent || !browserLocation) return "";
    if (game?.privateInvitation) return shareUrl
      ? "Solo quien tenga el enlace puede entrar. Se cierra al llegar tu rival."
      : "Abre el juego desde su dirección pública para enviar el enlace a otro móvil.";

    if (!isPrivateOrigin) {
      return "Comparte el enlace o el código con tu rival.";
    }

    if (shareUrl) {
      try {
        return `Invitación pública lista: ${new URL(shareUrl).host}`;
      } catch {
        return "Invitación pública lista para compartir.";
      }
    }

    if (publicShareOriginStatus === "loading") {
      return "Buscando la URL pública para compartir...";
    }

    return "Comparte el código con alguien conectado a esta misma dirección del juego.";
  }, [
    game?.privateInvitation,
    browserLocation,
    isWaitingForOpponent,
    isPrivateOrigin,
    shareUrl,
    publicShareOriginStatus,
  ]);

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

    if (game?.privateInvitation) {
      const url = new URL(window.location.href);
      url.searchParams.delete("code"); url.searchParams.delete("inv");
      if (new URLSearchParams(url.hash.slice(1)).has("invite")) url.hash="";
      window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`);
      return;
    }
    if (!activeGameCode || !activeInviteToken) {
      // Keep the invitation intact while the initial session reconnects.
      if (sharedCode || sharedInviteToken) return;
      const url = new URL(window.location.href);
      if (url.searchParams.has("code") || url.searchParams.has("inv")) {
        url.searchParams.delete("code");
        url.searchParams.delete("inv");
        const clean = url.searchParams.toString();
        window.history.replaceState(
          {},
          "",
          clean ? `${url.pathname}?${clean}` : url.pathname,
        );
      }
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("code", activeGameCode);
    url.searchParams.set("inv", activeInviteToken);
    window.history.replaceState(
      {},
      "",
      `${url.pathname}?${url.searchParams.toString()}`,
    );
  }, [
    game?.privateInvitation,
    activeGameCode,
    activeInviteToken,
    browserLocation,
    sharedCode,
    sharedInviteToken,
  ]);

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
      setMessage("");
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (!game || isSyncing || isBusy) return;
    showTemporaryMessage("Sincronizando partida...");
    await refreshGame();
  }, [game, isSyncing, isBusy, refreshGame, showTemporaryMessage]);

  const handleUseDice3D = useCallback(async () => {
    if (!game || !canInteract || isBusy) return null;
    if (!game.yourDiceAvailable) {
      showTemporaryMessage("Ya usaste tu dado en esta partida");
      return null;
    }

    try {
      const dice = await sendDice();
      if (dice) {
        showTemporaryMessage(
          DICE_POWER_LABELS[dice.power] ?? `Poder: ${dice.power}`,
        );
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
    };
  }, []);

  useEffect(() => {
    if (error) {
      if (errorCode && recoverableJoinErrorCodes.has(errorCode)) {
        return;
      }
      showTemporaryMessage(error);
      clearError();
      if (!game && !sharedInviteToken.startsWith("cta2.")) {
        setSharedCode("");
        setSharedInviteToken("");
        setJoinCode("");
      }
    }
  }, [
    error,
    errorCode,
    game,
    recoverableJoinErrorCodes,
    sharedInviteToken,
    clearError,
    showTemporaryMessage,
  ]);

  useEffect(() => {
    if (!errorCode || !recoverableJoinErrorCodes.has(errorCode)) return;

    const candidateCode =
      joinCode.trim().toUpperCase() || sharedCode || activeGameCode;
    const params = new URLSearchParams();
    if (candidateCode) {
      params.set("code", candidateCode);
    }
    params.set("reason", errorCode);

    router.push(`/partida-no-encontrada?${params.toString()}`);
    clearError();
  }, [
    errorCode,
    recoverableJoinErrorCodes,
    joinCode,
    sharedCode,
    activeGameCode,
    router,
    clearError,
  ]);

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
    if (game?.status === "finished") {
      void fetchRankings();
    }
  }, [game?.status, fetchRankings]);

  useEffect(() => {
    if (!game && loggedIn) {
      void fetchRankings();
    }
  }, [game, loggedIn, fetchRankings]);

  useEffect(() => {
    if (!ready || (!sharedInviteToken.startsWith("cta2.") && !sharedCode) || game) return;
    const key=`${sharedInviteToken||sharedCode}:${invitationRetry}`;
    if(invitationBoot.current===key)return;
    invitationBoot.current=key;
    setInvitationEntryError("");
    void request<{actor:{playerId:string;playerName:string;isGuest:boolean;isAdmin?:boolean}}>("/api/invitations/session",{
      method:"POST",body:JSON.stringify(sharedInviteToken.startsWith("cta2.")?{inviteToken:sharedInviteToken}:{gameCode:sharedCode})
    }).then(({actor})=>{
      if(invitationBoot.current!==key)return;
      loginWithServer(actor.playerId,actor.playerName,Boolean(actor.isAdmin));
      setInvitationReady(sharedInviteToken);
    }).catch(problem=>{
      if(invitationBoot.current!==key)return;
      setInvitationEntryError(problem instanceof Error?problem.message:"No se pudo abrir la invitación.");
    });
  },[ready,sharedInviteToken,sharedCode,game,loginWithServer,invitationRetry]);

  useEffect(() => {
    if (!ready || !loggedIn || autoJoinAttemptedRef.current || game) {
      return;
    }

    if (sharedInviteToken.startsWith("cta2.") && invitationReady!==sharedInviteToken) return;
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
      inviteToken: hasInviteToken ? sharedInviteToken : undefined,
    }).then(()=>{setSharedCode("");setSharedInviteToken("");})
      .catch((problem) => {
        if(sharedInviteToken.startsWith("cta2.")) {
          setInvitationEntryError(problem instanceof Error?problem.message:"No se pudo entrar en la partida.");
          return;
        }
        setSharedCode("");
        setSharedInviteToken("");
        setJoinCode("");
      });
  }, [
    invitationReady,
    ready,
    loggedIn,
    sharedCode,
    sharedInviteToken,
    game,
    joinExistingGame,
    playerName,
    showTemporaryMessage,
  ]);

  const handleLogin = useCallback(() => {
    const normalized = aliasInput.trim();
    if (!normalized) {
      showTemporaryMessage("Ingresa tu nombre para continuar");
      return;
    }

    setPendingAlias(normalized);
    setShowPasswordModal(true);
  }, [aliasInput, showTemporaryMessage]);

  const handlePasswordSuccess = useCallback(
    (serverPlayerId: string, serverAlias: string, serverIsAdmin: boolean) => {
      loginWithServer(serverPlayerId, serverAlias, serverIsAdmin);
      setShowPasswordModal(false);
      setPendingAlias("");
      showTemporaryMessage(`Bienvenido, ${serverAlias}`);
    },
    [loginWithServer, showTemporaryMessage],
  );

  const handlePasswordCancel = useCallback(() => {
    setShowPasswordModal(false);
    setPendingAlias("");
  }, []);

  const handleAccountDeleted = useCallback(() => {
    setShowDeleteModal(false);
    logout();
    setAliasInput("");
    setJoinCode("");
    setSharedCode("");
    setSharedInviteToken("");
    clearGame();
    showTemporaryMessage("Cuenta eliminada correctamente");
  }, [logout, clearGame, showTemporaryMessage]);

  const handleLogout = useCallback(() => {
    logout();
    setAliasInput("");
    setJoinCode("");
    setSharedCode("");
    setSharedInviteToken("");
    clearGame();
    showTemporaryMessage("Sesión cerrada");
  }, [logout, clearGame, showTemporaryMessage]);

  const handleLeaveGame = useCallback(async () => {
    if (!game) return;

    try {
      await leaveCurrentGame();
      clearGame();
      setSharedCode("");
      setSharedInviteToken("");
      setJoinCode("");
      showTemporaryMessage(
        "Has salido de la partida. El enlace de invitación anterior quedó invalidado.",
      );
    } catch {
      // Se maneja en el hook
    }
  }, [game, leaveCurrentGame, clearGame, showTemporaryMessage]);

  const handleCreateGame = useCallback(async () => {
    if (!loggedIn) {
      showTemporaryMessage("Debes iniciar sesión primero");
      return;
    }

    try {
      await createNewGame({
        playerName,
        numRows: normalizedRowsInput,
        privateInvitation,
      });

      showTemporaryMessage(
        privateInvitation ? "Mesa privada lista. Comparte el enlace; al entrar tu rival, empezáis." : "Partida creada. Envía el código o el enlace a tu rival.",
      );
    } catch {
      // Se maneja en el hook
    }
  }, [
    loggedIn,
    createNewGame,
    playerName,
    normalizedRowsInput,
    privateInvitation,
    showTemporaryMessage,
  ]);

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
      showTemporaryMessage("Debes iniciar sesión primero");
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      showTemporaryMessage("Ingresa el código de la partida");
      return;
    }

    try {
      await joinExistingGame({
        playerName,
        gameCode: code,
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
        showTemporaryMessage("Ahora le toca a tu rival. Espera a que juegue.");
        return;
      }

      if (isBusy || moveInFlightRef.current) {
        if (isBusy) {
          showTemporaryMessage(
            "Espera un momento, se está aplicando la jugada…",
          );
        }
        return;
      }

      const baseStartIndex = ballIndex;
      const baseRemoveCount = 1;
      const validation = validateMove(
        game,
        rowIndex,
        baseStartIndex,
        baseRemoveCount,
      );
      if (!validation.valid) {
        showTemporaryMessage(validation.reason ?? "Jugada inválida");
        return;
      }

      setPendingMove((previous) => {
        if (!previous || previous.rowIndex !== rowIndex) {
          return { rowIndex, startIndex: ballIndex, endIndex: ballIndex };
        }

        const isInsideBlock =
          ballIndex >= previous.startIndex && ballIndex <= previous.endIndex;

        if (isInsideBlock) {
          // Click dentro del bloque: quitar del extremo si es el borde
          if (ballIndex === previous.startIndex) {
            const newStart = previous.startIndex + 1;
            if (newStart > previous.endIndex) return null;
            return {
              rowIndex,
              startIndex: newStart,
              endIndex: previous.endIndex,
            };
          }
          if (ballIndex === previous.endIndex) {
            const newEnd = previous.endIndex - 1;
            if (newEnd < previous.startIndex) return null;
            return {
              rowIndex,
              startIndex: previous.startIndex,
              endIndex: newEnd,
            };
          }
          // Click en el medio del bloque: no cambiar selección
          showTemporaryMessage(
            "Toca un extremo del bloque para quitar una canica, o otra fila para empezar de nuevo.",
          );
          return previous;
        }

        // Click fuera del bloque: extender selección (debe ser contiguo)
        const nextStart = Math.min(previous.startIndex, ballIndex);
        const nextEnd = Math.max(previous.endIndex, ballIndex);
        const nextCount = nextEnd - nextStart + 1;
        const nextValidation = validateMove(
          game,
          rowIndex,
          nextStart,
          nextCount,
        );
        if (!nextValidation.valid) {
          showTemporaryMessage(nextValidation.reason ?? "Jugada inválida");
          return previous;
        }

        return { rowIndex, startIndex: nextStart, endIndex: nextEnd };
      });
    },
    [game, canInteract, isBusy, showTemporaryMessage],
  );

  const handleRangeSelection = useCallback((selection: {rowIndex:number;startIndex:number;endIndex:number} | null) => {
    if (!selection) { setPendingMove(null); return; }
    if (!game || !canInteract || isBusy) return;
    const valid = validateMove(game, selection.rowIndex, selection.startIndex, selection.endIndex-selection.startIndex+1);
    if (valid.valid) setPendingMove(previous => previous?.rowIndex === selection.rowIndex && previous.startIndex === selection.startIndex && previous.endIndex === selection.endIndex ? previous : selection);
  }, [game, canInteract, isBusy]);

  const applyPendingMove = useCallback(async () => {
    if (!game || !pendingMove) return;

    if (!canInteract) {
      showTemporaryMessage("Ahora le toca a tu rival.");
      return;
    }

    if (isBusy || moveInFlightRef.current) {
      if (isBusy) {
        showTemporaryMessage("Espera un momento…");
      }
      return;
    }

    const { rowIndex, startIndex, endIndex } = pendingMove;
    const removeCount = endIndex - startIndex + 1;
    const validation = validateMove(game, rowIndex, startIndex, removeCount);
    if (!validation.valid) {
      showTemporaryMessage(validation.reason ?? "Jugada inválida");
      setPendingMove(null);
      return;
    }

    moveInFlightRef.current = true;
    try {
      await sendMove(rowIndex, startIndex, removeCount);
      setPendingMove(null);
    } catch {
      // Keep the selection on a failed send. The hook first checks whether it was accepted.
    } finally {
      moveInFlightRef.current = false;
    }
  }, [game, pendingMove, canInteract, isBusy, sendMove, showTemporaryMessage]);

  const clearPendingMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  const handleCopyCode = useCallback(async () => {
    if (!game?.gameCode) return;

    try {
      await navigator.clipboard.writeText(game.gameCode);
      showTemporaryMessage("Código copiado");
    } catch {
      showTemporaryMessage("No se pudo copiar el código");
    }
  }, [game?.gameCode, showTemporaryMessage]);

  const handleCopyUrl = useCallback(async () => {
    let inviteUrl = shareUrl;

    if (
      !inviteUrl &&
      activeGameCode &&
      activeInviteToken &&
      browserLocation?.isPrivateOrigin
    ) {
      const resolvedOrigin = await loadPublicShareOrigin();
      if (resolvedOrigin) {
        inviteUrl = buildInviteUrl(
          resolvedOrigin,
          browserLocation.pathname,
          activeGameCode,
          activeInviteToken,
        );
      }
    }

    if (!inviteUrl) {
      showTemporaryMessage(
        "Comparte el código de la mesa. El enlace público todavía no está disponible.",
      );
      return;
    }

    const text = `🟢 *¿Una partida de Canicas?*

Canicas de cristal, estrategia y ocho poderes. Retirar la última canica pierde.

🎮 Toca el enlace y entramos directamente:
${inviteUrl}

🔑 O entra con el código: *${activeGameCode}*
⏳ Invitación disponible durante 5 minutos. Gratis, desde el móvil.`;
    const whatsapp = new URL('https://wa.me/');
    whatsapp.searchParams.set('text', text);
    window.open(whatsapp.toString(), '_blank', 'noopener,noreferrer');

  }, [
    shareUrl,
    activeGameCode,
    activeInviteToken,
    browserLocation,
    loadPublicShareOrigin,
    showTemporaryMessage,
  ]);

  const handleNavigate = useCallback((target: NavigationItem["target"]) => {
    const section = document.getElementById(target);
    if (!section) return;

    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(()=>{
    if(!ready||game)return;
    const target=window.location.hash.slice(1);
    if(!['ranking','reglas','inicio'].includes(target))return;
    const frame=requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView({block:'start',behavior:'auto'}));
    return()=>cancelAnimationFrame(frame);
  },[ready,game,playerId]);

  if (!ready) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div className="glass-panel rounded-2xl px-8 py-6 text-sm uppercase tracking-[0.2em] text-brown/80 dark:text-dark-muted">
            Inicializando plataforma...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="canicas-shell relative min-h-screen overflow-x-hidden selection:bg-primary/25 selection:text-brown dark:selection:text-dark-text">
      <AmbientBackground />

      {sharedInviteToken.startsWith("cta2.") && !game ? (
        <main className="private-entry" aria-live="polite">
          <span className="private-entry-mark" aria-hidden="true">↗</span>
          <p>INVITACIÓN PRIVADA</p>
          <h1>{invitationEntryError?"No hemos podido entrar.":"Entrando a tu partida…"}</h1>
          <p>{invitationEntryError||"Conectamos a los dos. No necesitas registrarte ni introducir un código."}</p>
          {invitationEntryError&&<button type="button" onClick={()=>{clearError();autoJoinAttemptedRef.current=false;setInvitationReady("");setInvitationRetry(n=>n+1);}}>Reintentar</button>}
          <button type="button" onClick={()=>{invitationBoot.current="cancelled";clearGame();setSharedInviteToken("");setSharedCode("");window.history.replaceState({},"",window.location.pathname);}}>Volver al inicio</button>
        </main>
      ) : !loggedIn ? (
        <LandingExperience
          alias={aliasInput}
          onAliasChange={setAliasInput}
          onLogin={handleLogin}
          invited={Boolean(sharedCode)}
        />
      ) : game ? (
        <MatchArena
          key={game.gameId}
          game={game}
          selection={pendingMove}
          busy={isBusy}
          syncing={isSyncing}
          connection={connection}
          shareStatus={shareStatusText}
          inviteUrl={shareUrl}
          onSelect={handleBallClick}
          onRange={handleRangeSelection}
          onConfirm={applyPendingMove}
          onCancel={clearPendingMove}
          onDice={handleUseDice3D}
          onDiceTarget={async target=>{try{return await sendDice(undefined,target);}catch{showTemporaryMessage("No se pudo confirmar el objetivo. Sincroniza antes de repetir.");return null;}}}
          onAncientShot={async (shot) => {
            try { return await sendDice(shot); }
            catch { showTemporaryMessage("No se pudo confirmar la tirada. Sincroniza antes de repetirla."); return null; }
          }}
          onRefresh={handleManualRefresh}
          onCopyCode={handleCopyCode}
          onInvite={handleCopyUrl}
          onLeave={handleLeaveGame}
          onToast={showTemporaryMessage}
          onOpenGames={() => {clearGame();clearError();setPendingMove(null);setSharedCode("");setSharedInviteToken("");setJoinCode("");window.history.replaceState({},"","/");window.scrollTo(0,0);}}
          onExit={() => {
            clearGame();
            clearError();
            setPendingMove(null);
            setSharedCode("");
            setSharedInviteToken("");
            setJoinCode("");
          }}
        />
      ) : (
        <div className="relative z-10 flex min-h-screen w-full flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
            <Brand />
            <nav
              className="flex items-center gap-3"
              aria-label="Navegación del lobby"
            >
              <AppearanceButton />
              <InstallAppButton />
              {topNavItems.map((item) => (
                <button
                  key={item.target}
                  type="button"
                  onClick={() => handleNavigate(item.target)}
                  className="px-2 py-2 text-xs text-brown dark:text-dark-muted"
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                aria-label="Eliminar cuenta"
                title="Eliminar cuenta"
                className="ui-button-secondary !h-10 !min-w-10 !p-2"
              >
                <IconTrash className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="ui-button-secondary !h-10 !min-w-10 !p-2"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 pb-20 md:px-8">
            <section id="inicio" className="lobby-dashboard space-y-6">
              <section className="open-games" aria-label="Mis partidas">
                <div className="open-games-heading"><h2>Tus partidas</h2><span>{openGames.length} / 5 abiertas</span></div>
                <p>Cambia de mesa cuando quieras. Tu rival y tu partida siguen aquí.</p>
                <div className="open-games-list">{openGames.map(table=>{
                  const myTurn=table.status==='playing' && table.currentTurn===(table.player1Id===playerId?1:2);
                  const rival=table.player1Id===playerId?table.player2Name:table.player1Name;
                  return <button type="button" key={table.gameId} disabled={isBusy} onClick={()=>void openGame(table.gameId).catch(()=>undefined)}>
                    <Image unoptimized src="/glass/crystal.aaf794a68863.webp" alt="" width={44} height={44}/>
                    <span><strong>{rival?`Con ${rival}`:'Esperando rival'}</strong><small>{table.gameCode} · {myTurn?'Tu turno':table.status==='waiting'?'Comparte tu invitación':'Turno de tu rival'}</small></span><b aria-hidden="true">↗</b>
                  </button>;
                })}</div>
                {openGames.length===0&&<small>No tienes partidas abiertas. Crea una mesa o entra con un código.</small>}
                {openGames.length>=5&&<p role="status">Has llegado a cinco. Termina o abandona una mesa para abrir otra.</p>}
              </section>
              <div className="text-center">
                <span className="lobby-welcome-label">
                  TU PRÓXIMA REVANCHA EMPIEZA AQUÍ
                </span>
                <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-[#4a3f32] dark:text-dark-text sm:text-2xl">
                  Tu mesa de juego.
                </h2>
                <p className="mt-1 text-xs text-[#8c7d6b] dark:text-dark-muted">
                  Crea una mesa para un amigo o entra con su código.
                </p>
              </div>

              <div className="lobby-actions grid gap-4 sm:grid-cols-2">
                <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/15 p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 dark:border-primary/25 dark:from-primary/10 dark:to-primary/5 dark:hover:shadow-primary/5">
                  <div className="absolute -right-3 -top-3 text-5xl opacity-10">
                    🎯
                  </div>
                  <p className="relative text-xs font-black uppercase tracking-wider text-[#526a4d] dark:text-leaf-soft">
                    Crear partida
                  </p>
                  <p className="relative mt-1 text-[11px] text-[#8c7d6b] dark:text-dark-muted">
                    Comparte una mesa y empezad al instante
                  </p>
                  <label className="private-create-choice"><input type="checkbox" checked={privateInvitation} onChange={event=>setPrivateInvitation(event.target.checked)}/><span><strong>Enlace privado</strong><small>Solo tu invitado · caduca en 5 minutos</small></span></label>
                  <div className="relative mt-4 flex items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="rows-input"
                        className="text-[10px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted"
                      >
                        Filas · 1–100
                      </label>
                      <div className="inline-flex h-11 items-center rounded-xl border border-primary/30 bg-white/80 px-1.5 dark:border-primary/40 dark:bg-dark-surface">
                        <button
                          type="button"
                          disabled={normalizedRowsInput <= MIN_ROWS}
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
                          maxLength={3}
                          aria-describedby="rows-help"
                          value={rowsInput}
                          onChange={(event) =>
                            handleRowsInputChange(event.target.value)
                          }
                          onBlur={handleRowsInputBlur}
                          className="h-9 w-12 bg-transparent px-1 text-center text-sm font-black text-[#4a3f32] outline-none dark:text-dark-text"
                        />
                        <button
                          type="button"
                          disabled={normalizedRowsInput >= MAX_ROWS}
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
                      aria-label={privateInvitation?"Crear partida privada":"Crear partida"}
                      title="Crear partida"
                    >
                      <IconPlus className="h-4 w-4 shrink-0" />
                      <span className="text-xs">Crear</span>
                    </button>
                  </div>
                  <p id="rows-help" className="mt-3 text-xs text-[#526a4d] dark:text-dark-muted" aria-live="polite">
                    {normalizedRowsInput} {normalizedRowsInput === 1 ? 'fila' : 'filas'} · {marbleCount(normalizedRowsInput).toLocaleString('es-ES')} canicas.
                    {' '}Caduca tras 24 h sin jugadas. Puedes salir y continuar después.
                  </p>
                </div>

                <div className="group relative overflow-hidden rounded-2xl border border-leaf/20 bg-gradient-to-br from-leaf/5 to-leaf-soft/15 p-5 transition-all hover:border-leaf/40 hover:shadow-lg hover:shadow-leaf/10 dark:border-leaf-soft/25 dark:from-leaf/10 dark:to-leaf-soft/5 dark:hover:shadow-leaf/5">
                  <div className="absolute -right-3 -top-3 text-5xl opacity-10">
                    🎮
                  </div>
                  <p className="relative text-xs font-black uppercase tracking-wider text-leaf dark:text-leaf-soft">
                    Unirse
                  </p>
                  <p className="relative mt-1 text-[11px] text-[#8c7d6b] dark:text-dark-muted">
                    Introduce el código de tu rival
                  </p>
                  <div className="relative mt-4 flex items-end gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <label
                        htmlFor="join-code-input"
                        className="text-[10px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted"
                      >
                        Código
                      </label>
                      <input
                        id="join-code-input"
                        type="text"
                        value={joinCode}
                        onChange={(event) =>
                          setJoinCode(event.target.value.toUpperCase())
                        }
                        maxLength={6}
                        placeholder="ABC123"
                        className="h-11 w-full min-w-0 rounded-xl border border-leaf/30 bg-white/80 px-3 text-center text-sm font-bold uppercase tracking-[0.15em] text-[#4a3f32] placeholder:text-[#b5a898] outline-none transition-colors focus:border-leaf focus:ring-2 focus:ring-leaf/25 dark:border-leaf-soft/40 dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleJoinGame()}
                      disabled={isBusy || joinCode.trim().length !== 6}
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

              <RivalsPanel
                playerId={playerId}
                numRows={normalizedRowsInput}
                onJoin={async (gameCode) => { await joinExistingGame({ playerName, gameCode }); }}
              />

              <div className="space-y-5">
                <RankingPanel rankings={rankings} loading={rankingsLoading} error={rankingsError} onRefresh={fetchRankings} currentPlayerId={playerId}/>

                <article
                  id="reglas"
                  className="overflow-hidden rounded-2xl border border-leaf/10 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-dark-card/80 md:p-6"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📜</span>
                    <h3 className="text-sm font-black uppercase tracking-wider text-[#4a3f32] dark:text-dark-text">
                      Reglas
                    </h3>
                  </div>
                  <KeyInstructionsCard />
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">
                    Detalle
                  </p>
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
                      <h4 className="text-xs font-black uppercase tracking-wider text-primary">
                        Puntuación
                      </h4>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[#8c7d6b] dark:text-dark-muted">
                      {scoringDescription}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {scoringRulesRows.map((r) => (
                        <div
                          key={`sr-${r.label}`}
                          className="rounded-lg bg-white/60 px-3 py-2 text-center dark:bg-dark-surface/80"
                        >
                          <p
                            className={`text-lg font-black ${r.pts.startsWith("+") ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {r.pts}
                          </p>
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8c7d6b] dark:text-dark-muted">
                            {r.label}
                          </p>
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
          </main>
        </div>
      )}

      {message ? (
        <div
          role="status"
          className={game ? "match-toast" : "fixed inset-x-4 top-4 z-[100] rounded-2xl border border-primary/20 bg-white/95 px-4 py-3 text-sm font-bold text-[#4a3f32] shadow-xl shadow-primary/10 backdrop-blur-xl dark:border-primary/25 dark:bg-dark-card/95 dark:text-dark-text dark:shadow-primary/5 sm:inset-x-auto sm:right-6 sm:max-w-sm"}
        >
          {game ? (
            <span className="mr-2" aria-hidden="true">
              ↗
            </span>
          ) : (
            <span className="mr-2">🍍</span>
          )}
          {message}
        </div>
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

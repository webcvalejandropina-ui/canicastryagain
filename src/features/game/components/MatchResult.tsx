"use client";

import { useEffect, useRef } from "react";
import type { GameState } from "@/features/game/types";

type Props = {
  game: GameState;
  exitLabel?: string;
  onExit: () => void;
  onInspect: () => void;
  onToast: (message: string) => void;
};

export function MatchResult({
  game,
  exitLabel = "Volver al lobby",
  onExit,
  onInspect,
  onToast,
}: Props): React.ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const won = game.winner !== null && game.winner === game.yourPlayerNumber;
  const winner =
    game.winner === 1 ? game.player1 : game.winner === 2 ? game.player2 : null;
  const endedByLeaving = game.rows.some((row) => row.some(Boolean));
  const myMoves = game.moveHistory.filter(
    (move) => move.player === game.yourPlayerNumber,
  );

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previousFocus?.focus();
    };
  }, []);

  async function share(): Promise<void> {
    const text = `${winner?.name ?? "Mi rival"} ganó en Canicas Try Again tras ${game.moveHistory.length} jugadas. ¿Una revancha?`;
    const url = window.location.origin;
    try {
      if (typeof navigator.share === "function")
        await navigator.share({ title: "Canicas · Try again", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        onToast("Resultado copiado. Listo para compartir.");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        onToast("No se pudo compartir. Puedes copiar la dirección del juego.");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="match-result"
      aria-labelledby="match-result-title"
      onCancel={(event) => {
        event.preventDefault();
        onInspect();
      }}
    >
      <div className="result-decoration" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="match-eyebrow">
        {won
          ? "BIEN JUGADO. MUY BIEN PENSADO."
          : "UNA BUENA PARTIDA MERECE OTRA."}
      </p>
      <div
        className={`result-medallion ${won ? "is-win" : ""}`}
        aria-hidden="true"
      >
        {won ? "✳" : "↻"}
      </div>
      <h2 id="match-result-title">
        {won
          ? "La mesa es tuya."
          : winner
            ? "La próxima, tuya."
            : "Hasta la próxima."}
      </h2>
      <p className="result-description">
        {winner ? (
          <>
            <strong>{winner.name}</strong> gana la partida.
            <br />
            {endedByLeaving
              ? "El duelo terminó por abandono."
              : won
                ? "Tu rival retiró la última canica del tablero."
                : "Retiraste la última canica del tablero. La revancha te espera."}
          </>
        ) : (
          "La partida ha terminado. Siempre hay otra estrategia por probar."
        )}
      </p>
      <div className="result-stats">
        <div>
          <strong>{game.moveHistory.length}</strong>
          <span>Jugadas</span>
        </div>
        <div>
          <strong>{myMoves.length}</strong>
          <span>Tus jugadas</span>
        </div>
        <div>
          <strong>{game.numRows}</strong>
          <span>Filas iniciales</span>
        </div>
      </div>
      <button
        type="button"
        className="match-button is-primary"
        onClick={onExit}
      >
        {exitLabel} <span>↗</span>
      </button>
      <div className="result-secondary">
        <button type="button" onClick={onInspect}>
          Ver el tablero
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => void share()}>
          Compartir resultado ↗
        </button>
      </div>
      <p className="result-signoff">Buen pique. Mejor deportividad.</p>
    </dialog>
  );
}

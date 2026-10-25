"use client";
import { useId, useMemo, useState } from "react";
import type { GameState, Move } from "../types";
import { rowsAtMove } from "../lib/replay";
import { DICE_POWERS, PowerGlyph } from "./DiceDisplay";

export function moveDescription(move: Move): string {
  return move.dice
    ? DICE_POWERS[move.dice.power].name
    : `Fila ${move.rowIndex + 1}`;
}
export function moveAmount(move: Move): string {
  if(move.dice?.power==="remolino")return "↔";
  return `${move.dice?.power === "resurreccion" ? "+" : "−"}${move.dice?.affected.length ?? move.count}`;
}
export function MoveHistory({ game }: { game: GameState }): React.ReactElement {
  const glassId = useId();
  const [chosen, setChosen] = useState(Math.max(0, game.moveHistory.length - 1));
  const index = Math.max(0, Math.min(chosen, game.moveHistory.length - 1));
  const move = game.moveHistory[index];
  const rows = useMemo(
    () => rowsAtMove(game.numRows, game.moveHistory, index),
    [game.numRows, game.moveHistory, index],
  );
  const affected = new Set(
    move?.dice?.affected.map(({ row, col }) => `${row}:${col}`) ??
      (move
        ? Array.from(
            { length: move.count },
            (_, offset) => `${move.rowIndex}:${move.startIndex + offset}`,
          )
        : []),
  );
  const actor = (player: number) =>
    player === game.yourPlayerNumber
      ? "Tú"
      : ((player === 1 ? game.player1?.name : game.player2?.name) ?? "Rival");
  if (!move)
    return (
      <p className="sheet-subtle">La primera jugada empieza en el tablero.</p>
    );
  return (
    <div className="move-history">
      <section
        className="history-replay"
        aria-label={`Tablero después de la jugada ${index + 1}`}
        data-player={move.player}
      >
        <div className="replay-topline">
          <button
            type="button"
            aria-label="Jugada anterior"
            disabled={index <= 0}
            onClick={() => setChosen(index - 1)}
          >
            ←
          </button>
          <span>
            Jugada <strong>{String(index + 1).padStart(2, "0")}</strong> /{" "}
            {game.moveHistory.length}
          </span>
          <button
            type="button"
            aria-label="Jugada siguiente"
            disabled={index === game.moveHistory.length - 1}
            onClick={() => setChosen(index + 1)}
          >
            →
          </button>
        </div>
        <div className="replay-court">
          <svg
            viewBox={`0 0 ${game.numRows * 14 + 12} ${game.numRows * 14 + 12}`}
            role="img"
            aria-label={`${rows.flat().filter(Boolean).length} canicas vivas. Las marcas de color muestran esta jugada.`}
          >
            <defs>
              <radialGradient id={glassId} cx="30%" cy="22%" r="80%">
                <stop offset="0" stopColor="var(--orb-top)" />
                <stop offset=".22" stopColor="var(--orb-mid)" />
                <stop offset=".68" stopColor="var(--orb-low)" />
                <stop offset="1" stopColor="var(--orb-edge)" />
              </radialGradient>
            </defs>
            {rows.flatMap((row, r) =>
              row.map((alive, c) => {
                const x = 13 + ((game.numRows - row.length) / 2 + c) * 14,
                  y = 13 + r * 14;
                const changed = affected.has(`${r}:${c}`);
                return (
                  <g
                    key={`${r}:${c}`}
                    className={`${alive ? "replay-live" : "replay-dead"} ${changed ? "replay-changed" : ""}`}
                  >
                    {alive ? (
                      <>
                        <circle
                          cx={x}
                          cy={y}
                          r="4.6"
                          style={{ fill: `url(#${glassId})` }}
                        />
                        <circle
                          className="replay-glint"
                          cx={x - 1.2}
                          cy={y - 1.4}
                          r="1.2"
                        />
                      </>
                    ) : (
                      <path d={`M${x - 2} ${y - 2}l4 4m0-4-4 4`} />
                    )}
                    {changed ? (
                      <circle className="replay-ring" cx={x} cy={y} r="6" />
                    ) : null}
                  </g>
                );
              }),
            )}
          </svg>
        </div>
        <p className="replay-description" aria-live="polite">
          <i /> <strong>{actor(move.player)}</strong>
          <span>{moveDescription(move)}</span>
          <b>{moveAmount(move)}</b>
        </p>
        <p className="replay-caption">
          El color señala las canicas de esta jugada.
        </p>
      </section>
      <ol
        className="pocket-history unified-history"
        aria-label="Todas las jugadas"
      >
        {game.moveHistory
          .map((item, itemIndex) => ({ item, itemIndex }))
          .reverse()
          .map(({ item, itemIndex }) => (
            <li key={itemIndex} data-player={item.player}>
              <button
                type="button"
                className="history-step"
                aria-current={itemIndex === index ? "step" : undefined}
                aria-label={`Ver jugada ${itemIndex + 1}: ${actor(item.player)}, ${moveDescription(item)}, ${moveAmount(item)}`}
                onClick={() => setChosen(itemIndex)}
              >
                <span className="history-index">
                  {String(itemIndex + 1).padStart(2, "0")}
                </span>
                <span className="history-actor">
                  <i />
                  <strong>{actor(item.player)}</strong>
                  <small>{moveDescription(item)}</small>
                </span>
                {item.dice ? <PowerGlyph power={item.dice.power} /> : null}
                <b className="history-amount">{moveAmount(item)}</b>
              </button>
            </li>
          ))}
      </ol>
    </div>
  );
}

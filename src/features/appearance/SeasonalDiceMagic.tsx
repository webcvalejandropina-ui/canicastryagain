"use client";
import { useAppearance } from "./AppearanceProvider";
import { EFFECT_MOTIFS } from "./events/visuals";
import type { CSSProperties } from "react";
import type { Season } from "./appearance";
import { worldFor } from "./worlds";
import { WorldSymbol } from "./WorldSymbol";

/** Purely cosmetic: finite particles never call game actions or intercept input. */
export function SeasonalDiceMagic({ season, phase }: {
  season: Season;
  phase: "throw" | "result" | "idle";
}): React.ReactElement | null {
  const { effect } = useAppearance();
  const motifs = EFFECT_MOTIFS[effect].length ? EFFECT_MOTIFS[effect] : worldFor(season).magic;
  if (!motifs.length || phase === "idle") return null;
  return (
    <span className={`event-dice-magic magic-${season} magic-${phase}`} aria-hidden="true" key={`${season}:${phase}`}>
      <i className="event-dice-wave"/><i className="event-dice-wave wave-second"/>
      {Array.from({length: 10}, (_, index) => {
        const angle = (index / 10) * Math.PI * 2;
        return <span className={`event-dice-particle ${index % 4 === 0 ? "is-spirit" : ""}`} key={index} style={{
          "--flight-x": `${Math.round(Math.cos(angle) * (index % 2 ? 119 : 94))}px`,
          "--flight-y": `${Math.round(Math.sin(angle) * 75 - 26)}px`,
          "--flight-turn": `${index % 2 ? 24 : -28}deg`,
          "--flight-delay": `${index * 38}ms`,
        } as CSSProperties}>
          <WorldSymbol kind={motifs[index % motifs.length]}/>
        </span>;
      })}
    </span>
  );
}

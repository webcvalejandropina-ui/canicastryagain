"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAppearance } from "./AppearanceProvider";
import { SeasonalDetail } from "./SeasonalDetail";
import { ParallaxWorld } from "./ParallaxWorld";

/** Brief edge effects leave the pieces and their touch targets unobstructed. */
export function SeasonalScene({
  moveNumber,
}: {
  moveNumber: number;
}): React.ReactElement | null {
  const { season, celebration, preferences, effect } = useAppearance();
  const previous = useRef(moveNumber);
  const [pulse, setPulse] = useState<number | null>(null);
  useEffect(() => {
    if (moveNumber === previous.current) return;
    previous.current = moveNumber;
    setPulse(moveNumber);
    const timer = setTimeout(() => setPulse(null), 2200);
    return () => clearTimeout(timer);
  }, [moveNumber]);
  if (season === "none" && preferences.landscape === "plain") return null;
  return (
    <div
      className={`season-scene scene-${season} ${celebration ? "is-celebration" : ""}`}
      aria-hidden="true"
    >
      {preferences.landscape !== "plain" ? <ParallaxWorld season={season} /> : null}
      <span className="season-halo" />
      {celebration ? (
        <span className="season-day-mark">
          <SeasonalDetail variant={1} />
        </span>
      ) : null}
      {pulse !== null && (season !== "none" || effect !== "none") ? (
        <div className="season-move-effect" key={`${season}:${pulse}`}>
          {Array.from({ length: celebration ? 7 : 3 }, (_, index) => (
            <span
              className="season-wisp"
              key={index}
              style={
                {
                  "--wisp": index,
                  "--side": index % 2 ? 1 : -1,
                } as CSSProperties
              }
            >
              <SeasonalDetail variant={season === "halloween" ? 1 : 0} />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

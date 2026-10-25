"use client";
import { memo, useEffect, useRef, type CSSProperties } from "react";
import { useAppearance } from "./AppearanceProvider";
import type { Season } from "./appearance";
import type { SceneryId } from "./sceneries";
import { worldFor, worldSceneTokens } from "./worlds";
import { SeasonalBackdrop } from "./SeasonalBackdrop";

/** Two CSS-composited images. No pointer listeners, frame loop, sensors or server work. */
export const ParallaxWorld = memo(function ParallaxWorld({season, preview = false, backgroundId:previewBackground, scenery:previewScenery}: {
  season: Season; preview?: boolean; backgroundId?:string; scenery?:SceneryId;
}): React.ReactElement {
  const { theme, preferences, effect, backgroundId, scenery, weather } = useAppearance();
  const root = useRef<HTMLDivElement>(null);
  const motion = !preview && (preferences.landscape ?? "parallax") === "parallax";
  useEffect(() => {
    const element = root.current;
    if (!element || !motion) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => { element.dataset.motionPaused = String(document.hidden || reduced.matches); };
    visibility();
    const observer = new IntersectionObserver(([entry]) => {
      element.dataset.offscreen = String(!entry.isIntersecting);
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", visibility);
    };
  }, [motion]);
  return <div ref={root} className={`world-scene world-${worldFor(season).landscape}${preview ? " world-preview" : ""}`}
    data-effect={preview ? "none" : effect} data-motion={motion} style={worldSceneTokens(season, theme) as CSSProperties} aria-hidden="true">
    <SeasonalBackdrop season={season} theme={theme} depth="far" preview={preview} backgroundId={preview?previewBackground:backgroundId} scenery={preview?previewScenery:scenery}/>
    <SeasonalBackdrop season={season} theme={theme} depth="near" preview={preview}/>
    {!preview&&weather!=="none"&&<div className={`world-weather weather-${weather}`}/>}
    <div className="world-table-veil"/>
  </div>;
});

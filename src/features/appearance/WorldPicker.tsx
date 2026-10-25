"use client";
import { useAppearance } from "./AppearanceProvider";
import { WORLD_OPTIONS } from "./worlds";
import { ParallaxWorld } from "./ParallaxWorld";

export function WorldPicker({preview = false}: {preview?: boolean}): React.ReactElement {
  const { preferences, season, update } = useAppearance();
  return <div className="world-picker" role="group" aria-label="Elegir ambiente">
    {WORLD_OPTIONS.map(world => <button type="button" key={world.id} aria-label={`Ambiente ${world.label}`} aria-pressed={preferences.season === world.id} onClick={() => update({season:world.id,backgroundPolicy:"auto"}, !preview)}>
      <span className="world-choice-art"><ParallaxWorld season={world.id} preview/></span>
      <span className="world-choice-label"><strong>{world.label}</strong><small>{preferences.season === world.id ? "Elegido" : preferences.season === "auto" && season === world.id ? "Hoy" : "Ver"}</small></span>
    </button>)}
  </div>;
}

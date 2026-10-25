"use client";
import { EFFECT_MOTIFS } from "./events/visuals";
import { useAppearance } from "./AppearanceProvider";
import { worldFor } from "./worlds";
import { WorldSymbol } from "./WorldSymbol";

export function SeasonalDetail({variant = 0}: {variant?: number}): React.ReactElement | null {
  const { season, effect } = useAppearance();
  const motifs = EFFECT_MOTIFS[effect].length ? EFFECT_MOTIFS[effect] : worldFor(season).motifs;
  const halloween = season === "halloween" && !EFFECT_MOTIFS[effect].length;
  if ((!halloween && season !== "birthday" && variant % 3 === 2) || motifs[0] === "none") return null;
  const kind = halloween ? (["pumpkin", "bat", "pumpkin", "ghost"] as const)[variant % 4] : motifs[variant % 2];
  return <span className={`seasonal-detail detail-${season}`} data-motif={kind} aria-hidden="true"><WorldSymbol kind={kind} surface/></span>;
}

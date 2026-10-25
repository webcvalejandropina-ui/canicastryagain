import type { Season } from "./appearance";
import sceneryAssets from "./sceneryAssets.json";
import { SCENERIES, type SceneryId } from "./sceneries";
import { SCENE_ASSETS } from "./sceneAssets";

/** Pre-encoded WebP + SVG bypass image processing: only the chosen pair is requested. */
export function SeasonalBackdrop({ season, theme, depth, preview, backgroundId, scenery }: {
  season: Season;
  theme: "light" | "dark";
  depth: "far" | "near";
  preview: boolean;
  backgroundId?:string;
  scenery?:SceneryId;
}): React.ReactElement {
  const custom=depth==="far"&&backgroundId?`/api/backgrounds/${backgroundId}`:undefined;
  const base = SCENE_ASSETS[season][theme];
  const placeId=scenery??(season==="none"?"gibraltar":season==="summer"?"tarifa":undefined);
  const place=placeId?sceneryAssets[placeId]:undefined;
  const assets = place ? {...base,far:place.large,farSmall:place.small} : base;
  // Native static images do not need an image-proxy request.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`world-plane world-${depth}`} src={custom??assets[depth]}
    style={depth==="far"&&!custom&&placeId?{objectPosition:SCENERIES[placeId].position}:undefined}
    srcSet={depth === "far" && !custom ? `${assets.farSmall} 640w, ${assets.far} 1280w` : undefined}
    sizes={depth === "far" ? (preview ? "300px" : "(max-width: 600px) 100vw, (max-width: 1100px) 80vw, 900px") : undefined}
    alt="" width={1200} height={900} draggable={false} decoding="async"
    loading={preview ? "lazy" : "eager"} />;
}

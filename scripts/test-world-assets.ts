import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { SCENE_ASSETS } from "../src/features/appearance/sceneAssets";
import { WORLD_OPTIONS } from "../src/features/appearance/worlds";

let maxSmall = 0, maxLarge = 0;
const unique = new Set<string>();
for (const { id } of WORLD_OPTIONS) {
  for (const theme of ["light", "dark"] as const) {
    const assets = SCENE_ASSETS[id][theme];
    const data = Object.fromEntries(Object.entries(assets).map(([depth, url]) => {
      assert.match(url, /^\/worlds\/[\w.-]+\.(svg|webp)$/);
      const file = readFileSync(resolve("public", url.slice(1)));
      const hash = createHash("sha256").update(file).digest("hex").slice(0, 10);
      assert.ok(url.includes(`.${hash}.`), `Cache-safe content hash: ${url}`);
      unique.add(url);
      return [depth, file];
    }));
    for (const file of [data.far, data.farSmall]) {
      assert.equal(file.toString("ascii", 0, 4), "RIFF");
      assert.equal(file.toString("ascii", 8, 12), "WEBP");
    }
    assert.ok(data.near.length <= 4 * 1024, "Foreground stays under 4 KiB");
    assert.doesNotMatch(data.near.toString(), /<(filter|script|animate|image)\b/);
    const small = data.farSmall.length + data.near.length;
    const large = data.far.length + data.near.length;
    assert.ok(small <= 60 * 1024, "640px scene stays under 60 KiB");
    assert.ok(large <= 180 * 1024, "1280px scene stays under 180 KiB");
    maxSmall = Math.max(maxSmall, small); maxLarge = Math.max(maxLarge, large);
  }
  // Theme switches reuse the expensive photo, only the tiny foreground changes.
  assert.equal(SCENE_ASSETS[id].light.far, SCENE_ASSETS[id].dark.far);
}
assert.equal(unique.size, WORLD_OPTIONS.length * 4);
console.log(`OK: hashed WebP/SVG assets, no active SVG content; maximum scene ${maxSmall} B at 640px, ${maxLarge} B at 1280px`);

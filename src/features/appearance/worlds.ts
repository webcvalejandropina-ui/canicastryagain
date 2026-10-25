/** The visual catalogue is shared by the board, menu, demo, marbles and die.
 * New occasions can reuse an existing landscape/motif without editing those components. */
export type WorldMotif = "lantern" | "flower" | "petal" | "flame" | "spark" | "ribbon" | "none" | "pumpkin" | "bat" | "ghost" | "snow" | "hat" | "sun" | "glasses" | "bubble" | "star" | "gift" | "confetti";
export type Landscape = "meadow" | "haunted" | "winter" | "coast" | "party";
type ScenePalette = readonly [sky:string, horizon:string, hills:string, land:string, grass:string, soil:string, edge:string, rock:string, light:string];
type OrbMaterial = readonly [top:string, mid:string, body:string, low:string, edge:string, glint:string, shadow:string, aura:string, ink:string];
type DieMaterial = readonly [top:string, edge:string, body:string, deep:string, side:string, pip:string, glow:string, cutout:string];
type InterfacePalette = readonly [background:string, panel:string, surface:string, accent:string, accentInk:string];
type WorldDefinition = {
  label: string;
  description: string;
  caption: string;
  landscape: Landscape;
  motifs: readonly [WorldMotif, WorldMotif];
  dice: WorldMotif;
  magic: readonly WorldMotif[];
  // Sky, horizon, distant hills, land, grass, soil, cut edge, rock, light.
  light: ScenePalette;
  dark: ScenePalette;
  material?: { orb: OrbMaterial; lightOrb?: OrbMaterial; die: DieMaterial; ui: {dark: InterfacePalette; light: InterfacePalette} };
};
export const WORLDS = {
  none: {
    label: "Normal", description: "Tu escenario habitual, sin decoraciones de eventos. Elige La Línea y Gibraltar, Cádiz u otro paisaje.", caption: "Un pequeño gran duelo", landscape: "meadow",
    motifs: ["none", "none"], dice: "none", magic: [],
    light: ["#e5efe4", "#cadfce", "#a0c2af", "#789c80", "#a4c678", "#9c8467", "#c7ae80", "#786d60", "#fff0ba"],
    dark: ["#101e24", "#23383c", "#334f4c", "#3a5b48", "#809d59", "#443c32", "#7d7151", "#4c5148", "#d6e4ac"],
    material: {"orb":["#f1fffa","#88bfc1","#244c6670","#132b3e","#79c6bc","#e3e9c2","#031a26","#7ab9cc26","#10281f"],"lightOrb":["#fff","#c4ddd0","#7fa496","#305d59","#8dc0a6","#ecf5d8","#2c615b","#326f5520","#10281f"],"die":["#d1dabd","#adc5a0","#354d39","#102519","#080c0a","#e7ee55","#c8e350","#51301d"],"ui":{"dark":["#08090b","#101411","#151c17","#e7ee55","#182008"],"light":["#f4f5ef","#fbfcf6","#e5eadf","#bfcc35","#182008"]}},
  },
  halloween: {
    label: "Halloween", description: "Islas embrujadas, una mansión y niebla de medianoche.", caption: "Truco o trato", landscape: "haunted",
    motifs: ["pumpkin", "bat"], dice: "pumpkin", magic: ["ghost", "bat", "bat"],
    light: ["#f2e8d9", "#dbcbb5", "#b7a78d", "#8b8069", "#bba060", "#83654d", "#bd8c51", "#6e6055", "#e2b565"],
    dark: ["#161b25", "#34333d", "#4a4550", "#58514b", "#928058", "#3e302b", "#9d6f40", "#5f5046", "#ebbc72"],
    material: {"orb":["#fff4d1","#e8a763","#b76a2c","#5c301d","#ec9c48","#ffdc8a","#57321e","#de8b3328","#48271b"],"die":["#f6d297","#e4ae72","#995126","#3b211c","#21191b","#ffd38c","#ee9954","#51301d"],"ui":{"dark":["#100d0c","#19130f","#241c16","#f0bc77","#321e10"],"light":["#f6f0e4","#fffbf2","#ece2cf","#b4532d","#fff8e8"]}},
  },
  christmas: {
    label: "Navidad", description: "Un valle nevado, luces cálidas y pequeños abetos.", caption: "Navidad en juego", landscape: "winter",
    motifs: ["snow", "hat"], dice: "snow", magic: ["snow", "star", "snow"],
    light: ["#e2eeec", "#c3dad8", "#9cbabb", "#6f9690", "#eef4e9", "#82908a", "#baccc4", "#788e87", "#fff0b5"],
    dark: ["#101f2b", "#213f4a", "#355960", "#3c6564", "#b6d5ce", "#283c40", "#759a99", "#4b6769", "#f8d58a"],
    material: {"orb":["#fffdf0","#d3ece2","#488b80","#173e44","#91d0b7","#f7edd0","#153b41","#a4e4d326","#fff8dd"],"die":["#edf9f4","#c2e2de","#407b77","#143b41","#0e252e","#fff4db","#b0e7dc","#51301d"],"ui":{"dark":["#0b1211","#101d19","#1a2c25","#b7e2cd","#153d30"],"light":["#eef4ef","#f9fcf7","#dce9df","#397c67","#fff"]}},
  },
  summer: {
    label: "Verano", description: "Costa de arena, islotes y un atardecer junto al mar.", caption: "Modo verano", landscape: "coast",
    motifs: ["glasses", "sun"], dice: "sun", magic: ["star", "bubble", "bubble"],
    light: ["#e8eee2", "#c8dcca", "#96b9b4", "#7eaaa2", "#daca94", "#b49c71", "#e5cb93", "#9a977c", "#ecc26f"],
    dark: ["#102731", "#25484e", "#3e6867", "#4e7c6b", "#b8b67e", "#665942", "#ae9560", "#6d7567", "#f0ca78"],
    material: {"orb":["#fffad5","#f0d486","#be983d","#58662c","#f7d775","#fff3ae","#75672c","#f6d97328","#233b31"],"die":["#fff0ae","#e4d6a0","#388e8d","#125258","#143e45","#ffe48a","#efd27f","#51301d"],"ui":{"dark":["#0b1318","#112027","#19313a","#f2cf70","#293a20"],"light":["#f6f3e7","#fffdf5","#ece7ce","#efc65d","#293a20"]}},
  },
  birthday: {
    label: "Cumpleaños", description: "Tu propia isla de fiesta, globos, regalos y confeti.", caption: "Hoy la partida es tuya", landscape: "party",
    motifs: ["star", "gift"], dice: "star", magic: ["confetti", "star", "gift"],
    light: ["#f0e9e0", "#e1d5ca", "#beaab2", "#9c8c9e", "#d6bd85", "#9b7c70", "#d5ab83", "#8f7a80", "#f2ce84"],
    dark: ["#201d30", "#393246", "#54435b", "#6e5169", "#bfa481", "#483640", "#aa7c74", "#66505d", "#f1c87f"],
    material: { orb: ["#fff3d4", "#edc9a0", "#b67d80", "#593d5b", "#edbd9b", "#fff0bd", "#513851", "#d5ac8530", "#5c3e54"],
      die: ["#ffe8ba", "#daba96", "#a57284", "#533447", "#2e2234", "#ffe7ae", "#e0b680", "#55374a"],
      ui: {dark:["#15121b","#251e2a","#322536","#e5ba80","#30201f"],light:["#f5efe6","#fffbf3","#e9dfd4","#996b41","#fff9ec"]} },
  },
} as const satisfies Record<string, WorldDefinition>;

export type WorldId = keyof typeof WORLDS;
export const WORLD_OPTIONS = Object.entries(WORLDS).map(([id, world]) => ({id: id as WorldId, ...world}));
export function worldFor(id: WorldId): WorldDefinition { return WORLDS[id]; }
export function worldSceneTokens(id: WorldId, theme: "light" | "dark"): Record<string, string> {
  const values = WORLDS[id][theme];
  return Object.fromEntries(["sky", "horizon", "far", "land", "grass", "soil", "edge", "rock", "light"].map((name, i) => [`--world-${name}`, values[i]]));
}

const ORB_NAMES = ["top", "mid", "body", "low", "edge", "glint", "shadow", "aura", "ink"];
const DIE_NAMES = ["top", "edge", "body", "deep", "side", "pip", "glow", "cutout"];
export const WORLD_MATERIAL_KEYS = [...ORB_NAMES.map(n => `--orb-${n}`), ...DIE_NAMES.map(n => `--die-${n}`), "--app-bg", "--app-panel", "--app-surface", "--app-accent", "--app-accent-ink"];
export function worldMaterialTokens(id: WorldId, theme: "light" | "dark"): Record<string,string> {
  const material = worldFor(id).material;
  if (!material) return {};
  return {
    ...Object.fromEntries(ORB_NAMES.map((name,i) => [`--orb-${name}`, (theme === "light" ? material.lightOrb ?? material.orb : material.orb)[i]])),
    ...Object.fromEntries(DIE_NAMES.map((name,i) => [`--die-${name}`, material.die[i]])),
    ...Object.fromEntries(["bg","panel","surface","accent","accent-ink"].map((name,i) => [`--app-${name}`, material.ui[theme][i]])),
  };
}

import { SCENERY_IDS, type SceneryId } from "./sceneries";
import { WORLDS, worldMaterialTokens, type WorldId } from "./worlds";
export type ColorPreference = "system" | "light" | "dark";
export type Season = WorldId;
export type Birthday = { month: number; day: number };
export type LandscapePreference = "parallax" | "still" | "plain";
export type SeasonPreference = "auto" | Season;
export type AppearancePreferences = {
  color: ColorPreference;
  season: SeasonPreference;
  birthday?: Birthday;
  landscape?: LandscapePreference;
  area?: string;
  scenery?: SceneryId;
  backgroundPolicy?: "auto"|"calendar"|"original";
  weather?: "auto"|"none"|"rain"|"snow"|"fireflies";
};
export const APPEARANCE_KEY = "canicas-appearance-v1";
export const DEFAULT_APPEARANCE: AppearancePreferences = {
  color: "system",
  season: "auto",
};
export const SEASON_LABELS = Object.fromEntries(Object.entries(WORLDS).map(([id, world]) => [id, world.label])) as Record<Season, string>;

export type AnnualEvent = {
  id: Exclude<Season, "none">;
  label: string;
  start: number;
  end: number;
  dates: string;
  celebrationDays: readonly number[];
  priority?: number;
};

/** Recurring local calendar windows, inclusive. No year-specific schedules to renew. */
export const EVENT_CALENDAR: readonly AnnualEvent[] = [
  {
    id: "summer",
    label: WORLDS.summer.label,
    start: 615,
    end: 831,
    dates: "15 jun – 31 ago",
    celebrationDays: [621],
  },
  {
    id: "halloween",
    label: WORLDS.halloween.label,
    start: 1020,
    end: 1102,
    dates: "20 oct – 2 nov",
    celebrationDays: [1031],
  },
  {
    id: "christmas",
    label: WORLDS.christmas.label,
    start: 1201,
    end: 106,
    dates: "1 dic – 6 ene",
    celebrationDays: [1224, 1225, 1231, 101, 106],
  },
];

export function eventForSeason(season: Season): AnnualEvent | null {
  return EVENT_CALENDAR.find((event) => event.id === season) ?? null;
}

export function seasonOnDate(
  month: number,
  day: number,
  calendar: readonly AnnualEvent[] = EVENT_CALENDAR,
): Season {
  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return "none";
  const date = month * 100 + day;
  const matching = calendar.filter(event => event.start <= event.end
    ? date >= event.start && date <= event.end
    : date >= event.start || date <= event.end);
  return matching.reduce<AnnualEvent | null>((best,event) => !best || (event.priority ?? 0) > (best.priority ?? 0) ? event : best, null)?.id ?? "none";
}

/** Extra flourishes on the celebration itself, using the same annual calendar. */
export function isCelebrationDay(
  season: Season,
  month: number,
  day: number,
): boolean {
  return season === "birthday" || (eventForSeason(season)?.celebrationDays.includes(month * 100 + day) ?? false);
}

export function parseAppearance(raw: string | null, worldIds: readonly string[] = Object.keys(WORLDS), sceneryIds: readonly string[] = SCENERY_IDS): AppearancePreferences {
  try {
    const input = JSON.parse(raw ?? "{}");
    return {
      color: ["system", "light", "dark"].includes(input?.color)
        ? input.color
        : "system",
      season: ["auto", ...worldIds].includes(input?.season)
        ? input.season
        : "auto",
      ...(input?.birthday && Number.isInteger(input.birthday.month) && Number.isInteger(input.birthday.day)
        && input.birthday.month >= 1 && input.birthday.month <= 12 && input.birthday.day >= 1
        && input.birthday.day <= [31,29,31,30,31,30,31,31,30,31,30,31][input.birthday.month - 1]
        ? { birthday: {month: input.birthday.month, day: input.birthday.day} } : {}),
      ...(["auto","calendar","original"].includes(input?.backgroundPolicy)?{backgroundPolicy:input.backgroundPolicy}:{}),
      ...(["auto","none","rain","snow","fireflies"].includes(input?.weather)?{weather:input.weather}:{}),
      ...(sceneryIds.includes(input?.scenery) ? {scenery:input.scenery} : {}),
      ...(typeof input?.area === "string" ? {area:input.area.trim().slice(0,80)} : {}),
      ...(["parallax", "still", "plain"].includes(input?.landscape) ? { landscape: input.landscape } : {}),
    };
  } catch {
    return { color: "system", season: "auto" };
  }
}

/** Personal occasions take precedence over annual events only in automatic mode. */
export function resolveSeason(preferences: AppearancePreferences, month: number, day: number, calendar: readonly AnnualEvent[] = EVENT_CALENDAR, resolveAnnual = seasonOnDate): Season {
  if (preferences.backgroundPolicy === "original") return "none";
  if (preferences.season !== "auto") return preferences.season;
  // Account birthdays are resolved from the authenticated profile after hydration.
  return resolveAnnual(month, day, calendar);
}

const FIRST_PAINT_MATERIALS = Object.fromEntries(Object.keys(WORLDS).map(id => [id, {
  light: worldMaterialTokens(id as WorldId,"light"), dark: worldMaterialTokens(id as WorldId,"dark"),
}]));

// All dependencies are passed explicitly so minification and the pre-hydration script agree.
export const APPEARANCE_BOOTSTRAP = `(()=>{try{const parse=${parseAppearance.toString()};const seasonOnDate=${seasonOnDate.toString()};const resolve=${resolveSeason.toString()};const calendar=${JSON.stringify(EVENT_CALENDAR)};const ids=${JSON.stringify(Object.keys(WORLDS))};let raw=null;try{raw=localStorage.getItem('${APPEARANCE_KEY}')}catch{}const p=parse(raw,ids,${JSON.stringify(SCENERY_IDS)});const d=new Date();const root=document.documentElement;root.dataset.theme=p.color==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p.color;const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric'}).formatToParts(d);root.dataset.season=resolve(p,Number(parts.find(p=>p.type==='month').value),Number(parts.find(p=>p.type==='day').value),calendar,seasonOnDate);root.style.colorScheme=root.dataset.theme;const materials=${JSON.stringify(FIRST_PAINT_MATERIALS)};if(root.style.setProperty)Object.entries(materials[root.dataset.season][root.dataset.theme]).forEach(([key,value])=>root.style.setProperty(key,value));}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}})();`;

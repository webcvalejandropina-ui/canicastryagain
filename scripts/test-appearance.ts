import { WORLD_OPTIONS, worldSceneTokens, worldMaterialTokens } from "../src/features/appearance/worlds";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import {
  resolveSeason,
  APPEARANCE_BOOTSTRAP,
  APPEARANCE_KEY,
  parseAppearance,
  seasonOnDate,
} from "../src/features/appearance/appearance";

for (const [month, day, expected] of [
  [10, 19, "none"],
  [10, 20, "halloween"],
  [10, 31, "halloween"],
  [11, 2, "halloween"],
  [11, 3, "none"],
  [11, 30, "none"],
  [12, 1, "christmas"],
  [12, 31, "christmas"],
  [1, 1, "christmas"],
  [1, 6, "christmas"],
  [1, 7, "none"],
  [6, 14, "none"],
  [6, 15, "summer"],
  [8, 31, "summer"],
  [9, 1, "none"],
] as const)
  assert.equal(seasonOnDate(month, day), expected, `${month}/${day}`);
assert.deepEqual(parseAppearance("bad json"), {
  color: "system",
  season: "auto",
});
assert.deepEqual(parseAppearance('{"color":"unknown","season":"unknown"}'), {
  color: "system",
  season: "auto",
});
assert.deepEqual(parseAppearance('{"color":"light","season":"christmas"}'), {
  color: "light",
  season: "christmas",
});
for (const dark of [true, false]) {
  for (const raw of [
    null,
    "bad json",
    '{"color":"light","season":"summer"}',
    '{"color":"dark","season":"none"}',
  ]) {
    const root = {
      dataset: {} as Record<string, string>,
      style: {} as Record<string, string>,
    };
    runInNewContext(APPEARANCE_BOOTSTRAP, {
      document: { documentElement: root },
      matchMedia: () => ({ matches: dark }),
      localStorage: {
        getItem: (key: string) => {
          assert.equal(key, APPEARANCE_KEY);
          return raw;
        },
      },
      Date: class extends Date {
        constructor() {
          super("2026-10-24T12:00:00");
        }
      },
    });
    const choice = parseAppearance(raw);
    assert.equal(
      root.dataset.theme,
      choice.color === "system" ? (dark ? "dark" : "light") : choice.color,
    );
    assert.equal(
      root.dataset.season,
      choice.season === "auto" ? "halloween" : choice.season,
    );
    assert.equal(root.style.colorScheme, root.dataset.theme);
  }
}
const inaccessible = { dataset: {}, style: {} };
runInNewContext(APPEARANCE_BOOTSTRAP, {
  document: { documentElement: inaccessible },
  matchMedia: () => ({ matches: false }),
  localStorage: {
    getItem: () => {
      throw Error("Storage unavailable");
    },
  },
});
assert.equal((inaccessible.dataset as Record<string, string>).theme, "light");
console.log(
  "OK: light/dark bootstrap, saved preferences, invalid/unavailable storage and seasonal date boundaries",
);

// Repeat through leap years and year boundaries; a disabled event mode never expires.
for (const year of [2024, 2025, 2026, 2027, 2030, 2032]) {
  for (let month = 1; month <= 12; month++) {
    const days = new Date(year, month, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const md = month * 100 + day;
      const expected =
        md >= 615 && md <= 831
          ? "summer"
          : md >= 1020 && md <= 1102
            ? "halloween"
            : md >= 1201 || md <= 106
              ? "christmas"
              : "none";
      assert.equal(
        seasonOnDate(month, day),
        expected,
        `${year}-${month}-${day}`,
      );
    }
  }
}
for (const date of [
  "2026-10-31",
  "2027-01-06",
  "2027-01-07",
  "2027-06-15",
  "2032-12-31",
]) {
  for (const preference of ["auto", "none", "summer"] as const) {
    const root = {
      dataset: {} as Record<string, string>,
      style: {} as Record<string, string>,
    };
    const raw = JSON.stringify({ color: "light", season: preference });
    const local = new Date(`${date}T12:00:00`);
    runInNewContext(APPEARANCE_BOOTSTRAP, {
      document: { documentElement: root },
      matchMedia: () => ({ matches: true }),
      localStorage: { getItem: () => raw },
      Date: class extends Date {
        constructor() {
          super(`${date}T12:00:00`);
        }
      },
    });
    assert.equal(root.dataset.theme, "light");
    assert.equal(
      root.dataset.season,
      preference === "auto"
        ? seasonOnDate(local.getMonth() + 1, local.getDate())
        : preference,
    );
  }
}
assert.equal(seasonOnDate(13, 1), "none");
assert.equal(seasonOnDate(0, 1), "none");
console.log(
  "OK: annual calendar repeats across six years; normal mode and manual choices survive event dates and year changes",
);

// Personal occasions are opt-in, yearless, and never override an explicit choice.

assert.equal(resolveSeason({color:"system",season:"auto",birthday:{month:10,day:31}},10,31), "halloween");
assert.equal(resolveSeason({color:"system",season:"none",birthday:{month:10,day:31}},10,31), "none");
assert.equal(resolveSeason({color:"light",season:"summer",birthday:{month:10,day:31}},10,31), "summer");
assert.equal(resolveSeason({color:"dark",season:"auto",birthday:{month:10,day:31}},10,30), "halloween");
assert.equal(resolveSeason({color:"dark",season:"auto",birthday:{month:2,day:29}},2,28), "none");
assert.equal(resolveSeason({color:"dark",season:"auto",birthday:{month:2,day:29}},2,29), "none");
assert.equal(parseAppearance('{"birthday":{"month":2,"day":30}}').birthday, undefined);
assert.equal(parseAppearance('{"birthday":{"month":13,"day":1}}').birthday, undefined);
assert.deepEqual(parseAppearance('{"birthday":{"month":2,"day":29},"landscape":"still"}').birthday, {month:2,day:29});
assert.equal(parseAppearance('{"landscape":"invalid"}').landscape, undefined);
for (const world of WORLD_OPTIONS) {
  assert.equal(parseAppearance(JSON.stringify({season:world.id})).season, world.id);
  for (const theme of ["light", "dark"] as const) {
    assert.equal(Object.keys(worldSceneTokens(world.id,theme)).length, 9);
    assert.ok(Object.values(worldSceneTokens(world.id,theme)).every(Boolean));
    assert.ok(Object.values(worldMaterialTokens(world.id,theme)).every(Boolean));
  }
}
for (const choice of ["auto", "none", "summer"] as const) {
  const root = {dataset:{} as Record<string,string>,style:{} as Record<string,string>};
  runInNewContext(APPEARANCE_BOOTSTRAP,{
    document:{documentElement:root},matchMedia:()=>({matches:true}),
    localStorage:{getItem:()=>JSON.stringify({color:"dark",season:choice,birthday:{month:10,day:31}})},
    Date:class extends Date { constructor(){super("2030-10-31T12:00:00");} },
  });
  assert.equal(root.dataset.season, choice === "auto" ? "halloween" : choice);
}
console.log("OK: legacy local birthdays cannot activate account celebrations; opt-out and catalogue tokens");
const overlapping = [
  {id:"summer" as const,label:"First",start:1020,end:1102,dates:"",celebrationDays:[],priority:0},
  {id:"christmas" as const,label:"Priority",start:1020,end:1102,dates:"",celebrationDays:[],priority:20},
];
assert.equal(seasonOnDate(10,31,overlapping), "christmas");
const firstPaintTokens: Record<string,string> = {};
const birthdayRoot = {dataset:{} as Record<string,string>,style:{colorScheme:"",setProperty:(key:string,value:string)=>{firstPaintTokens[key]=value;}}};
runInNewContext(APPEARANCE_BOOTSTRAP,{
  document:{documentElement:birthdayRoot},matchMedia:()=>({matches:false}),
  localStorage:{getItem:()=>JSON.stringify({color:"light",season:"auto",birthday:{month:10,day:31}})},
  Date:class extends Date { constructor(){super("2030-10-31T12:00:00");} },
});
assert.equal(firstPaintTokens["--app-bg"], worldMaterialTokens("halloween","light")["--app-bg"]);
assert.equal(firstPaintTokens["--orb-mid"], worldMaterialTokens("halloween","light")["--orb-mid"]);
console.log("OK: overlapping-event priority and authenticated-only birthdays before hydration");

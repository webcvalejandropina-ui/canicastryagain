"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  parseAppearance,
  isCelebrationDay,
  type AppearancePreferences,
  type Season,
} from "./appearance";

import type { Birthday } from "@/shared/birthday";
import { seasonalWeather, type ClubBackground, type Weather } from "./events/backgrounds";
import { resolveManagedScene, type ManagedEvent, type PersonalScene, type EventEffect } from "./events/calendar";
import { DEFAULT_EVENTS } from "./events/catalog";
import type { SceneryId } from "./sceneries";
import { WORLD_MATERIAL_KEYS, worldMaterialTokens } from "./worlds";

type AppearanceContextValue = {
  preferences: AppearancePreferences;
  theme: "light" | "dark";
  season: Season;
  celebration: boolean;
  occasion: string;
  backgroundId?: string;
  scenery?: SceneryId;
  weather: Exclude<Weather,"auto">;
  effect: EventEffect;
  registered: boolean;
  accountBirthday: Birthday|null;
  saveBirthday: (birthday:Birthday|null)=>Promise<void>;
  events: ManagedEvent[];
  update: (patch: Partial<AppearancePreferences>, persist?: boolean) => void;
};
const Context = createContext<AppearanceContextValue | null>(null);
export function AppearanceProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const [preferences, setPreferences] = useState(DEFAULT_APPEARANCE);
  const [resolved, setResolved] = useState<{
    theme: "light" | "dark";
    season: Season;
    celebration: boolean;
  }>({ theme: "dark", season: "none", celebration: false });
  const identityRevision=useRef(0);
  const latest = useRef(DEFAULT_APPEARANCE);
  const remote = useRef<{events:ManagedEvent[];scene:PersonalScene|null;ready:boolean;locality:string|null;club:ClubBackground|null;registered:boolean;birthday:Birthday|null}>({events:[...DEFAULT_EVENTS],scene:null,ready:false,locality:null,club:null,registered:false,birthday:null});
  const [registered,setRegistered]=useState(false);
  const [accountBirthday,setAccountBirthday]=useState<Birthday|null>(null);
  const [profileLocality,setProfileLocality] = useState<string|null>(null);
  const [events,setEvents] = useState<ManagedEvent[]>([]);
  const [occasion,setOccasion] = useState('');
  const [scenery,setScenery] = useState<SceneryId|undefined>();
  const [backgroundId,setBackgroundId] = useState<string|undefined>();
  const [weather,setWeather] = useState<Exclude<Weather,'auto'>>('none');
  const [effect,setEffect] = useState<EventEffect>('none');
  const apply = useCallback((choice: AppearancePreferences) => {
    const now = new Date();
    const parts=new Intl.DateTimeFormat("en",{timeZone:"Europe/Madrid",month:"numeric",day:"numeric"}).formatToParts(now);
    const month=Number(parts.find(p=>p.type==="month")!.value),day=Number(parts.find(p=>p.type==="day")!.value);
    const theme =
      choice.color === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : choice.color;
    const scene=resolveManagedScene({...choice,area:choice.area??remote.current.locality??''},remote.current.events,remote.current.scene,now,remote.current.club,{registered:remote.current.registered,birthday:remote.current.birthday});
    const automatic=choice.season==='auto';
    const season=scene.world;
    setOccasion(scene.title);
    setEffect(scene.effect);
    setBackgroundId(scene.backgroundId);
    setScenery(scene.scenery);
    const atmosphere=choice.weather && choice.weather!=='auto'?choice.weather:scene.weather&&scene.weather!=='auto'?scene.weather:scene.world==='christmas'?'snow':seasonalWeather(now);
    setWeather(atmosphere);
    const celebration=(automatic && !!scene.title) || isCelebrationDay(season,month,day);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.season = season;
    document.documentElement.style.colorScheme = theme;
    WORLD_MATERIAL_KEYS.forEach(key => document.documentElement.style.removeProperty(key));
    Object.entries(worldMaterialTokens(season, theme)).forEach(([key, value]) => document.documentElement.style.setProperty(key,value));
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.content =
          getComputedStyle(document.documentElement)
            .getPropertyValue("--app-bg")
            .trim() || (theme === "light" ? "#f4f5ef" : "#08090b");
        meta.removeAttribute("media");
      });
    setResolved((previous) =>
      previous.theme === theme &&
      previous.season === season &&
      previous.celebration === celebration
        ? previous
        : { theme, season, celebration },
    );
  }, []);
  const update = useCallback(
    (patch: Partial<AppearancePreferences>, persist = true) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setPreferences(next);
      try {
        if (persist) localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
      } catch {
        /* Preferences still work for this session. */
      }
      apply(next);
    },
    [apply],
  );
  const saveBirthday=useCallback(async(birthday:Birthday|null)=>{
    const revision=identityRevision.current;
    const response=await fetch('/api/appearance/me',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({birthday})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error??'No se pudo guardar tu cumpleaños');
    if(revision!==identityRevision.current||!remote.current.registered)throw new Error('La sesión cambió; vuelve a abrir tu perfil');
    remote.current.birthday=data.birthday;setAccountBirthday(data.birthday);apply(latest.current);
    window.dispatchEvent(new Event('canicas-events-updated'));
  },[apply]);
  useEffect(() => {
    const read = () => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(APPEARANCE_KEY);
      } catch {
        /* Storage can be unavailable in private mode. */
      }
      const choice = parseAppearance(raw);
      latest.current = choice;
      setPreferences(choice);
      apply(choice);
    };
    const refresh = () => apply(latest.current);
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null) read();
    };
    read();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", refresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      media.removeEventListener("change", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(timer);
    };
  }, [apply]);
  useEffect(() => {
    let disposed=false;
    let controller:AbortController|null=null;
    let checked=0;
    let generation=0;
    const load = async (force=false) => {
      if(document.hidden || (!force && Date.now()-checked<300_000)) return;
      checked=Date.now(); controller?.abort(); controller=new AbortController();
      const request=++generation;
      const activeController=controller;
      const timeout=window.setTimeout(()=>activeController.abort(),8_000);
      try {
        const [publicResponse,personalResponse]=await Promise.all([fetch('/api/appearance',{signal:controller.signal,cache:force?'no-cache':'default'}),fetch('/api/appearance/me',{signal:controller.signal,cache:'no-store'})]);
        if(!publicResponse.ok||!personalResponse.ok)return;
        const [{events:catalog,club},{scene,profile,registered:isRegistered}]=await Promise.all([publicResponse.json(),personalResponse.json()]);
        if(disposed||request!==generation)return;
        remote.current={events:catalog,scene,ready:true,locality:profile?.locality??null,club:club??null,registered:isRegistered===true,birthday:profile?.birthday??null};setRegistered(isRegistered===true);setAccountBirthday(profile?.birthday??null);setProfileLocality(profile?.locality??null);setEvents(catalog);apply(latest.current);
      } catch { /* Keep the last valid calendar while offline. */ }
      finally { clearTimeout(timeout); }
    };
    const refresh=()=>void load();
    const identity=()=>{identityRevision.current++;generation++;controller?.abort();remote.current.scene=null;remote.current.locality=null;remote.current.registered=false;remote.current.birthday=null;setRegistered(false);setAccountBirthday(null);setProfileLocality(null);apply(latest.current);void load(true);};
    const edited=()=>void load(true);
    const online=()=>{if(Date.now()-checked>1_000)void load(true);};
    const storage=(event:StorageEvent)=>{if(event.key==='canicas-try-again-player-session-v1'||event.key===null)identity();};
    const syncTimer=window.setInterval(refresh,300_000+Math.floor(Math.random()*30_000));
    void load();document.addEventListener('visibilitychange',refresh);
    window.addEventListener('online',online);window.addEventListener('canicas-identity',identity);window.addEventListener('canicas-events-updated',edited);window.addEventListener('storage',storage);
    return ()=>{disposed=true;clearInterval(syncTimer);controller?.abort();document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',online);window.removeEventListener('canicas-identity',identity);window.removeEventListener('canicas-events-updated',edited);window.removeEventListener('storage',storage);};
  },[apply]);
  const value = useMemo(
    () => ({ preferences:{...preferences,area:preferences.area??profileLocality??undefined}, ...resolved, occasion, effect, backgroundId, scenery, weather, events, registered, accountBirthday, saveBirthday, update }),
    [preferences, profileLocality, resolved, occasion, effect, backgroundId, scenery, weather, events, registered, accountBirthday, saveBirthday, update],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppearance(): AppearanceContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("AppearanceProvider is required");
  return value;
}

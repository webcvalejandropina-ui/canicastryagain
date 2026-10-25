"use client";

import React, { useRef, type PointerEvent } from "react";
import { classifyDiceGesture } from "../lib/diceGesture";
import type { DicePowerName } from "../types";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { SeasonalDetail } from "@/features/appearance/SeasonalDetail";
import { SeasonalDiceMagic } from "@/features/appearance/SeasonalDiceMagic";
import { DICE_FACETS, diceResultTransform } from "../lib/diceGeometry";

export const DICE_POWERS: Record<
  DicePowerName,
  { name: string; description: string }
> = {
  avalancha: {name:"Avalancha",description:"Elige una canica: cae por las dos ramas inferiores y se detiene en los huecos."},
  remolino: {name:"Remolino",description:"Mezcla vivas y huecos dentro de cada fila sin cambiar la cantidad."},
  fantasma: {name:"Fantasma",description:"Elige una canica: retira también la viva más cercana a cada lado de su fila, saltando huecos."},
  antigua: { name:"Tirada antigua", description:"Apunta y mantén pulsado para cargar. Los choques gastan fuerza." },
  bomba: {
    name: "Bomba",
    description: "Vacía una fila elegida al azar.",
  },
  rayo: {
    name: "Rayo",
    description: "Retira una canica al azar de cada fila activa.",
  },
  diagonal: {
    name: "Diagonal",
    description: "Retira una canica y las de sus diagonales.",
  },
  resurreccion: {
    name: "Resurrección",
    description: "Devuelve entre una y todas las eliminadas, al azar por toda la mesa.",
  },
};

export const DICE_COLORS: Record<DicePowerName,{dark:string;light:string}> = {
  bomba:{dark:"#ff847a",light:"#b52e2a"},
  rayo:{dark:"#ffda60",light:"#8b5900"},
  diagonal:{dark:"#bca2ff",light:"#7041b1"},
  resurreccion:{dark:"#76e7ac",light:"#11734b"},
  avalancha:{dark:"#90d9ff",light:"#126b96"},
  remolino:{dark:"#63e1de",light:"#087472"},
  fantasma:{dark:"#e1e8ff",light:"#515d80"},
  antigua:{dark:"#ffbb82",light:"#965018"},
};

export function PowerGlyph({
  power,
}: {
  power: DicePowerName;
}): React.ReactElement {
  return (
    <svg
      className="power-glyph"
      data-power={power}
      style={{"--power-dark":DICE_COLORS[power].dark,"--power-light":DICE_COLORS[power].light} as React.CSSProperties}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {power === "avalancha" ? <><circle cx="12" cy="4" r="2"/><circle cx="6" cy="13" r="2"/><circle cx="18" cy="13" r="2"/><path d="m11 6-4 5m6-5 4 5M6 15l-3 6m15-6 3 6M9 19h6"/></> : power === "remolino" ? <path d="M4 7h12l4 4m-4-8 4 4-4 4M20 17H8l-4-4m4 8-4-4 4-4"/> : power === "fantasma" ? <><path d="M5 21V9a7 7 0 0 1 14 0v12l-4-3-3 3-3-3Z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/></> : power === "bomba" ? (
        <>
          <circle cx="10" cy="14" r="7" />
          <path d="m15 8 2-2m-2-1 3 3m0-5 1-1m1 4h2M7 12l1-1" />
        </>
      ) : power === "antigua" ? (
        <><circle cx="6" cy="18" r="4"/><path d="M9 15 20 4m-7 0h7v7M4 9l2-2m9 13 2-2"/></>
      ) : power === "rayo" ? (
        <path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z" />
      ) : power === "diagonal" ? (
        <>
          <path d="m4 4 16 16M4 8V4h4m12 12v4h-4M4 20 20 4" />
          <circle cx="12" cy="12" r="2" />
        </>
      ) : (
        <>
          <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6m2 0v7m-3-3h6" />
        </>
      )}
    </svg>
  );
}

/** A rounded faceted crystal with eight flat power lands; CSS-only rendering. */
export function DiceCube({
  rolling = false,
  power,
  onRoll,
  disabled = false,
}: {
  rolling?: boolean;
  power?: DicePowerName;
  onRoll?: () => void;
  disabled?: boolean;
}): React.ReactElement {
  const { season } = useAppearance();
  const drag = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const suppressClick = useRef(false);
  const revealedPower = rolling ? undefined : power;
  function reset(element: HTMLElement): void {
    element.style.setProperty("--drag-x", "0deg");
    element.style.setProperty("--drag-y", "0deg");
    element.style.setProperty("--charge", "0");
    drag.current = null;
  }
  function move(event: PointerEvent<HTMLButtonElement>): void {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    event.currentTarget.style.setProperty(
      "--charge",
      String(Math.min(1, Math.abs(event.clientX - start.x) / 70)),
    );
    event.currentTarget.style.setProperty(
      "--drag-y",
      `${Math.max(-45, Math.min(45, (event.clientX - start.x) * 0.65))}deg`,
    );
    event.currentTarget.style.setProperty(
      "--drag-x",
      `${Math.max(-35, Math.min(35, (start.y - event.clientY) * 0.65))}deg`,
    );
  }
  const atmosphere = (
    <span className="dice-atmosphere" aria-hidden="true">
      <i className="dice-orbit orbit-one" />
      <i className="dice-orbit orbit-two" />
      <i className="dice-spark spark-one" />
      <i className="dice-spark spark-two" />
      <i className="dice-spark spark-three" />
      <i className="dice-floor" />
      {season !== "none"
        ? [0, 1, 2].map((index) => (
            <span className={`dice-event-mote mote-${index}`} key={index}>
              <SeasonalDetail variant={index === 1 ? 0 : 1} />
            </span>
          ))
        : null}
    </span>
  );
  const cube = (
    <div className="d8-bob">
      <div className="dice-faceted" style={{
        "--d8-result": diceResultTransform(revealedPower ?? "bomba"),
      } as React.CSSProperties}>
        {DICE_FACETS.map((face,index) => (
          <div key={face.power ?? `panel-${index}`} className={`d8-face ${face.power ? "d8-corner" : "d8-panel"} ${face.power && face.power === revealedPower ? "is-winning" : ""}`} data-face-power={face.power}
            style={{ "--power-color":face.power ? DICE_COLORS[face.power].dark : undefined,transform:face.transform,width:face.width,height:face.height,
              marginLeft:face.minX,marginTop:face.minY,clipPath:face.clip,
              transformOrigin:`${-face.minX}px ${-face.minY}px` } as React.CSSProperties}>
            <span className="d8-texture" style={{transform:face.textureTransform}}/>
            <svg className="d8-edges" viewBox={face.viewBox} aria-hidden="true">
              <path d={face.outline}/>
              <path d={face.outline} transform="scale(.87)"/>
            </svg>
            {face.power && <span className="d8-symbol" style={{left:-face.minX,top:-face.minY}}><PowerGlyph power={face.power}/></span>}
          </div>
        ))}
      </div>
    </div>
  );
  if (onRoll)
    return (
      <button
        type="button"
        className={`dice-scene dice-touch ${rolling ? "is-rolling" : ""}`}
        data-season={season}
        data-phase={rolling ? "throw" : "idle"}
        disabled={disabled}
        aria-label={
          rolling ? "Lanzando el dado" : "Lanzar dado tocando o deslizando"
        }
        onPointerDown={(event) => {
          if (
            disabled ||
            !event.isPrimary ||
            (event.pointerType === "mouse" && event.button !== 0)
          )
            return;
          suppressClick.current = false;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            pointer: event.pointerId,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          const start = drag.current;
          if (!start || start.pointer !== event.pointerId) return;
          const gesture = classifyDiceGesture(
            event.clientX - start.x,
            event.clientY - start.y,
          );
          reset(event.currentTarget);
          suppressClick.current = gesture !== "tap";
          if (gesture === "roll" && !disabled) onRoll();
        }}
        onPointerCancel={(event) => {
          if (drag.current?.pointer === event.pointerId) {
            suppressClick.current = true;
            reset(event.currentTarget);
          }
        }}
        onClick={(event) => {
          if (!disabled && (!suppressClick.current || event.detail === 0))
            onRoll();
          suppressClick.current = false;
        }}
      >
        {atmosphere}
        <SeasonalDiceMagic season={season} phase={rolling ? "throw" : "idle"} />
        <span className="dice-shadow" />
        {cube}
        <span className="dice-gesture" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19 19 5M6 5h13v13"/></svg>
        </span>
      </button>
    );
  return (
    <div
      className={`dice-scene ${rolling ? "is-rolling" : ""} ${revealedPower ? "has-power" : ""}`}
      data-phase={rolling ? "throw" : revealedPower ? "result" : "idle"}
      data-power={revealedPower}
      data-season={season}
      aria-hidden="true"
    >
      {atmosphere}
      <SeasonalDiceMagic season={season} phase={rolling ? "throw" : revealedPower ? "result" : "idle"} />
      <span className="dice-shadow" />
      {cube}
    </div>
  );
}

'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Image from 'next/image';

import { DiceResult, GameState } from '@/features/game/types';

type Props = {
  game: GameState;
  selectedRowIndex: number | null;
  selectedStartIndex: number | null;
  selectedEndIndex: number | null;
  canInteract: boolean;
  hasPendingMove?: boolean;
  hasTurnCoach?: boolean;
  boardAttentionPulse?: boolean;
  hasLiveChannel?: boolean;
  onBallClick: (rowIndex: number, ballIndex: number) => void;
  onBlockedRowClick?: (rowIndex: number) => void;
  onDiceRoll?: () => Promise<DiceResult | null>;
  diceAvailable?: boolean;
  lastDiceResult?: DiceResult | null;
};

type BoardDensity = 'normal' | 'compact' | 'dense';

type MarbleHandle = {
  mesh: any;
  rowIndex: number;
  ballIndex: number;
  active: boolean;
  clickable: boolean;
  selected: boolean;
  baseY: number;
  phase: number;
  bobAmplitude: number;
  bobSpeed: number;
  rotationSpeedX: number;
  rotationSpeedY: number;
  dying: boolean;
  dyingT: number;
  explosionSpawned: boolean;
  removedMaterial: any;
};

type Explosion = {
  points: any;
  geometry: any;
  material: any;
  velocities: Array<{ x: number; y: number; z: number }>;
  life: number;
};

type Flash = {
  sprite: any;
  material: any;
  life: number;
  maxLife: number;
  maxScale: number;
};

type SceneContext = {
  THREE: any;
  scene: any;
  camera: any;
  renderer: any;
  boardPivot: any;
  marbleGroup: any;
  effectsGroup: any;
  raycaster: any;
  pointer: any;
  activeTexture: any;
  removedTexture: any;
  marbles: MarbleHandle[];
  meshToMarble: Map<string, MarbleHandle>;
  pickableMeshes: any[];
  hoverMeshId: string | null;
  pointerX: number;
  pointerY: number;
  rafId: number | null;
  resizeObserver: ResizeObserver | null;
  cleanupHandlers: Array<() => void>;
  canvas: HTMLCanvasElement;
  diceMesh: any | null;
  diceGroup: any | null;
  diceTextures: any[];
  diceSpinning: boolean;
  diceSpinT: number;
  onDiceClickCb: (() => void) | null;
  explosions: Explosion[];
  flashes: Flash[];
  flashTexture: HTMLCanvasElement | null;
  removedP1Texture: any;
  removedP2Texture: any;
  cachedP1Initial: string;
  cachedP2Initial: string;
  lastFrameTime: number;
  boardWidth: number;
  baseCameraZ: number;
  contextLost: boolean;
  reducedMotion: boolean;
};

let threeModuleCache: typeof import('three') | null = null;

function loadThree(): Promise<typeof import('three')> {
  if (threeModuleCache) return Promise.resolve(threeModuleCache);
  return import('three').then((mod) => {
    threeModuleCache = mod;
    return mod;
  });
}

function getDensity(numRows: number): BoardDensity {
  if (numRows > 24) return 'dense';
  if (numRows > 14) return 'compact';
  return 'normal';
}

function marbleSizeClass(density: BoardDensity): string {
  // Mobile: minimum 36px touch target (WCAG 44px ideal, 36px practical for dense boards).
  // Desktop: keep compact to leave room for wide boards.
  if (density === 'dense') return 'h-9 w-9 md:h-5 md:w-5';
  if (density === 'compact') return 'h-9 w-9 md:h-6 md:w-6';
  return 'h-9 w-9 md:h-7 md:w-7';
}

function activeMarbleClass({
  isSelected,
  isBlocked,
  isDisabled,
  isRemoved = false,
  density
}: {
  isSelected: boolean;
  isBlocked: boolean;
  isDisabled: boolean;
  isRemoved?: boolean;
  density: BoardDensity;
}): string {
  const appearance = isRemoved
    ? 'border-slate-400/50 bg-slate-300/30 opacity-60'
    : isDisabled
      ? 'border-slate-400/60 bg-gradient-to-br from-slate-300/50 to-slate-500/60 opacity-85 saturate-75'
      : isSelected
        ? 'scale-105 border-primary/70 bg-gradient-to-br from-amber-100 to-primary ring-2 ring-primary/45'
        : isBlocked
          ? 'border-amber-300/50 bg-gradient-to-br from-amber-200 to-amber-400'
          : 'border-sky-300/50 bg-gradient-to-br from-sky-100 to-cyan-400';

  const animationClass = isRemoved
    ? ''
    : isDisabled
      ? 'marble-muted-float'
      : isSelected
        ? 'marble-selected-pulse'
        : 'marble-idle-float';

  const cursorClass =
    isRemoved || isDisabled ? 'cursor-default' : 'cursor-pointer hover:brightness-110 active:brightness-125';

  // Focus ring — explicit focus-visible for keyboard navigation (a11y)
  const focusClass = isRemoved || isDisabled
    ? ''
    : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent';

  return [
    marbleSizeClass(density),
    'rounded-full border transition-all duration-150',
    isRemoved ? '' : 'ball-shadow',
    'will-change-transform',
    animationClass,
    appearance,
    cursorClass,
    focusClass
  ]
    .filter(Boolean)
    .join(' ');
}

function getRowOwner(game: GameState, rowIndex: number): 1 | 2 | null {
  return game.moveHistory.find((move) => move.rowIndex === rowIndex)?.player ?? null;
}

function createMarbleTexture(
  THREE: any,
  colors: { base: string; veins: string; highlight: string; shadow: string }
): any {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const baseGradient = ctx.createRadialGradient(90, 80, 24, 130, 130, 165);
  baseGradient.addColorStop(0, colors.highlight);
  baseGradient.addColorStop(0.5, colors.base);
  baseGradient.addColorStop(1, colors.shadow);
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 6;
  ctx.strokeStyle = colors.veins;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 14; i += 1) {
    const startX = Math.random() * 256;
    const startY = Math.random() * 256;
    const endX = Math.random() * 256;
    const endY = Math.random() * 256;
    const controlX = (startX + endX) * 0.5 + (Math.random() * 80 - 40);
    const controlY = (startY + endY) * 0.5 + (Math.random() * 80 - 40);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 120; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = Math.random() * 2 + 0.6;
    ctx.beginPath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)';
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.needsUpdate = true;
  return texture;
}

function createRemovedMarbleTexture(
  THREE: any,
  xColor: string
): any {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Dark hollow background — brightened vs prior version so X mark stays visible
  // against the dark scene background on mobile dark mode
  const baseGradient = ctx.createRadialGradient(90, 80, 24, 130, 130, 165);
  baseGradient.addColorStop(0, '#334155');  // lighter slate — X will pop more
  baseGradient.addColorStop(0.55, '#1e293b');
  baseGradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, 256, 256);

  // Inner shadow ring — hollow look
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 128, 100, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 128, 110, 0, Math.PI * 2);
  ctx.stroke();

  // Big bold X mark — unmistakable "removed"
  ctx.lineWidth = 36;
  ctx.lineCap = 'round';
  ctx.strokeStyle = xColor;
  ctx.shadowColor = xColor;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.moveTo(48, 48);
  ctx.lineTo(208, 208);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(208, 48);
  ctx.lineTo(48, 208);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Center dot for extra "hollow" cue
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.arc(128, 128, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = 'bottom';

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function buildCellOwnerMap(
  moveHistory: Array<{ player: 1 | 2; rowIndex: number; startIndex: number; count: number }>
): Map<string, 1 | 2> {
  const map = new Map<string, 1 | 2>();
  for (const move of moveHistory) {
    for (let i = 0; i < move.count; i += 1) {
      map.set(`${move.rowIndex}:${move.startIndex + i}`, move.player);
    }
  }
  return map;
}

// Cache de geometrías de esfera por nivel de detalle — evita crear Geometry nuevo
// en cada buildBoardMeshes (que se dispara en cada turno/move del juego).
const sphereGeometryCache: Map<number, Map<number, any>> = new Map();

function getCachedSphereGeometry(THREE: any, radius: number, detail: number): any {
  if (!sphereGeometryCache.has(detail)) {
    sphereGeometryCache.set(detail, new Map());
  }
  const detailMap = sphereGeometryCache.get(detail)!;
  if (!detailMap.has(radius)) {
    detailMap.set(radius, new THREE.SphereGeometry(radius, detail, detail));
  }
  return detailMap.get(radius)!;
}

/* Three.js se carga vía dynamic import (npm) en loadThree() arriba. */

function disposeObject3D(root: any): void {
  if (!root) return;

  root.traverse((child: any) => {
    if (child.geometry?.dispose) {
      child.geometry.dispose();
    }

    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material: any) => material?.dispose?.());
      } else {
        child.material.dispose?.();
      }
    }
  });

  while (root.children.length > 0) {
    root.remove(root.children[0]);
  }
}

function updatePointerFromClient(context: SceneContext, clientX: number, clientY: number): void {
  const rect = context.canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  context.pointer.set(x, y);
  context.pointerX = x;
  context.pointerY = y;
}

function buildBoardMeshes(
  context: SceneContext,
  game: GameState,
  selectedRowIndex: number | null,
  selectedStartIndex: number | null,
  selectedEndIndex: number | null,
  canInteract: boolean,
  dyingCells?: Set<string>
): void {
  const { THREE, marbleGroup, camera } = context;
  disposeObject3D(marbleGroup);

  context.marbles = [];
  context.meshToMarble.clear();
  context.pickableMeshes = [];

  const cellOwnerMap = buildCellOwnerMap(game.moveHistory);
  const p1Initial = (game.player1?.name?.[0] ?? 'J').toUpperCase();
  const p2Initial = (game.player2?.name?.[0] ?? 'J').toUpperCase();

  // Detect dark mode for X-mark brightness — bright colors work in both modes vs dark ball background
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const p1XColor = isDarkMode ? '#ff8080' : '#ef4444'; // brighter red in dark mode
  const p2XColor = isDarkMode ? '#93c5fd' : '#3b82f6'; // blue already good in dark mode

  if (context.cachedP1Initial !== p1Initial || !context.removedP1Texture) {
    context.removedP1Texture?.dispose?.();
    context.removedP1Texture = createRemovedMarbleTexture(THREE, p1XColor);
    context.cachedP1Initial = p1Initial;
  }
  if (context.cachedP2Initial !== p2Initial || !context.removedP2Texture) {
    context.removedP2Texture?.dispose?.();
    context.removedP2Texture = createRemovedMarbleTexture(THREE, p2XColor);
    context.cachedP2Initial = p2Initial;
  }

  const density = getDensity(game.numRows);
  const radius = density === 'dense' ? 0.34 : density === 'compact' ? 0.39 : 0.45;
  const xSpacing = density === 'dense' ? 0.95 : density === 'compact' ? 1.06 : 1.22;
  const ySpacing = density === 'dense' ? 0.75 : density === 'compact' ? 0.86 : 0.96;
  const detail = density === 'dense' ? 14 : density === 'compact' ? 18 : 22;

  const boardHeight = (game.numRows - 1) * ySpacing;
  context.boardPivot.position.y = 0.55;

  const maxRowWidth = (game.numRows - 1) * xSpacing + radius * 2;
  context.boardWidth = maxRowWidth;
  const baseCamZ = Math.max(11, 8 + game.numRows * 0.75);
  context.baseCameraZ = baseCamZ;

  const aspect = camera.aspect || 1;
  const fovRad = (camera.fov * Math.PI) / 180;
  const halfTanFov = Math.tan(fovRad / 2);
  const neededZ = (maxRowWidth / 2 + 1.8) / (halfTanFov * aspect);
  camera.position.z = Math.max(baseCamZ, neededZ);
  camera.position.y = density === 'dense' ? 0.2 : 0.45;

  const sphereGeometry = getCachedSphereGeometry(THREE, radius, detail);

  game.rows.forEach((rowCells, rowIndex) => {
    const rowTotal = rowCells.length;
    const remainingCount = rowCells.filter((cell) => cell === 1).length;
    const isBlocked = game.lastTouchedRowIndex === rowIndex;
    const rowOwner = getRowOwner(game, rowIndex);
    const isOwnedByCurrent = rowOwner !== null && rowOwner === game.currentTurn;
    const isSelectedRow = selectedRowIndex === rowIndex;
    const isRowDisabled = !canInteract || game.status !== 'playing' || remainingCount === 0;

    const rowWidth = (rowTotal - 1) * xSpacing;
    const yCenter = (game.numRows - rowIndex - 1) * ySpacing - boardHeight / 2;

    for (let ballIndex = 0; ballIndex < rowTotal; ballIndex += 1) {
      const cellKey = `${rowIndex}:${ballIndex}`;
      const isDying = dyingCells?.has(cellKey) ?? false;
      const isActive = rowCells[ballIndex] === 1 || isDying;
      const isSelected =
        isSelectedRow &&
        selectedStartIndex !== null &&
        selectedEndIndex !== null &&
        ballIndex >= selectedStartIndex &&
        ballIndex <= selectedEndIndex &&
        isActive;
      const isClickable = isActive && !isRowDisabled;

      let color = 0x38bdf8;
      let emissive = 0x082f49;
      let metalness = 0.44;
      let roughness = 0.22;
      let opacity = 1;
      let transparent = false;

      if (!isActive) {
        const cellOwner = cellOwnerMap.get(cellKey);
        if (cellOwner === 1) {
          color = 0xdc2626;
          emissive = 0x7f1d1d;
        } else if (cellOwner === 2) {
          color = 0xea580c;
          emissive = 0x7c2d12;
        } else {
          color = 0x64748b;
          emissive = 0x1e293b;
        }
        metalness = 0.38;
        roughness = 0.32;
        opacity = 0.92;
        transparent = false;
      } else if (!isClickable) {
        color = 0x475569;
        emissive = 0x0f172a;
        metalness = 0.12;
        roughness = 0.72;
        opacity = 0.56;
        transparent = true;
      } else if (isSelected) {
        color = 0xf4c542;
        emissive = 0x8a6b1a;
        metalness = 0.55;
        roughness = 0.14;
      } else if (isBlocked) {
        color = 0xf59e0b;
        emissive = 0x78350f;
      } else if (isOwnedByCurrent) {
        color = 0x38bdf8;
        emissive = 0x082f49;
      }

      let textureMap: any;
      if (!isActive || isDying) {
        // Show X texture immediately — both dead marbles AND marbles currently dying
        // (dying balls animate in place; the X marks them as "about to be removed")
        const cellOwner = isDying ? cellOwnerMap.get(cellKey) : cellOwnerMap.get(cellKey);
        if (cellOwner === 1) {
          textureMap = context.removedP1Texture;
        } else if (cellOwner === 2) {
          textureMap = context.removedP2Texture;
        } else {
          textureMap = context.removedTexture;
        }
      } else if (isClickable) {
        textureMap = context.activeTexture;
      } else {
        textureMap = context.removedTexture;
      }

      const material = new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: isSelected ? 0.58 : isClickable ? 0.3 : (!isActive ? 0.2 : 0.08),
        metalness,
        roughness,
        transparent,
        opacity,
        map: textureMap
      });

      const marble = new THREE.Mesh(sphereGeometry, material);
      marble.position.set(ballIndex * xSpacing - rowWidth / 2, yCenter, isActive ? 0.24 : 0.06);
      marble.rotation.x = Math.random() * Math.PI * 2;
      marble.rotation.y = Math.random() * Math.PI * 2;
      marble.castShadow = false;
      marble.receiveShadow = false;

      marbleGroup.add(marble);

      const marbleHandle: MarbleHandle = {
        mesh: marble,
        rowIndex,
        ballIndex,
        active: isActive,
        clickable: isClickable,
        selected: isSelected,
        baseY: yCenter,
        phase: rowIndex * 0.31 + ballIndex * 0.17,
        bobAmplitude: isActive ? (isClickable ? 0.035 : 0.018) : 0,
        bobSpeed: isActive ? (isClickable ? 1.4 + Math.random() * 0.3 : 0.9 + Math.random() * 0.2) : 0,
        rotationSpeedX: isActive ? (isClickable ? 0.0015 + Math.random() * 0.002 : 0.0005 + Math.random() * 0.0008) : 0,
        rotationSpeedY: isActive ? (isClickable ? 0.002 + Math.random() * 0.003 : 0.0008 + Math.random() * 0.001) : 0,
        dying: isDying,
        dyingT: 0,
        explosionSpawned: false,
        removedMaterial: isDying ? (() => {
          const owner = cellOwnerMap.get(cellKey);
          const rColor = owner === 1 ? 0xdc2626 : owner === 2 ? 0xea580c : 0x64748b;
          const rEmissive = owner === 1 ? 0x7f1d1d : owner === 2 ? 0x7c2d12 : 0x1e293b;
          const rTex = owner === 1 ? context.removedP1Texture
            : owner === 2 ? context.removedP2Texture
            : context.removedTexture;
          return new THREE.MeshStandardMaterial({
            color: rColor, emissive: rEmissive, emissiveIntensity: 0.2,
            metalness: 0.38, roughness: 0.32, transparent: false, opacity: 0.92,
            map: rTex
          });
        })() : null
      };

      context.marbles.push(marbleHandle);
      context.meshToMarble.set(marble.uuid, marbleHandle);

      if (marbleHandle.clickable) {
        context.pickableMeshes.push(marble);
      }
    }
  });
}

function updateRendererSize(context: SceneContext, container: HTMLDivElement): void {
  const rect = container.getBoundingClientRect();
  const width = Math.max(280, Math.floor(rect.width));
  const height = Math.max(280, Math.floor(rect.height));

  context.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  context.renderer.setSize(width, height, false);
  context.camera.aspect = width / height;

  if (context.boardWidth > 0 && context.baseCameraZ > 0) {
    const aspect = context.camera.aspect;
    const fovRad = (context.camera.fov * Math.PI) / 180;
    const halfTanFov = Math.tan(fovRad / 2);
    const neededZ = (context.boardWidth / 2 + 1.8) / (halfTanFov * aspect);
    context.camera.position.z = Math.max(context.baseCameraZ, neededZ);
  }

  context.camera.updateProjectionMatrix();

  if (context.diceGroup) {
    const cam = context.camera;
    const fovRad = (cam.fov * Math.PI) / 180;
    const dist = cam.position.z - 1;
    const visibleH = 2 * Math.tan(fovRad / 2) * dist;
    const visibleW = visibleH * cam.aspect;
    const diceX = visibleW / 2 - 1.4;
    const diceY = visibleH / 2 - 1.4 + cam.position.y;
    context.diceGroup.position.x = diceX;
    context.diceGroup.position.y = diceY;
    context.diceGroup.userData.baseY = diceY;
  }
}

function pickMarble(context: SceneContext): MarbleHandle | null {
  if (context.pickableMeshes.length === 0) {
    return null;
  }

  context.raycaster.setFromCamera(context.pointer, context.camera);
  const intersections = context.raycaster.intersectObjects(context.pickableMeshes, false);
  if (intersections.length === 0) {
    return null;
  }

  const mesh = intersections[0]?.object;
  if (!mesh) return null;

  return context.meshToMarble.get(mesh.uuid) ?? null;
}

function createFlashCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  return canvas;
}

function spawnExplosion(
  THREE: any,
  parent: any,
  position: { x: number; y: number; z: number },
  color: number,
  particleCount: number
): Explosion {
  const positions = new Float32Array(particleCount * 3);
  const velocities: Array<{ x: number; y: number; z: number }> = [];

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3] = position.x;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z;

    const angle = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * Math.PI;
    const speed = 0.06 + Math.random() * 0.14;
    velocities.push({
      x: Math.cos(angle) * Math.cos(elevation) * speed,
      y: Math.sin(elevation) * speed + 0.04,
      z: Math.sin(angle) * Math.cos(elevation) * speed
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.35,
    color,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  parent.add(points);

  return { points, geometry, material, velocities, life: 0.8 };
}

function spawnFlash(
  THREE: any,
  parent: any,
  position: { x: number; y: number; z: number },
  color: number,
  flashCanvas: HTMLCanvasElement
): Flash {
  const texture = new THREE.CanvasTexture(flashCanvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.set(position.x, position.y, position.z + 0.3);
  sprite.scale.set(0.1, 0.1, 0.1);
  parent.add(sprite);

  const maxLife = 0.35;
  return { sprite, material, life: maxLife, maxLife, maxScale: 3.5 };
}

function animateFrame(context: SceneContext, timeMs: number): void {
  const { THREE } = context;

  // Skip rendering if WebGL context was lost (will be restarted on restore)
  if (context.contextLost) {
    context.rafId = window.requestAnimationFrame((nextTime) => animateFrame(context, nextTime));
    return;
  }

  const t = timeMs * 0.001;
  const rawDt = context.lastFrameTime > 0 ? (timeMs - context.lastFrameTime) * 0.001 : 1 / 60;
  const dt = Math.min(rawDt, 0.05);
  context.lastFrameTime = timeMs;

  const rm = context.reducedMotion;

  // Board tilt: disable when reduced-motion is preferred (keeps still for users with vestibular disorders)
  if (!rm) {
    const targetX = context.pointerY * 0.1;
    const targetY = context.pointerX * 0.12 + Math.sin(t * 0.3) * 0.03;
    const targetZ = Math.sin(t * 0.25) * 0.015;
    context.boardPivot.rotation.x += (targetX - context.boardPivot.rotation.x) * 0.04;
    context.boardPivot.rotation.y += (targetY - context.boardPivot.rotation.y) * 0.04;
    context.boardPivot.rotation.z += (targetZ - context.boardPivot.rotation.z) * 0.03;
  } else {
    context.boardPivot.rotation.x += (0 - context.boardPivot.rotation.x) * 0.04;
    context.boardPivot.rotation.y += (0 - context.boardPivot.rotation.y) * 0.04;
    context.boardPivot.rotation.z += (0 - context.boardPivot.rotation.z) * 0.03;
  }

  for (const marble of context.marbles) {
    if (marble.dying) {
      if (!marble.explosionSpawned) {
        marble.explosionSpawned = true;
        const pos = { x: marble.mesh.position.x, y: marble.mesh.position.y, z: marble.mesh.position.z };
        const marbleColor = marble.mesh.material?.color?.getHex?.() ?? 0x67e8f9;
        context.explosions.push(spawnExplosion(THREE, context.effectsGroup, pos, marbleColor, 30));
        if (context.flashTexture) {
          context.flashes.push(spawnFlash(THREE, context.effectsGroup, pos, 0x38bdf8, context.flashTexture));
        }
      }

      marble.dyingT += dt * 3.0;
      const progress = Math.min(marble.dyingT, 1);
      let s: number;
      if (progress < 0.1) {
        s = 1 + (progress / 0.1) * 0.25;
      } else {
        const shrinkT = (progress - 0.1) / 0.9;
        const eased = 1 - (1 - shrinkT) * (1 - shrinkT);
        s = Math.max(0, 1.25 * (1 - eased));
      }
      marble.mesh.scale.set(s, s, s);
      marble.mesh.rotation.x += dt * 12;
      marble.mesh.rotation.z += dt * 8;
      if (marble.mesh.material) {
        const fadeProgress = 1 - (1 - progress) * (1 - progress);
        marble.mesh.material.opacity = Math.max(0, 1 - fadeProgress * 1.5);
        marble.mesh.material.transparent = true;
      }
      if (progress >= 1) {
        if (marble.removedMaterial) {
          marble.mesh.material.dispose();
          marble.mesh.material = marble.removedMaterial;
          marble.mesh.scale.set(1, 1, 1);
          marble.mesh.position.z = 0.06;
          marble.mesh.material.opacity = 0.92;
          marble.mesh.material.transparent = false;
          marble.mesh.visible = true;
        } else {
          marble.mesh.visible = false;
        }
        marble.active = false;
        marble.dying = false;
      }
      continue;
    }

    if (marble.active) {
      // Bobbing is disabled when reduced-motion is preferred to prevent vestibular issues
      const verticalOscillation = rm ? 0 : Math.sin(t * marble.bobSpeed + marble.phase) * marble.bobAmplitude;
      marble.mesh.position.y = THREE.MathUtils.lerp(marble.mesh.position.y, marble.baseY + verticalOscillation, 0.08);
      const selMul = marble.selected ? 5.0 : 1;
      marble.mesh.rotation.x += marble.rotationSpeedX * selMul;
      marble.mesh.rotation.y += marble.rotationSpeedY * selMul;
    } else {
      marble.mesh.position.y = THREE.MathUtils.lerp(marble.mesh.position.y, marble.baseY, rm ? 1 : 0.15);
      marble.mesh.rotation.y += rm ? 0 : 0.012;
      marble.mesh.rotation.x += rm ? 0 : 0.004;
    }

    if (marble.selected) {
      // Squash/pulse animation disabled when reduced-motion is preferred (still shows selection via color)
      const pulse = rm ? 0 : Math.sin(t * 4 + marble.phase);
      const baseScale = rm ? 1.06 : 1.06 + pulse * 0.02;
      const squash = rm ? 0 : Math.sin(t * 2.5 + marble.phase) * 0.025;
      marble.mesh.scale.x = THREE.MathUtils.lerp(marble.mesh.scale.x, baseScale + squash, 0.1);
      marble.mesh.scale.y = THREE.MathUtils.lerp(marble.mesh.scale.y, baseScale - squash, 0.1);
      marble.mesh.scale.z = THREE.MathUtils.lerp(marble.mesh.scale.z, baseScale + squash * 0.5, 0.1);
      if (marble.mesh.material) {
        // Emissive glow stays on (no oscillation) when reduced-motion preferred
        marble.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(
          marble.mesh.material.emissiveIntensity,
          rm ? 0.6 : 0.5 + Math.sin(t * 3 + marble.phase) * 0.12,
          0.1
        );
      }
    } else {
      marble.mesh.scale.x = THREE.MathUtils.lerp(marble.mesh.scale.x, 1, 0.08);
      marble.mesh.scale.y = THREE.MathUtils.lerp(marble.mesh.scale.y, 1, 0.08);
      marble.mesh.scale.z = THREE.MathUtils.lerp(marble.mesh.scale.z, 1, 0.08);
    }
  }

  if (context.diceGroup) {
    if (context.diceSpinning) {
      // Dice roll spin is always shown (it's a transient action, not continuous ambient motion)
      context.diceSpinT += dt;
      context.diceGroup.rotation.x += 8 * dt;
      context.diceGroup.rotation.y += 12 * dt;
      context.diceGroup.rotation.z += 5 * dt;
      const bounce = rm ? 0 : Math.abs(Math.sin(context.diceSpinT * 6)) * 0.4;
      context.diceGroup.position.y = THREE.MathUtils.lerp(context.diceGroup.position.y, context.diceGroup.userData.baseY + bounce, 0.3);
    } else {
      // Idle hover bounce disabled when reduced-motion is preferred
      context.diceGroup.rotation.x += rm ? 0 : 0.005;
      context.diceGroup.rotation.y += rm ? 0 : 0.008;
      const hover = rm ? 0 : Math.sin(t * 1.5) * 0.12;
      context.diceGroup.position.y = THREE.MathUtils.lerp(context.diceGroup.position.y, context.diceGroup.userData.baseY + hover, 0.08);
    }
  }

  for (let e = context.explosions.length - 1; e >= 0; e--) {
    const exp = context.explosions[e];
    exp.life -= dt;

    const posArr = exp.geometry.attributes.position.array as Float32Array;
    const dtScale = dt * 60;
    for (let i = 0; i < exp.velocities.length; i++) {
      const i3 = i * 3;
      posArr[i3] += exp.velocities[i].x * dtScale;
      posArr[i3 + 1] += exp.velocities[i].y * dtScale;
      posArr[i3 + 2] += exp.velocities[i].z * dtScale;
      exp.velocities[i].y -= 0.0015 * dtScale;
    }
    exp.geometry.attributes.position.needsUpdate = true;
    exp.material.opacity = Math.max(exp.life / 0.8, 0);
    exp.material.size = 0.35 * Math.max(exp.life / 0.8, 0.15);

    if (exp.life <= 0) {
      context.effectsGroup.remove(exp.points);
      exp.geometry.dispose();
      exp.material.dispose();
      context.explosions.splice(e, 1);
    }
  }

  for (let f = context.flashes.length - 1; f >= 0; f--) {
    const fl = context.flashes[f];
    fl.life -= dt;

    const p = 1 - fl.life / fl.maxLife;
    const scaleVal = fl.maxScale * (p < 0.4 ? p / 0.4 : 1);
    fl.sprite.scale.set(scaleVal, scaleVal, scaleVal);
    fl.material.opacity = Math.max(1 - p * p, 0);

    if (fl.life <= 0) {
      context.effectsGroup.remove(fl.sprite);
      if (fl.material.map) fl.material.map.dispose();
      fl.material.dispose();
      context.flashes.splice(f, 1);
    }
  }

  context.renderer.render(context.scene, context.camera);
  context.rafId = window.requestAnimationFrame((nextTime) => animateFrame(context, nextTime));
}

/** Draw a filled circle on ctx at (cx,cy) with radius r and color. */
function drawCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw dice face symbols using pure canvas 2D API — no emoji / system fonts.
 * This guarantees consistent rendering on every device and browser.
 *
 * Face index → symbol:
 *   0 💣 bomb   → overlapping dark circles + spark lines
 *   1 ⚡ bolt   → lightning bolt polygon
 *   2 ✨ spark  → 4-point star + 8 rays
 *   3 🛡️ shield → shield outline with inner cross
 *   4 🎲 die    → classic 5-pip pattern
 *   5 ❓ rand   → large "?" with dot
 */
function drawDiceFace(ctx: CanvasRenderingContext2D, faceIndex: number, s: number): void {
  const cx = s / 2;
  const cy = s / 2;
  const sc = s / 256; // scale factor (base design is 256×256)

  switch (faceIndex) {
    case 0: { // bomb: dark circles + yellow spark lines + highlight
      ctx.fillStyle = '#1a1a2e';
      ([[cx, cy, 52], [cx - 18, cy - 18, 28], [cx + 20, cy - 12, 20]] as [number,number,number][]).forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(x, y, r * sc, 0, Math.PI * 2); ctx.fill();
      });
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 5 * sc; ctx.lineCap = 'round';
      ([[cx, cy - 68, cx, cy - 52], [cx - 60, cy - 10, cx - 47, cy - 18], [cx + 60, cy - 10, cx + 47, cy - 18]] as [number,number,number,number][]).forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(cx - 14, cy - 14, 14 * sc, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 1: { // lightning bolt
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx + 18 * sc, cy - 80 * sc); ctx.lineTo(cx - 18 * sc, cy + 4 * sc);
      ctx.lineTo(cx + 4 * sc, cy + 4 * sc);  ctx.lineTo(cx - 14 * sc, cy + 80 * sc);
      ctx.lineTo(cx + 22 * sc, cy - 4 * sc); ctx.lineTo(cx - 2 * sc, cy - 4 * sc);
      ctx.closePath(); ctx.fill();
      // depth shadow
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(cx + 22 * sc, cy - 80 * sc); ctx.lineTo(cx - 14 * sc, cy + 4 * sc);
      ctx.lineTo(cx + 8 * sc, cy + 4 * sc);  ctx.lineTo(cx - 10 * sc, cy + 80 * sc);
      ctx.lineTo(cx + 26 * sc, cy - 4 * sc); ctx.lineTo(cx + 2 * sc, cy - 4 * sc);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 2: { // spark star + 8 rays
      const outerR = 62 * sc, innerR = 28 * sc;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const px = cx + Math.cos(angle) * r, py = cy + Math.sin(angle) * r;
        if (i === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4 * sc; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * 72 * sc, cy + Math.sin(angle) * 72 * sc);
        ctx.lineTo(cx + Math.cos(angle) * 100 * sc, cy + Math.sin(angle) * 100 * sc);
        ctx.stroke();
      }
      drawCircle(ctx, cx, cy, 12 * sc, '#ffffff');
      break;
    }
    case 3: { // shield with inner cross
      const pad = 40 * sc;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10 * sc;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, pad); ctx.lineTo(cx - 55 * sc, cy - 30 * sc);
      ctx.lineTo(cx - 55 * sc, cy + 20 * sc);
      ctx.quadraticCurveTo(cx - 55 * sc, cy + 65 * sc, cx, cy + 80 * sc);
      ctx.quadraticCurveTo(cx + 55 * sc, cy + 65 * sc, cx + 55 * sc, cy + 20 * sc);
      ctx.lineTo(cx + 55 * sc, cy - 30 * sc); ctx.closePath(); ctx.stroke();
      ctx.lineWidth = 8 * sc;
      ctx.beginPath(); ctx.moveTo(cx, cy - 28 * sc); ctx.lineTo(cx, cy + 42 * sc);
      ctx.moveTo(cx - 30 * sc, cy + 8 * sc); ctx.lineTo(cx + 30 * sc, cy + 8 * sc);
      ctx.stroke();
      break;
    }
    case 4: { // classic die — 5 pips
      const pipR = 16 * sc;
      const pips: [number,number][] = [[cx, cy], [cx - 36*sc, cy - 36*sc], [cx + 36*sc, cy - 36*sc], [cx - 36*sc, cy + 36*sc], [cx + 36*sc, cy + 36*sc]];
      pips.forEach(([px, py]) => drawCircle(ctx, px, py, pipR, '#ffffff'));
      break;
    }
    case 5: { // large "?" + dot below (bezier paths, no font)
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14 * sc; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy - 24 * sc, 30 * sc, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + 6 * sc); ctx.lineTo(cx, cy + 22 * sc); ctx.stroke();
      drawCircle(ctx, cx, cy + 52 * sc, 12 * sc, '#ffffff');
      // shadow
      ctx.globalAlpha = 0.2; ctx.strokeStyle = '#000000';
      ctx.beginPath(); ctx.arc(cx + 4 * sc, cy - 20 * sc, 30 * sc, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
  }
}

// Cache dice face data URLs — compute once per face index, reuse forever
const diceFaceCache = new Map<number, string>();

/**
 * Returns a data-URL of a 48×48 canvas drawing the given dice face symbol.
 * Face indices match drawDiceFace: 0=bomb, 1=bolt, 2=spark, 3=shield, 4=die-pips, 5=question.
 * Used to render the dice button icon in the HUD without any external emoji/font.
 * Result is cached after first computation per face index.
 */
function getDiceFaceDataUrl(faceIndex: number): string {
  if (diceFaceCache.has(faceIndex)) {
    return diceFaceCache.get(faceIndex)!;
  }
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='; // 1×1 transparent GIF fallback

  // Background — same palette as the 3D dice cube faces
  const bgColors = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#ec4899'];
  ctx.fillStyle = bgColors[faceIndex % bgColors.length];
  ctx.fillRect(0, 0, size, size);

  // Rounded rect clip (die-like shape)
  const r = 8;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.clip();

  // Draw the face symbol using the same pure-canvas function
  drawDiceFace(ctx, faceIndex, size);

  ctx.restore();
  const dataUrl = canvas.toDataURL('image/png');
  diceFaceCache.set(faceIndex, dataUrl);
  return dataUrl;
}

function createDice3D(THREE: any, scene: any): { diceGroup: any; diceMesh: any; diceTextures: any[] } {
  const diceGroup = new THREE.Group();
  const size = 0.55;

  const faces: Array<{ bg: string }> = [
    { bg: '#f59e0b' }, // 0: bomb
    { bg: '#ef4444' }, // 1: bolt
    { bg: '#8b5cf6' }, // 2: spark
    { bg: '#10b981' }, // 3: shield
    { bg: '#f97316' }, // 4: die pips
    { bg: '#ec4899' }  // 5: question
  ];

  const textures = faces.map((f, faceIndex) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = f.bg;
    ctx.fillRect(0, 0, 256, 256);
    drawDiceFace(ctx, faceIndex, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  });

  const materials = textures.map(
    (tex) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        metalness: 0.3,
        roughness: 0.4,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.15
      })
  );

  const geometry = new THREE.BoxGeometry(size, size, size);
  const diceMesh = new THREE.Mesh(geometry, materials);
  diceMesh.castShadow = true;
  diceGroup.add(diceMesh);

  const edgesGeo = new THREE.EdgesGeometry(geometry);
  const edgesMat = new THREE.LineBasicMaterial({ color: 0xfde68a, linewidth: 2 });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  diceGroup.add(edges);

  const glowGeo = new THREE.SphereGeometry(size * 0.85, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.08
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  diceGroup.add(glow);

  scene.add(diceGroup);
  return { diceGroup, diceMesh, diceTextures: textures };
}

function initializeScene(container: HTMLDivElement, THREE: any): SceneContext | null {
  if (!THREE) return null;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 0x0d0c09 : 0xf5f0e8
  );

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 0.5, 16);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  const initialBgDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  renderer.setClearColor(initialBgDark ? 0x0d0c09 : 0xf5f0e8, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'h-full w-full';
  renderer.domElement.style.touchAction = 'none';
  // Inline background prevents white flash on mobile dark mode before Three.js renders
  renderer.domElement.style.backgroundColor = initialBgDark ? '#0d0c09' : '#f5f0e8';

  const ambient = new THREE.AmbientLight(0xffffff, 0.72);
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
  keyLight.position.set(6, 8, 10);
  const fillLight = new THREE.DirectionalLight(0xf2e9d0, 0.5);
  fillLight.position.set(-7, -4, 8);

  scene.add(ambient);
  scene.add(keyLight);
  scene.add(fillLight);

  const boardPivot = new THREE.Group();
  const marbleGroup = new THREE.Group();
  const effectsGroup = new THREE.Group();
  boardPivot.add(marbleGroup);
  boardPivot.add(effectsGroup);
  scene.add(boardPivot);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  const activeTexture = createMarbleTexture(THREE, {
    base: '#38bdf8',
    veins: '#bae6fd',
    highlight: '#e0f2fe',
    shadow: '#0c4a6e'
  });
  const _isDarkModeInit = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const _neutralXColorInit = _isDarkModeInit ? '#e2e8f0' : '#94a3b8';
  const removedTexture = createRemovedMarbleTexture(THREE, _neutralXColorInit); // grey X for neutral dead balls

  const context: SceneContext = {
    THREE,
    scene,
    camera,
    renderer,
    boardPivot,
    marbleGroup,
    effectsGroup,
    raycaster,
    pointer,
    activeTexture,
    removedTexture,
    marbles: [],
    meshToMarble: new Map(),
    pickableMeshes: [],
    hoverMeshId: null,
    pointerX: 0,
    pointerY: 0,
    rafId: null,
    resizeObserver: null,
    cleanupHandlers: [],
    canvas: renderer.domElement,
    diceMesh: null,
    diceGroup: null,
    diceTextures: [],
    diceSpinning: false,
    diceSpinT: 0,
    onDiceClickCb: null,
    explosions: [],
    flashes: [],
    flashTexture: createFlashCanvas(),
    removedP1Texture: null,
    removedP2Texture: null,
    cachedP1Initial: '',
    cachedP2Initial: '',
    lastFrameTime: 0,
    boardWidth: 0,
    baseCameraZ: 0,
    contextLost: false,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  };

  const updatePointerFromEvent = (event: PointerEvent): void => {
    updatePointerFromClient(context, event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    updatePointerFromEvent(event);

    if (context.diceMesh) {
      context.raycaster.setFromCamera(context.pointer, context.camera);
      const diceHits = context.raycaster.intersectObject(context.diceMesh, false);
      if (diceHits.length > 0) {
        renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }

    const hit = pickMarble(context);
    renderer.domElement.style.cursor = hit?.clickable ? 'pointer' : 'default';
  };

  const onPointerLeave = (): void => {
    context.pointerX = 0;
    context.pointerY = 0;
    context.pointer.set(0, 0);
    renderer.domElement.style.cursor = 'default';
  };

  container.appendChild(renderer.domElement);
  updateRendererSize(context, container);

  const onResize = (): void => {
    updateRendererSize(context, container);
  };

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);
  context.resizeObserver = resizeObserver;

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('resize', onResize);

  context.cleanupHandlers.push(() => renderer.domElement.removeEventListener('pointermove', onPointerMove));
  context.cleanupHandlers.push(() => renderer.domElement.removeEventListener('pointerleave', onPointerLeave));
  context.cleanupHandlers.push(() => window.removeEventListener('resize', onResize));

  // Listen for reduced-motion preference changes so the 3D scene updates live
  const reducedMotionMql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onReducedMotionChange = (): void => {
    context.reducedMotion = reducedMotionMql?.matches ?? false;
  };
  reducedMotionMql?.addEventListener?.('change', onReducedMotionChange);
  context.cleanupHandlers.push(() => {
    reducedMotionMql?.removeEventListener?.('change', onReducedMotionChange);
  });

  // Listen for color-scheme changes so the 3D scene background updates on mobile when the system theme switches
  const colorSchemeMql = window.matchMedia?.('(prefers-color-scheme: dark)');
  const onColorSchemeChange = (): void => {
    const isDark = colorSchemeMql?.matches ?? false;
    const bgColor = isDark ? 0x0d0c09 : 0xf5f0e8;
    const bgColorCss = isDark ? '#0d0c09' : '#f5f0e8';
    if (context.scene) {
      context.scene.background = new THREE.Color(bgColor);
    }
    renderer.setClearColor(bgColor, 1);
    renderer.domElement.style.backgroundColor = bgColorCss;
  };
  colorSchemeMql?.addEventListener?.('change', onColorSchemeChange);
  context.cleanupHandlers.push(() => {
    colorSchemeMql?.removeEventListener?.('change', onColorSchemeChange);
  });

  // Listen for manual theme toggle (canicas:theme-change) dispatched by HomePage
  // so the 3D canvas updates when the user manually switches light/dark mode
  const onManualThemeChange = (e: Event): void => {
    const isDark = (e as CustomEvent<{ isDark: boolean }>).detail?.isDark
      ?? colorSchemeMql?.matches ?? false;
    const bgColor = isDark ? 0x0d0c09 : 0xf5f0e8;
    const bgColorCss = isDark ? '#0d0c09' : '#f5f0e8';
    if (context.scene) {
      context.scene.background = new THREE.Color(bgColor);
    }
    renderer.setClearColor(bgColor, 1);
    // Keep canvas CSS background in sync so no white flash during repaints
    renderer.domElement.style.backgroundColor = bgColorCss;
  };
  window.addEventListener('canicas:theme-change', onManualThemeChange);
  context.cleanupHandlers.push(() => {
    window.removeEventListener('canicas:theme-change', onManualThemeChange);
  });

  // WebGL context loss / restore — critical for mobile stability
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    context.contextLost = true;
    if (context.rafId !== null) {
      window.cancelAnimationFrame(context.rafId);
      context.rafId = null;
    }
  };

  const onContextRestored = (): void => {
    context.contextLost = false;
    // Re-initialise the scene objects that were lost
    context.activeTexture?.dispose?.();
    context.removedTexture?.dispose?.();
    context.removedP1Texture?.dispose?.();
    context.removedP2Texture?.dispose?.();
    // Dice textures were invalidated by the lost context — clear references so they
    // are re-created (and their materials re-populated) the next time the dice appears.
    context.diceTextures.forEach((tex) => tex.dispose());
    context.diceTextures = [];
    const _isDarkModeRestore = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    context.removedTexture = createRemovedMarbleTexture(THREE, _isDarkModeRestore ? '#e2e8f0' : '#94a3b8'); // grey X for neutral dead balls
    context.activeTexture = createMarbleTexture(THREE, {
      base: '#38bdf8',
      veins: '#bae6fd',
      highlight: '#e0f2fe',
      shadow: '#0c4a6e'
    });
    // removedP1Texture / removedP2Texture are recreated lazily by updateBoard;
    // nullify them so the next updateBoard call detects they need re-creation.
    context.removedP1Texture = null;
    context.removedP2Texture = null;
    // Restart animation loop
    context.rafId = window.requestAnimationFrame((time) => animateFrame(context, time));
  };

  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
  context.cleanupHandlers.push(() => {
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
  });

  return context;
}

function destroyScene(context: SceneContext | null): void {
  if (!context) return;

  if (context.rafId !== null) {
    window.cancelAnimationFrame(context.rafId);
    context.rafId = null;
  }

  context.resizeObserver?.disconnect();
  context.resizeObserver = null;

  context.cleanupHandlers.forEach((cleanup) => cleanup());
  context.cleanupHandlers = [];

  for (const marble of context.marbles) {
    if (marble.removedMaterial) {
      marble.removedMaterial.dispose();
      marble.removedMaterial = null;
    }
  }
  disposeObject3D(context.marbleGroup);
  for (const exp of context.explosions) {
    context.effectsGroup.remove(exp.points);
    exp.geometry.dispose();
    exp.material.dispose();
  }
  context.explosions = [];
  for (const fl of context.flashes) {
    context.effectsGroup.remove(fl.sprite);
    if (fl.material.map) fl.material.map.dispose();
    fl.material.dispose();
  }
  context.flashes = [];
  disposeObject3D(context.effectsGroup);
  if (context.diceGroup) {
    disposeObject3D(context.diceGroup);
    context.scene.remove(context.diceGroup);
  }
  // Dispose dice canvas textures tracked separately from disposeObject3D
  context.diceTextures.forEach((tex) => tex.dispose());
  context.diceTextures = [];
  context.activeTexture?.dispose?.();
  context.removedTexture?.dispose?.();
  context.removedP1Texture?.dispose?.();
  context.removedP2Texture?.dispose?.();
  context.renderer.dispose();
  context.canvas.remove();
}

function LegacyBoardGrid({
  game,
  selectedRowIndex,
  selectedStartIndex,
  selectedEndIndex,
  canInteract,
  onBallClick,
  onBlockedRowClick
}: Props): React.ReactElement {
  const density = getDensity(game.numRows);
  const cellOwnerMap = useMemo(() => buildCellOwnerMap(game.moveHistory), [game.moveHistory]);
  const p1Initial = (game.player1?.name?.[0] ?? 'J').toUpperCase();
  const p2Initial = (game.player2?.name?.[0] ?? 'J').toUpperCase();
  const [blockedShakeRow, setBlockedShakeRow] = useState<number | null>(null);
  const blockedShakeTimerRef = useRef<number | null>(null);

  const winnerName = game.winner
    ? game.winner === 1
      ? game.player1?.name ?? 'Jugador 1'
      : game.player2?.name ?? 'Jugador 2'
    : null;
  const isYouWinner = game.winner === game.yourPlayerNumber;

  return (
    <div className={game.status === 'finished' ? 'board-finished-fade space-y-2.5' : 'space-y-2.5'}>
      {game.status === 'finished' && winnerName ? (
        <div className="board-finished-banner mb-3 flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center">
          <svg aria-hidden="true" className="h-5 w-5 shrink-0 animate-trophy-bounce text-amber-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L9 9H2L7.5 13.5L5.5 21L12 16.5L18.5 21L16.5 13.5L22 9H15L12 2Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
            <rect x="9" y="16" width="6" height="3" rx="0.5" fill="#f59e0b"/>
            <rect x="7" y="18.5" width="10" height="2" rx="0.5" fill="#d97706"/>
          </svg>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-primary/70">
              {isYouWinner ? '¡Victoria!' : 'Fin de partida'}
            </span>
            <span className="text-sm font-bold text-brown dark:text-dark-text">
              {winnerName}
            </span>
          </div>
        </div>
      ) : null}
      {game.rows.map((rowCells, rowIndex) => {
        const rowTotal = rowCells.length;
        const remainingCount = rowCells.filter((cell) => cell === 1).length;
        const isBlocked = game.lastTouchedRowIndex === rowIndex;
        const isSelectedRow = selectedRowIndex === rowIndex;
        const isRowDisabled = !canInteract || game.status !== 'playing' || remainingCount === 0;

        return (
          <div
            key={`row-${rowIndex}`}
            data-row-index={rowIndex}
            role="row"
            aria-label={`Fila ${rowIndex + 1} con ${remainingCount} canicas`}
            className={[
              'flex items-center gap-2 py-1.5 px-4 transition-shadow duration-200 overflow-x-auto',
              isSelectedRow ? 'scale-[1.01]' : '',
              isBlocked ? 'blocked brightness-105' : '',
              blockedShakeRow === rowIndex ? 'blocked-shake' : ''
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* Row number badge — helps players orient on larger boards and communicate with rivals */}
            <span
              aria-hidden="true"
              className={[
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                'text-[10px] font-bold leading-none select-none',
                'border transition-all duration-150',
                density === 'dense' ? 'h-5 w-5 text-[9px]' : density === 'compact' ? 'h-5 w-5 text-[9px]' : '',
                isSelectedRow
                  ? 'border-primary/60 bg-primary/20 text-primary shadow-sm'
                  : isBlocked
                    ? 'border-red-400/50 bg-red-400/15 text-red-400'
                    : 'border-brown/25 bg-sand/60 text-brown/70 dark:border-white/20 dark:bg-dark-surface dark:text-dark-muted'
              ].join(' ')}
            >
              {rowIndex + 1}
            </span>
            <div className="inline-flex min-h-7 items-center justify-center gap-1.5 px-3 w-max">
              {Array.from({ length: rowTotal }, (_, ballIndex) => {
                const isRemoved = rowCells[ballIndex] !== 1;
                const isSelected =
                  !isRemoved &&
                  isSelectedRow &&
                  selectedStartIndex !== null &&
                  selectedEndIndex !== null &&
                  ballIndex >= selectedStartIndex &&
                  ballIndex <= selectedEndIndex;
                const isMarbleDisabled = isRowDisabled || isRemoved;

                if (isRemoved) {
                  const cellOwner = cellOwnerMap.get(`${rowIndex}:${ballIndex}`);
                  const isP1 = cellOwner === 1;
                  const isP2 = cellOwner === 2;
                  const initial = isP1 ? p1Initial : isP2 ? p2Initial : '';
                  // Distinct dark backgrounds per owner — unmistakably "dead" balls
                  // Light mode: very dark backgrounds for contrast
                  // Dark mode: darker/more neutral so X mark pops; X mark also brighter in dark
                  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
                  const bgClass = isP1
                    ? isDark
                      ? 'border-rose-500/70 bg-gradient-to-br from-rose-950 to-rose-990/95 dark:border-rose-400/60 dark:from-rose-950 dark:to-rose-900/95'
                      : 'border-rose-600/90 bg-gradient-to-br from-rose-950 to-rose-999 dark:from-rose-900 dark:to-rose-950 dark:border-rose-500/70'
                    : isP2
                      ? isDark
                        ? 'border-orange-500/70 bg-gradient-to-br from-orange-950 to-orange-990/95 dark:border-orange-400/60 dark:from-orange-950 dark:to-orange-900/95'
                        : 'border-orange-600/90 bg-gradient-to-br from-orange-950 to-orange-999 dark:from-orange-900 dark:to-orange-950 dark:border-orange-500/70'
                      : isDark
                        ? 'border-slate-500/70 bg-gradient-to-br from-slate-900 to-slate-950/95 dark:border-slate-400/60 dark:from-slate-900 dark:to-slate-950/95'
                        : 'border-slate-600/90 bg-gradient-to-br from-slate-950 to-zinc-999 dark:from-slate-700 dark:to-slate-900 dark:border-slate-500/70';
                  // X mark color: vivid/bright in dark mode so it unmistakably reads as "removed"
                  // Red for J1, blue for J2, white for neutral — very high contrast
                  const xColor = isP1
                    ? isDark ? '#ffffff' : '#ef4444'
                    : isP2
                      ? isDark ? '#ffffff' : '#3b82f6'
                      : isDark ? '#ffffff' : '#94a3b8';
                  const xGlow = isP1
                    ? isDark ? 'rgba(255,120,120,1)' : 'rgba(239,68,68,1)'
                    : isP2
                      ? isDark ? 'rgba(120,180,255,1)' : 'rgba(59,130,246,1)'
                      : isDark ? 'rgba(255,255,255,1)' : 'rgba(148,163,184,0.9)';

                  return (
                    <button
                      key={`ball-${rowIndex}-${ballIndex}`}
                      type="button"
                      aria-label={`Fila ${rowIndex + 1}, canica ${ballIndex + 1} (quitada por ${isP1 ? game.player1?.name : isP2 ? game.player2?.name : 'dado'})`}
                      className={[
                        marbleSizeClass(density),
                        'rounded-full border transition-all duration-150 cursor-default relative overflow-hidden',
                        'flex items-center justify-center',
                        density === 'dense' ? 'text-[8px]' : density === 'compact' ? 'text-[9px]' : 'text-[11px]',
                        bgClass
                      ].join(' ')}
                      disabled
                      style={{ touchAction: 'manipulation' }}
                    >
                      {/* Bold SVG X mark — unmistakable "removed" indicator, matches 3D texture */}
                      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center select-none">
                        <svg viewBox="0 0 24 24" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ filter: `drop-shadow(0 0 8px ${xGlow}) drop-shadow(0 0 3px ${xGlow}) drop-shadow(0 0 1px ${xGlow})` }}>
                          <line x1="3" y1="3" x2="21" y2="21" stroke={xColor} strokeWidth="5.5" strokeLinecap="round"/>
                          <line x1="21" y1="3" x2="3" y2="21" stroke={xColor} strokeWidth="5.5" strokeLinecap="round"/>
                        </svg>
                      </span>
                      {/* Player initial at bottom-right corner for reference */}
                      {initial ? (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-px right-px text-[0.55em] font-bold text-white/50"
                        >
                          {initial}
                        </span>
                      ) : null}
                    </button>
                  );
                }

                // Build a precise, accessible label — reflects real state, not just "disponible"
                const marbleLabel = (() => {
                  if (isRemoved) return `Fila ${rowIndex + 1}, canica ${ballIndex + 1} (quitada)`;
                  if (isSelected) return `Fila ${rowIndex + 1}, canica ${ballIndex + 1} (seleccionada)`;
                  if (isBlocked && !isMarbleDisabled) return `Fila ${rowIndex + 1}, canica ${ballIndex + 1} (bloqueada — fila tocada por el rival)`;
                  if (isMarbleDisabled) return `Fila ${rowIndex + 1}, canica ${ballIndex + 1} (no disponible)`;
                  return `Fila ${rowIndex + 1}, canica ${ballIndex + 1} (disponible)`;
                })();

                return (
                  <button
                    key={`ball-${rowIndex}-${ballIndex}`}
                    type="button"
                    aria-label={marbleLabel}
                    className={activeMarbleClass({
                      isSelected,
                      isBlocked,
                      isDisabled: isMarbleDisabled,
                      isRemoved: false,
                      density
                    })}
                    onClick={() => {
                      if (isBlocked && !isMarbleDisabled && !isRemoved) {
                        // Use local state for 3D; prop is only wired in 2D fallback
                        if (typeof onBlockedRowClick === 'function') {
                          onBlockedRowClick(rowIndex);
                        } else {
                          if (blockedShakeTimerRef.current !== null) window.clearTimeout(blockedShakeTimerRef.current);
                          setBlockedShakeRow(rowIndex);
                          blockedShakeTimerRef.current = window.setTimeout(() => {
                            setBlockedShakeRow(null);
                            blockedShakeTimerRef.current = null;
                          }, 460);
                        }
                      }
                      onBallClick(rowIndex, ballIndex);
                    }}
                    disabled={isMarbleDisabled}
                    style={{ touchAction: 'manipulation' }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Inline SVG icons — replaces emoji for WCAG consistency (same style as GameInfoPanel)
const DICE_POWER_ICONS: Record<string, React.ReactElement> = {
  bomba: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-5 w-5" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="14" r="8" fill="#374151" stroke="#9ca3af" strokeWidth="1.5"/>
      <circle cx="8" cy="11" r="1.5" fill="#9ca3af"/>
      <circle cx="14" cy="9" r="1" fill="#9ca3af"/>
      <rect x="10.5" y="3" width="3" height="5" rx="1.5" fill="#6b7280"/>
      <path d="M12 3 Q14 1 15.5 2" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  rayo: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-5 w-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  diagonal: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-5 w-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6l4 4M10 4l6 6M18 6l-4 4" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 18l4-4M10 20l6-6M18 18l-4-4" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  resurreccion: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-5 w-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12M12 21v-3M18.36 18.36l-2.12-2.12M21 12h-3M18.36 5.64l-2.12 2.12" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="4" fill="#10b981" stroke="#34d399" strokeWidth="1.5"/>
    </svg>
  )
};

const DICE_POWER_META: Record<string, {
  label: string;
  bg: string;
  border: string;
  text: string;
  icon: React.ReactElement;
  iconBg: string;
}> = {
  bomba: {
    label: 'Bomba',
    bg: 'bg-red-500/90',
    border: 'border-red-400/60',
    text: 'text-white',
    icon: DICE_POWER_ICONS.bomba,
    iconBg: 'bg-red-600'
  },
  rayo: {
    label: 'Rayo',
    bg: 'bg-yellow-500/90',
    border: 'border-yellow-400/60',
    text: 'text-yellow-950',
    icon: DICE_POWER_ICONS.rayo,
    iconBg: 'bg-yellow-600'
  },
  diagonal: {
    label: 'Diagonal',
    bg: 'bg-purple-500/90',
    border: 'border-purple-400/60',
    text: 'text-white',
    icon: DICE_POWER_ICONS.diagonal,
    iconBg: 'bg-purple-600'
  },
  resurreccion: {
    label: 'Resurrección',
    bg: 'bg-emerald-500/90',
    border: 'border-emerald-400/60',
    text: 'text-white',
    icon: DICE_POWER_ICONS.resurreccion,
    iconBg: 'bg-emerald-600'
  }
};

// Fallback SVG die icon — used when the dice power is unknown or not yet revealed.
// Matches the style of DICE_POWER_ICONS (canvas 2D, no emoji, WCAG-compliant).
const FALLBACK_DICE_ICON: React.ReactElement = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="inline h-5 w-5" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="3" fill="#f59e0b" stroke="#fbbf24" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="1.5" fill="#fef3c7"/>
    <circle cx="12" cy="12" r="1.5" fill="#fef3c7"/>
    <circle cx="16" cy="16" r="1.5" fill="#fef3c7"/>
  </svg>
);

function DiceResultBanner({
  power,
  onDismiss,
  titleId,
  descId
}: {
  power: string;
  onDismiss?: () => void;
  /** ID for the element that labels this alertdialog (the power name). */
  titleId?: string;
  /** ID for the element that describes this alertdialog (the hint text). */
  descId?: string;
}): React.ReactElement {
  const meta = DICE_POWER_META[power] ?? {
    label: 'Poder especial',
    bg: 'bg-amber-500/90',
    border: 'border-amber-400/60',
    text: 'text-white',
    icon: FALLBACK_DICE_ICON,
    iconBg: 'bg-amber-600'
  };

  return (
    <div
      className={[
        'dice-result-overlay pointer-events-auto rounded-2xl border-2 border-white/20',
        'px-5 py-3 shadow-2xl backdrop-blur-xl cursor-pointer w-full max-w-[18rem] mx-3',
        meta.bg,
        meta.border
      ].join(' ')}
      onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Screen-reader dismiss instruction — referred by aria-describedby on the alertdialog wrapper.
          Visually hidden so the visible close button stays the sole visual affordance. */}
      <span id={`${descId}-dismiss`} className="sr-only">
        Toca o haz clic para cerrar el diálogo.
      </span>
      {/* Tap/click anywhere on banner to dismiss — critical for mobile UX */}
      <div
        className="flex items-center gap-3"
      >
        <div
          className={[
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl',
            meta.iconBg
          ].join(' ')}
        >
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p id={descId} className={['text-[10px] font-black uppercase tracking-[0.2em]', meta.text, 'opacity-80'].join(' ')}>
            Dado especial usado
          </p>
          <p id={titleId} className={['text-xl font-black tracking-tight', meta.text].join(' ')}>
            {meta.label}
          </p>
          {/* Visible dismiss hint for sighted users. Screen readers get the sr-only version above. */}
          <p aria-hidden="true" className="mt-1 text-[10px] font-semibold leading-tight text-white/70">
            Toca o haz clic para cerrar
          </p>
        </div>
        {/* Visible dismiss button — always visible for discoverability */}
        <button
          type="button"
          aria-label="Cerrar resultado del dado"
          onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
          className={[
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full pointer-events-auto',
            'border border-white/25 bg-black/20 text-white/80',
            'transition hover:border-white/50 hover:bg-black/35 active:scale-90',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60'
          ].join(' ')}
          style={{ touchAction: 'manipulation' }}
        >
          {/* × icon drawn with CSS to avoid emoji */}
          <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-lg font-bold leading-none">×</span>
        </button>
      </div>
    </div>
  );
}

export function GameBoard({
  game,
  selectedRowIndex,
  selectedStartIndex,
  selectedEndIndex,
  canInteract,
  hasPendingMove = false,
  hasTurnCoach = false,
  boardAttentionPulse = false,
  // yourTurnGlow removed — board glow is now retriggerable per turn via boardGlowActive state
  hasLiveChannel,
  onBallClick,
  onDiceRoll,
  diceAvailable,
  lastDiceResult
}: Props): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const onBallClickRef = useRef(onBallClick);
  const onDiceRollRef = useRef(onDiceRoll);
  const prevRowsRef = useRef<number[][] | null>(null);
  const prevDiceAvailableRef = useRef<boolean | undefined>(undefined);
  const prevCanInteractRef = useRef<boolean | undefined>(undefined);
  const [renderMode, setRenderMode] = useState<'loading' | 'three' | 'fallback'>('loading');
  const [isRollingDice, setIsRollingDice] = useState(false);
  const diceSpinTimeoutRef = useRef<number | null>(null);
  const [diceChipAnim, setDiceChipAnim] = useState<'ready' | 'spent' | null>(null);
  const [diceResultArrived, setDiceResultArrived] = useState(false);
  const diceResultArrivedTimerRef = useRef<number | null>(null);
  const [diceResultOverlay, setDiceResultOverlay] = useState<DiceResult | null>(null);
  const [turnBadgeAnim, setTurnBadgeAnim] = useState<'pulse' | null>(null);
  const [boardGlowActive, setBoardGlowActive] = useState(false);
  const diceResultTimerRef = useRef<number | null>(null);
  const prevDiceResultRef = useRef<DiceResult | null>(null);
  const boardGlowTimeoutRef = useRef<number | null>(null);

  const statusLabel = useMemo(() => {
    if (renderMode === 'loading') return 'Inicializando tablero 3D...';
    if (renderMode === 'fallback') return 'Tablero 2D clásico (3D no disponible en este dispositivo/navegador).';
    if (
      selectedRowIndex !== null &&
      selectedStartIndex !== null &&
      selectedEndIndex !== null &&
      selectedEndIndex >= selectedStartIndex
    ) {
      const count = selectedEndIndex - selectedStartIndex + 1;
      return `Fila ${selectedRowIndex + 1} · quitar ${count}`;
    }
    return canInteract
      ? diceAvailable
        ? 'Tienes dado especial — lánzalo o selecciona canicas'
        : 'Click/Tap para elegir cantidad en la fila'
      : 'Esperando tu turno';
  }, [renderMode, canInteract, diceAvailable, selectedRowIndex, selectedStartIndex, selectedEndIndex]);

  const turnLimit = game.moveHistory.length + 1;
  const selectedCount =
    selectedRowIndex !== null &&
    selectedStartIndex !== null &&
    selectedEndIndex !== null &&
    selectedEndIndex >= selectedStartIndex
      ? selectedEndIndex - selectedStartIndex + 1
      : 0;
  const remainingSelectionCapacity = Math.max(0, turnLimit - selectedCount);

  const currentTurnPlayerName = game.currentTurn === 1
    ? (game.player1?.name ?? 'Jugador 1')
    : (game.player2?.name ?? 'Jugador 2');

  const boardHudTitle = selectedCount > 0
    ? `Fila ${selectedRowIndex! + 1}`
    : canInteract
      ? 'Tu turno'
      : `Esperando · ${currentTurnPlayerName}`;
  const boardHudBody = selectedCount > 0
    ? `${selectedCount}/${turnLimit} seleccionadas · restan ${remainingSelectionCapacity}`
    : canInteract
      ? diceAvailable
        ? `Dado listo — lanza primero o selecciona canicas (hasta ${turnLimit} contiguas)`
        : `Selecciona canicas contiguas — hasta ${turnLimit}`
      : 'Esperando turno del rival';

  useEffect(() => {
    onBallClickRef.current = onBallClick;
  }, [onBallClick]);

  useEffect(() => {
    onDiceRollRef.current = onDiceRoll;
  }, [onDiceRoll]);

  // Animate dice chip on state transitions (available ↔ spent)
  useEffect(() => {
    const prev = prevDiceAvailableRef.current;
    if (prev === undefined) {
      prevDiceAvailableRef.current = diceAvailable;
      return;
    }
    if (prev !== diceAvailable) {
      setDiceChipAnim(diceAvailable ? 'ready' : 'spent');
      const timer = setTimeout(() => setDiceChipAnim(null), 500);
      prevDiceAvailableRef.current = diceAvailable;
      return () => clearTimeout(timer);
    }
    // No state change — but still return cleanup so the pending timer is cleared on unmount
    prevDiceAvailableRef.current = diceAvailable;
    return () => {};
  }, [diceAvailable]);

  // Pulse the turn badge AND retrigger the board glow when the user receives the turn (false → true).
  // board-your-turn-glow has animation-fill-mode:both so it only plays on first application —
  // we force a restart by briefly removing the class then adding it back via setTimeout(0).
  useEffect(() => {
    const prev = prevCanInteractRef.current;
    if (prev === undefined) {
      prevCanInteractRef.current = canInteract;
      return;
    }
    if (!prev && canInteract) {
      setTurnBadgeAnim('pulse');
      const badgeTimer = setTimeout(() => setTurnBadgeAnim(null), 1800);

      // Retrigger board glow every turn, not just the first one.
      // flushSync breaks React 18 automatic batching so each state update is a separate render.
      if (boardGlowTimeoutRef.current !== null) clearTimeout(boardGlowTimeoutRef.current);
      flushSync(() => setBoardGlowActive(false));
      boardGlowTimeoutRef.current = window.setTimeout(() => {
        flushSync(() => setBoardGlowActive(true));
        boardGlowTimeoutRef.current = window.setTimeout(() => {
          flushSync(() => setBoardGlowActive(false));
          boardGlowTimeoutRef.current = null;
        }, 1200);
      }, 20);

      prevCanInteractRef.current = canInteract;
      return () => {
        clearTimeout(badgeTimer);
        if (boardGlowTimeoutRef.current !== null) {
          clearTimeout(boardGlowTimeoutRef.current);
          boardGlowTimeoutRef.current = null;
        }
      };
    }
    prevCanInteractRef.current = canInteract;
  }, [canInteract]);

  // Show dice result overlay AND pulse the HUD chip when a new dice result arrives
  useEffect(() => {
    if (!lastDiceResult) return;
    // Avoid re-triggering for the same result object reference
    if (prevDiceResultRef.current === lastDiceResult) return;
    prevDiceResultRef.current = lastDiceResult;

    if (diceResultTimerRef.current) {
      window.clearTimeout(diceResultTimerRef.current);
    }
    setDiceResultOverlay(lastDiceResult);
    // Respect prefers-reduced-motion: no auto-dismiss for vestibular-sensitive users
    // (the overlay is still dismissible via tap/click/ESC).
    const rmDismissMs = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? Number.POSITIVE_INFINITY
      : 2800;
    diceResultTimerRef.current = window.setTimeout(() => {
      setDiceResultOverlay(null);
      diceResultTimerRef.current = null;
    }, rmDismissMs);

    // Also pulse the HUD dice chip so the result is visible even after the overlay dismisses
    if (diceResultArrivedTimerRef.current) {
      window.clearTimeout(diceResultArrivedTimerRef.current);
    }
    setDiceResultArrived(true);
    diceResultArrivedTimerRef.current = window.setTimeout(() => {
      setDiceResultArrived(false);
      diceResultArrivedTimerRef.current = null;
    }, 700);

    return () => {
      // Clear both pending timers to prevent stale setState on unmounted component
      if (diceResultTimerRef.current) {
        window.clearTimeout(diceResultTimerRef.current);
        diceResultTimerRef.current = null;
      }
      if (diceResultArrivedTimerRef.current) {
        window.clearTimeout(diceResultArrivedTimerRef.current);
        diceResultArrivedTimerRef.current = null;
      }
    };
  }, [lastDiceResult]);

  // Allow ESC to dismiss the dice result overlay immediately
  /** Dismiss the dice result overlay — clears timer and clears state. */
  const dismissDiceResult = (): void => {
    if (diceResultTimerRef.current) {
      window.clearTimeout(diceResultTimerRef.current);
      diceResultTimerRef.current = null;
    }
    setDiceResultOverlay(null);
    // Also clear the chip pulse animation since user has acknowledged the result
    if (diceResultArrivedTimerRef.current) {
      window.clearTimeout(diceResultArrivedTimerRef.current);
      diceResultArrivedTimerRef.current = null;
    }
    setDiceResultArrived(false);
  };

  useEffect(() => {
    if (!diceResultOverlay) return;

    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissDiceResult();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [diceResultOverlay]);

  useEffect(() => {
    let cancelled = false;

    loadThree()
      .then((THREE) => {
        if (cancelled) return;
        const mountNode = mountRef.current;
        if (!mountNode) {
          setRenderMode('fallback');
          return;
        }

        const context = initializeScene(mountNode, THREE);
        if (!context) {
          setRenderMode('fallback');
          return;
        }

        const tapState: {
          pointerId: number | null;
          startX: number;
          startY: number;
          moved: boolean;
          pointerType: string | null;
        } = {
          pointerId: null,
          startX: 0,
          startY: 0,
          moved: false,
          pointerType: null
        };
        const TAP_MOVE_THRESHOLD_PX = 10;
        const pointerOpts: AddEventListenerOptions = { passive: false };

        const releasePointerCapture = (pointerId: number | null): void => {
          if (pointerId === null) return;
          try {
            if (context.canvas.hasPointerCapture(pointerId)) {
              context.canvas.releasePointerCapture(pointerId);
            }
          } catch {
            // Ignorar navegadores que no soporten pointer capture correctamente.
          }
        };

        const handlePointerDown = (event: PointerEvent): void => {
          if (!event.isPrimary) return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          if (tapState.pointerId !== null) return;

          event.preventDefault();
          tapState.pointerId = event.pointerId;
          tapState.startX = event.clientX;
          tapState.startY = event.clientY;
          tapState.moved = false;
          tapState.pointerType = event.pointerType || null;

          try {
            context.canvas.setPointerCapture(event.pointerId);
          } catch {
            // Safari iOS puede fallar en algunos contextos; el flujo sigue sin capture.
          }

          updatePointerFromClient(context, event.clientX, event.clientY);
        };

        const handlePointerMoveTap = (event: PointerEvent): void => {
          if (tapState.pointerId !== event.pointerId) return;
          event.preventDefault();
          const deltaX = Math.abs(event.clientX - tapState.startX);
          const deltaY = Math.abs(event.clientY - tapState.startY);
          if (deltaX > TAP_MOVE_THRESHOLD_PX || deltaY > TAP_MOVE_THRESHOLD_PX) {
            tapState.moved = true;
          }
        };

        const handlePointerUp = (event: PointerEvent): void => {
          if (tapState.pointerId !== event.pointerId) return;
          event.preventDefault();
          const shouldSelect = !tapState.moved;

          releasePointerCapture(tapState.pointerId);
          tapState.pointerId = null;
          tapState.moved = false;
          tapState.pointerType = null;
          if (!shouldSelect) return;

          updatePointerFromClient(context, event.clientX, event.clientY);

          if (context.diceMesh && context.onDiceClickCb) {
            context.raycaster.setFromCamera(context.pointer, context.camera);
            const diceHits = context.raycaster.intersectObject(context.diceMesh, false);
            if (diceHits.length > 0) {
              context.onDiceClickCb();
              return;
            }
          }

          const hit = pickMarble(context);
          if (!hit || !hit.clickable) return;
          // Haptic feedback on ball tap (mirrors the pendingMove vibration in HomePage)
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(18);
          }
          onBallClickRef.current(hit.rowIndex, hit.ballIndex);
        };

        const handlePointerCancel = (): void => {
          releasePointerCapture(tapState.pointerId);
          tapState.pointerId = null;
          tapState.moved = false;
          tapState.pointerType = null;
        };

        context.canvas.addEventListener('pointerdown', handlePointerDown, pointerOpts);
        context.canvas.addEventListener('pointermove', handlePointerMoveTap, pointerOpts);
        context.canvas.addEventListener('pointerup', handlePointerUp, pointerOpts);
        context.canvas.addEventListener('pointercancel', handlePointerCancel);
        context.cleanupHandlers.push(() => context.canvas.removeEventListener('pointerdown', handlePointerDown, pointerOpts));
        context.cleanupHandlers.push(() => context.canvas.removeEventListener('pointermove', handlePointerMoveTap, pointerOpts));
        context.cleanupHandlers.push(() => context.canvas.removeEventListener('pointerup', handlePointerUp, pointerOpts));
        context.cleanupHandlers.push(() => context.canvas.removeEventListener('pointercancel', handlePointerCancel));

        sceneRef.current = context;
        setRenderMode('three');
      })
      .catch(() => {
        if (!cancelled) {
          setRenderMode('fallback');
        }
      });

    return () => {
      cancelled = true;
      destroyScene(sceneRef.current);
      sceneRef.current = null;
      if (diceResultTimerRef.current) {
        window.clearTimeout(diceResultTimerRef.current);
        diceResultTimerRef.current = null;
      }
      if (boardGlowTimeoutRef.current !== null) {
        window.clearTimeout(boardGlowTimeoutRef.current);
        boardGlowTimeoutRef.current = null;
      }
      if (diceResultArrivedTimerRef.current) {
        window.clearTimeout(diceResultArrivedTimerRef.current);
        diceResultArrivedTimerRef.current = null;
      }
      if (diceSpinTimeoutRef.current !== null) {
        window.clearTimeout(diceSpinTimeoutRef.current);
        diceSpinTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (renderMode !== 'three') return;
    const context = sceneRef.current;
    if (!context) return;

    const prevRows = prevRowsRef.current;
    const newRows = game.rows;

    const dyingSet = new Set<string>();
    if (prevRows && prevRows.length === newRows.length) {
      for (let r = 0; r < newRows.length; r++) {
        for (let c = 0; c < newRows[r].length; c++) {
          if (prevRows[r]?.[c] === 1 && newRows[r][c] === 0) {
            dyingSet.add(`${r}:${c}`);
          }
        }
      }
    }

    buildBoardMeshes(context, game, selectedRowIndex, selectedStartIndex, selectedEndIndex, canInteract, dyingSet);

    prevRowsRef.current = newRows.map((r) => [...r]);

    if (context.rafId === null) {
      context.rafId = window.requestAnimationFrame((time) => animateFrame(context, time));
    }
  }, [renderMode, game, selectedRowIndex, selectedStartIndex, selectedEndIndex, canInteract]);

  const showDiceAction = !!diceAvailable && canInteract && game.status === 'playing' && !hasPendingMove;

  const triggerDiceRoll = useMemo(
    () => async (): Promise<void> => {
      const rollFn = onDiceRollRef.current;
      const context = sceneRef.current;
      if (!rollFn || isRollingDice) return;

      // Clear any previously pending spin-stop timeout before starting a new roll
      if (diceSpinTimeoutRef.current !== null) {
        window.clearTimeout(diceSpinTimeoutRef.current);
        diceSpinTimeoutRef.current = null;
      }

      setIsRollingDice(true);
      if (context) {
        context.diceSpinning = true;
        context.diceSpinT = 0;
      }

      try {
        await rollFn();
      } finally {
        diceSpinTimeoutRef.current = window.setTimeout(() => {
          diceSpinTimeoutRef.current = null;
          const latestContext = sceneRef.current;
          if (latestContext) {
            latestContext.diceSpinning = false;
          }
          setIsRollingDice(false);
        }, 1200);
      }
    },
    [isRollingDice]
  );

  // Stop dice spin and clear pending timeout when dice action disappears
  useEffect(() => {
    if (!showDiceAction && isRollingDice) {
      if (diceSpinTimeoutRef.current !== null) {
        window.clearTimeout(diceSpinTimeoutRef.current);
        diceSpinTimeoutRef.current = null;
      }
      // Also stop the 3D spin immediately if context still exists
      const ctx = sceneRef.current;
      if (ctx) {
        ctx.diceSpinning = false;
      }
      setIsRollingDice(false);
    }
  }, [showDiceAction, isRollingDice]);

  useEffect(() => {
    if (renderMode !== 'three') return;
    const context = sceneRef.current;
    if (!context) return;

    if (showDiceAction && !context.diceGroup) {
      const { diceGroup, diceMesh, diceTextures } = createDice3D(context.THREE, context.scene);

      const cam = context.camera;
      const fovRad = (cam.fov * Math.PI) / 180;
      const dist = cam.position.z - 1;
      const visibleH = 2 * Math.tan(fovRad / 2) * dist;
      const visibleW = visibleH * cam.aspect;
      const diceX = visibleW / 2 - 1.4;
      const diceY = visibleH / 2 - 1.4 + cam.position.y;

      diceGroup.position.set(diceX, diceY, 1);
      diceGroup.userData.baseY = diceY;
      context.diceGroup = diceGroup;
      context.diceMesh = diceMesh;
      context.diceTextures = diceTextures;
      context.diceSpinning = false;
      context.diceSpinT = 0;
    } else if (!showDiceAction && context.diceGroup) {
      // Dispose dice canvas textures before removing — prevents GPU memory leak
      context.diceTextures.forEach((tex) => tex.dispose());
      context.diceTextures = [];
      context.scene.remove(context.diceGroup);
      context.diceGroup = null;
      context.diceMesh = null;
      context.diceSpinning = false;
    }

    context.onDiceClickCb = showDiceAction ? () => { void triggerDiceRoll(); } : null;
  }, [renderMode, showDiceAction, triggerDiceRoll, game.numRows]);

  const boardBottomInsetClass = hasPendingMove
    ? 'pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(8.25rem+env(safe-area-inset-bottom))]'
    : hasTurnCoach
      ? 'pb-[calc(6.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
      : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]';

  return (
    <section
      id="board"
      role="grid"
      aria-label={`Tablero de juego. ${statusLabel}`}
      className={[
        'relative flex flex-1 scroll-mt-24 flex-col bg-background-dark dark:bg-dark-bg min-h-0 transition-[padding,box-shadow,border-color] duration-200',
        boardAttentionPulse ? 'board-attention-pulse' : '',
        boardGlowActive ? 'board-your-turn-glow' : '',
        boardBottomInsetClass
      ].join(' ')}
      style={{ touchAction: 'manipulation' }}
    >
      {renderMode === 'fallback' ? (
        <div className="relative flex flex-1 flex-col min-h-0">
          <div className="relative flex flex-1 flex-col min-h-0">
            <LegacyBoardGrid
              game={game}
              selectedRowIndex={selectedRowIndex}
              selectedStartIndex={selectedStartIndex}
              selectedEndIndex={selectedEndIndex}
              canInteract={canInteract}
              onBallClick={onBallClick}
            />
          </div>
          {/* Dice result overlay — also shown on 2D fallback board */}
          {diceResultOverlay ? (
            <div
              className="dice-result-overlay dice-result-pop absolute inset-0 z-20 flex items-center justify-center"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="dice-result-title-2d"
              aria-describedby="dice-result-desc-2d dice-result-desc-2d-dismiss"
              onClick={(e) => { e.stopPropagation(); dismissDiceResult(); }}
            >
              <DiceResultBanner
                power={diceResultOverlay.power}
                onDismiss={dismissDiceResult}
                titleId="dice-result-title-2d"
                descId="dice-result-desc-2d"
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col">
          <div
            ref={mountRef}
            aria-hidden="true"
            className="board-canvas-enter relative min-h-[300px] flex-1 w-full overflow-hidden"
          />
          {renderMode === 'loading' ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="board-skeleton-rows flex flex-col items-center gap-2.5">
                {Array.from({ length: Math.min(game.numRows, 8) }, (_, i) => {
                  const rowLen = game.rows[i]?.length ?? Math.min(i + 3, 10);
                  return (
                    <div key={`skel-row-${i}`} className="flex items-center gap-2">
                      {Array.from({ length: rowLen }, (_, j) => (
                        <div
                          key={`skel-ball-${j}`}
                          className="board-skeleton-ball h-5 w-5 rounded-full md:h-6 md:w-6"
                          style={{ animationDelay: `${(i * rowLen + j) * 60}ms` }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brown/60 dark:text-dark-muted/70">
                Preparando tablero 3D…
              </p>
            </div>
          ) : null}

          {sceneRef.current?.contextLost ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-400/60 bg-black/40">
                <svg aria-hidden="true" className="h-7 w-7 text-amber-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-100">
                Tablero reactivándose…
              </p>
              <p className="text-xs text-white/60">El contexto gráfico se recuperó. Continúa jugando.</p>
            </div>
          ) : null}

          {/* Dice result overlay — appears centered over the 3D canvas */}
          {diceResultOverlay ? (
            <div
              className="dice-result-overlay dice-result-pop absolute inset-0 z-20 flex items-center justify-center"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="dice-result-title-3d"
              aria-describedby="dice-result-desc-3d dice-result-desc-3d-dismiss"
              onClick={(e) => { e.stopPropagation(); dismissDiceResult(); }}
            >
              <DiceResultBanner
                power={diceResultOverlay.power}
                onDismiss={dismissDiceResult}
                titleId="dice-result-title-3d"
                descId="dice-result-desc-3d"
              />
            </div>
          ) : null}
        </div>
      )}

      {game.status === 'playing' ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[15rem] sm:left-4 sm:top-4">
          <div
            className={[
              'board-legend-enter rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur-xl',
              selectedCount > 0
                ? 'border-primary/30 bg-white/92 text-[#4a3f32] dark:border-primary/30 dark:bg-dark-card/92 dark:text-dark-text'
                : canInteract
                  ? 'border-emerald-500/25 bg-white/90 text-[#4a3f32] dark:border-emerald-500/25 dark:bg-dark-card/92 dark:text-dark-text'
                  : 'border-brown/15 bg-white/88 text-[#4a3f32] dark:border-white/10 dark:bg-dark-card/88 dark:text-dark-text'
            ].join(' ')}
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Connection status dot — green = live SSE, yellow = polling, grey = disconnected */}
              {hasLiveChannel !== undefined ? (
                <span
                  title={
                    hasLiveChannel ? 'Conexión en tiempo real activa' : 'Sincronizando…'
                  }
                  className={[
                    'inline-block h-2 w-2 flex-shrink-0 rounded-full align-middle transition-colors duration-500',
                    hasLiveChannel
                      ? 'connection-dot-live'
                      : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                  ].join(' ')}
                  role="status"
                  aria-label={hasLiveChannel ? 'Conexión en tiempo real activa' : 'Sincronizando'}
                />
              ) : null}
              <span
                className={[
                  'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                  selectedCount > 0
                    ? 'bg-primary/15 text-primary'
                    : canInteract
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-500/10 text-slate-500 dark:text-slate-400',
                  turnBadgeAnim === 'pulse' ? 'turn-badge-pulse' : ''
                ].join(' ')}
              >
                {boardHudTitle}
              </span>
              <span className="rounded-full border border-brown/15 bg-sand/55 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface dark:text-dark-muted">
                max {turnLimit}
              </span>
              {canInteract ? (() => {
                const base = diceAvailable
                  ? 'border-amber-400/40 bg-amber-50/70 text-amber-600 dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-300'
                  : 'border-slate-300/40 bg-slate-100/60 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-dark-muted/60';
                // NOTE: diceResultArrived && lastDiceResult must be checked BEFORE the diceChipAnim
                // spent branch — otherwise the || short-circuits on truthy 'dice-spent-chip' and
                // the dice-result-arrived animation never fires when the dice is already spent.
                const anim = diceAvailable
                  ? (diceChipAnim === 'ready' ? 'dice-ready-pop' : '')
                  : ((diceResultArrived && lastDiceResult ? 'dice-result-arrived' : '')
                  || (diceChipAnim === 'spent' ? 'dice-spent-chip' : ''));
                return (
                  <span
                    aria-label={diceAvailable ? 'Dado especial disponible' : 'Dado especial ya usado'}
                    className={[
                      'rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                      base,
                      anim
                    ].filter(Boolean).join(' ')}
                  >
                    {diceAvailable ? (
                      <>
                        <svg aria-hidden="true" className="inline h-3 w-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L9.5 9.5L2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                        {' Dado listo'}
                      </>
                    ) : lastDiceResult ? (
                      <>
                        {/* Compact inline SVGs matching DICE_POWER_META colours, sized for the chip */}
                        {lastDiceResult.power === 'bomba' && (
                          <svg aria-hidden="true" className="inline h-3 w-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="14" r="7" fill="#374151" stroke="#9ca3af" strokeWidth="1.5"/>
                            <circle cx="8.5" cy="11.5" r="1.25" fill="#9ca3af"/>
                            <circle cx="14" cy="9.5" r="0.9" fill="#9ca3af"/>
                            <rect x="10.5" y="3.5" width="3" height="4" rx="1.5" fill="#6b7280"/>
                            <path d="M12 3.5 Q14 1.5 15.5 2.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                          </svg>
                        )}
                        {lastDiceResult.power === 'rayo' && (
                          <svg aria-hidden="true" className="inline h-3 w-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {lastDiceResult.power === 'diagonal' && (
                          <svg aria-hidden="true" className="inline h-3 w-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 6l4 4M10 4l6 6M18 6l-4 4" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M6 18l4-4M10 20l6-6M18 18l-4-4" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        )}
                        {lastDiceResult.power === 'resurreccion' && (
                          <svg aria-hidden="true" className="inline h-3 w-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 3v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12M12 21v-3M18.36 18.36l-2.12-2.12M21 12h-3M18.36 5.64l-2.12 2.12" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
                            <circle cx="12" cy="12" r="3.5" fill="#10b981" stroke="#34d399" strokeWidth="1.5"/>
                          </svg>
                        )}
                        {' '}{DICE_POWER_META[lastDiceResult.power]?.label ?? lastDiceResult.power}
                      </>
                    ) : 'Dado gastado'}
                  </span>
                );
              })() : null}
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-snug text-inherit">
              {boardHudBody}
            </p>
            {selectedCount > 0 ? (
              <p className="mt-1 text-[10px] leading-snug text-[#8c7d6b] dark:text-dark-muted">
                Amplía tocando más canicas; toca un extremo para reducir.
              </p>
            ) : canInteract ? (
              <p className="mt-1 text-[10px] leading-snug text-[#8c7d6b] dark:text-dark-muted">
                {diceAvailable
                  ? 'El dado está listo — lanza primero o selecciona canicas.'
                  : 'Toca una canica para empezar a seleccionar.'}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showDiceAction ? (
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex max-w-[13rem] justify-end sm:right-4 sm:top-4">
          <div className="pointer-events-auto flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={() => void triggerDiceRoll()}
              disabled={isRollingDice}
              aria-label={isRollingDice ? 'Lanzando dado especial' : 'Usar dado especial'}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-300/45 bg-black/60 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-amber-100 shadow-lg shadow-amber-950/30 backdrop-blur transition hover:border-amber-200/70 hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isRollingDice ? (
                <span aria-hidden="true" className="text-base leading-none animate-spin">⟳</span>
              ) : (
                <Image
                  aria-hidden="true"
                  src={getDiceFaceDataUrl(4)}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded-sm"
                  unoptimized
                />
              )}
              <span>{isRollingDice ? 'Lanzando...' : 'Dado x1'}</span>
            </button>
            <p className="rounded-full bg-black/45 px-2.5 py-1 text-right text-[10px] font-semibold leading-tight text-white/80 backdrop-blur">
              {renderMode === 'fallback'
                ? 'El dado está disponible aquí abajo.'
                : 'Toca para lanzar el dado.'}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

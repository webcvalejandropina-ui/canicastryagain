'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from 'react';

import { DiceResult, GameState } from '@/features/game/types';

type Props = {
  game: GameState;
  selectedRowIndex: number | null;
  selectedStartIndex: number | null;
  selectedEndIndex: number | null;
  canInteract: boolean;
  hasPendingMove?: boolean;
  hasTurnCoach?: boolean;
  onBallClick: (rowIndex: number, ballIndex: number) => void;
  onDiceRoll?: () => Promise<DiceResult | null>;
  diceAvailable?: boolean;
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
  if (density === 'dense') return 'h-4 w-4 md:h-5 md:w-5';
  if (density === 'compact') return 'h-5 w-5 md:h-6 md:w-6';
  return 'h-6 w-6 md:h-7 md:w-7';
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

  return [
    marbleSizeClass(density),
    'rounded-full border transition-all duration-150',
    isRemoved ? '' : 'ball-shadow',
    'will-change-transform',
    animationClass,
    appearance,
    cursorClass
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
  initial: string,
  colors: { base: string; highlight: string; shadow: string }
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
  ctx.fillRect(0, 0, 256, 256);

  ctx.lineWidth = 5;
  ctx.strokeStyle = colors.shadow;
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 8; i += 1) {
    const sx = Math.random() * 256;
    const sy = Math.random() * 256;
    const ex = Math.random() * 256;
    const ey = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(
      (sx + ex) / 2 + (Math.random() * 60 - 30),
      (sy + ey) / 2 + (Math.random() * 60 - 30),
      ex, ey
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.font = 'bold 130px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 6;
  ctx.fillText(initial.toUpperCase(), 128, 138);
  ctx.shadowBlur = 0;

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

  if (context.cachedP1Initial !== p1Initial || !context.removedP1Texture) {
    context.removedP1Texture?.dispose?.();
    context.removedP1Texture = createRemovedMarbleTexture(THREE, p1Initial, {
      base: '#dc2626', highlight: '#fca5a5', shadow: '#7f1d1d'
    });
    context.cachedP1Initial = p1Initial;
  }
  if (context.cachedP2Initial !== p2Initial || !context.removedP2Texture) {
    context.removedP2Texture?.dispose?.();
    context.removedP2Texture = createRemovedMarbleTexture(THREE, p2Initial, {
      base: '#ea580c', highlight: '#fdba74', shadow: '#7c2d12'
    });
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

  const sphereGeometry = new THREE.SphereGeometry(radius, detail, detail);

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
      if (!isActive && !isDying) {
        const cellOwner = cellOwnerMap.get(cellKey);
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
  const t = timeMs * 0.001;
  const rawDt = context.lastFrameTime > 0 ? (timeMs - context.lastFrameTime) * 0.001 : 1 / 60;
  const dt = Math.min(rawDt, 0.05);
  context.lastFrameTime = timeMs;

  const targetX = context.pointerY * 0.1;
  const targetY = context.pointerX * 0.12 + Math.sin(t * 0.3) * 0.03;
  const targetZ = Math.sin(t * 0.25) * 0.015;
  context.boardPivot.rotation.x += (targetX - context.boardPivot.rotation.x) * 0.04;
  context.boardPivot.rotation.y += (targetY - context.boardPivot.rotation.y) * 0.04;
  context.boardPivot.rotation.z += (targetZ - context.boardPivot.rotation.z) * 0.03;

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
      const verticalOscillation = Math.sin(t * marble.bobSpeed + marble.phase) * marble.bobAmplitude;
      marble.mesh.position.y = THREE.MathUtils.lerp(marble.mesh.position.y, marble.baseY + verticalOscillation, 0.08);
      const selMul = marble.selected ? 5.0 : 1;
      marble.mesh.rotation.x += marble.rotationSpeedX * selMul;
      marble.mesh.rotation.y += marble.rotationSpeedY * selMul;
    } else {
      marble.mesh.position.y = THREE.MathUtils.lerp(marble.mesh.position.y, marble.baseY, 0.15);
      marble.mesh.rotation.y += 0.012;
      marble.mesh.rotation.x += 0.004;
    }

    if (marble.selected) {
      const pulse = Math.sin(t * 4 + marble.phase);
      const baseScale = 1.06 + pulse * 0.02;
      const squash = Math.sin(t * 2.5 + marble.phase) * 0.025;
      marble.mesh.scale.x = THREE.MathUtils.lerp(marble.mesh.scale.x, baseScale + squash, 0.1);
      marble.mesh.scale.y = THREE.MathUtils.lerp(marble.mesh.scale.y, baseScale - squash, 0.1);
      marble.mesh.scale.z = THREE.MathUtils.lerp(marble.mesh.scale.z, baseScale + squash * 0.5, 0.1);
      if (marble.mesh.material) {
        marble.mesh.material.emissiveIntensity = 0.5 + Math.sin(t * 3 + marble.phase) * 0.12;
      }
    } else {
      marble.mesh.scale.x = THREE.MathUtils.lerp(marble.mesh.scale.x, 1, 0.08);
      marble.mesh.scale.y = THREE.MathUtils.lerp(marble.mesh.scale.y, 1, 0.08);
      marble.mesh.scale.z = THREE.MathUtils.lerp(marble.mesh.scale.z, 1, 0.08);
    }
  }

  if (context.diceGroup) {
    if (context.diceSpinning) {
      context.diceSpinT += dt;
      context.diceGroup.rotation.x += 8 * dt;
      context.diceGroup.rotation.y += 12 * dt;
      context.diceGroup.rotation.z += 5 * dt;
      const bounce = Math.abs(Math.sin(context.diceSpinT * 6)) * 0.4;
      context.diceGroup.position.y = THREE.MathUtils.lerp(context.diceGroup.position.y, context.diceGroup.userData.baseY + bounce, 0.3);
    } else {
      context.diceGroup.rotation.x += 0.005;
      context.diceGroup.rotation.y += 0.008;
      const hover = Math.sin(t * 1.5) * 0.12;
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

function createDice3D(THREE: any, scene: any): { diceGroup: any; diceMesh: any } {
  const diceGroup = new THREE.Group();
  const size = 0.55;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const faces: Array<{ bg: string; symbol: string; color: string }> = [
    { bg: '#f59e0b', symbol: '\u{1F4A3}', color: '#fff' },
    { bg: '#ef4444', symbol: '\u26A1', color: '#fff' },
    { bg: '#8b5cf6', symbol: '\u2728', color: '#fef08a' },
    { bg: '#10b981', symbol: '\u{1F6E1}', color: '#fff' },
    { bg: '#f97316', symbol: '\u{1F3B2}', color: '#fff' },
    { bg: '#ec4899', symbol: '?', color: '#fff' }
  ];

  const textures = faces.map((f) => {
    ctx.fillStyle = f.bg;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 120px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.symbol, 128, 128);
    const tex = new THREE.CanvasTexture(canvas.cloneNode(true) as HTMLCanvasElement);
    const cloneCtx = (tex.image as HTMLCanvasElement).getContext('2d')!;
    cloneCtx.fillStyle = f.bg;
    cloneCtx.fillRect(0, 0, 256, 256);
    cloneCtx.fillStyle = f.color;
    cloneCtx.font = 'bold 120px sans-serif';
    cloneCtx.textAlign = 'center';
    cloneCtx.textBaseline = 'middle';
    cloneCtx.fillText(f.symbol, 128, 128);
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
  return { diceGroup, diceMesh };
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
  renderer.setClearColor(
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 0x0d0c09 : 0xf5f0e8,
    1
  );
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'h-full w-full';
  renderer.domElement.style.touchAction = 'none';

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
  const removedTexture = createMarbleTexture(THREE, {
    base: '#64748b',
    veins: '#94a3b8',
    highlight: '#cbd5e1',
    shadow: '#334155'
  });

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
    baseCameraZ: 0
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
  onBallClick
}: Props): React.ReactElement {
  const density = getDensity(game.numRows);
  const cellOwnerMap = useMemo(() => buildCellOwnerMap(game.moveHistory), [game.moveHistory]);
  const p1Initial = (game.player1?.name?.[0] ?? 'J').toUpperCase();
  const p2Initial = (game.player2?.name?.[0] ?? 'J').toUpperCase();

  return (
    <div className="space-y-2.5">
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
              'flex justify-center py-1.5 px-4 transition-all overflow-x-auto',
              isSelectedRow ? 'scale-[1.01]' : '',
              isBlocked ? 'brightness-105' : ''
            ]
              .filter(Boolean)
              .join(' ')}
          >
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
                  const bgClass = isP1
                    ? 'border-red-500/60 bg-gradient-to-br from-red-400 to-red-700'
                    : isP2
                      ? 'border-orange-500/60 bg-gradient-to-br from-orange-400 to-orange-700'
                      : 'border-red-900/50 bg-gradient-to-br from-red-800 to-red-950';

                  return (
                    <button
                      key={`ball-${rowIndex}-${ballIndex}`}
                      type="button"
                      aria-label={`Fila ${rowIndex + 1}, canica ${ballIndex + 1} (quitada por ${isP1 ? game.player1?.name : isP2 ? game.player2?.name : 'dado'})`}
                      className={[
                        marbleSizeClass(density),
                        'rounded-full border transition-all duration-150 cursor-default',
                        'flex items-center justify-center',
                        'text-black/80 font-bold shadow-inner',
                        density === 'dense' ? 'text-[8px]' : density === 'compact' ? 'text-[9px]' : 'text-[11px]',
                        bgClass
                      ].join(' ')}
                      disabled
                      style={{ touchAction: 'manipulation' }}
                    >
                      {initial}
                    </button>
                  );
                }

                return (
                  <button
                    key={`ball-${rowIndex}-${ballIndex}`}
                    type="button"
                    aria-label={`Fila ${rowIndex + 1}, canica ${ballIndex + 1} (disponible)`}
                    className={activeMarbleClass({
                      isSelected,
                      isBlocked,
                      isDisabled: isMarbleDisabled,
                      isRemoved: false,
                      density
                    })}
                    onClick={() => onBallClick(rowIndex, ballIndex)}
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

export function GameBoard({
  game,
  selectedRowIndex,
  selectedStartIndex,
  selectedEndIndex,
  canInteract,
  hasPendingMove = false,
  hasTurnCoach = false,
  onBallClick,
  onDiceRoll,
  diceAvailable
}: Props): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const onBallClickRef = useRef(onBallClick);
  const onDiceRollRef = useRef(onDiceRoll);
  const prevRowsRef = useRef<number[][] | null>(null);
  const [renderMode, setRenderMode] = useState<'loading' | 'three' | 'fallback'>('loading');
  const [isRollingDice, setIsRollingDice] = useState(false);

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
    return canInteract ? 'Click/Tap para elegir cantidad en la fila' : 'Esperando tu turno';
  }, [renderMode, canInteract, selectedRowIndex, selectedStartIndex, selectedEndIndex]);

  const turnLimit = game.moveHistory.length + 1;
  const selectedCount =
    selectedRowIndex !== null &&
    selectedStartIndex !== null &&
    selectedEndIndex !== null &&
    selectedEndIndex >= selectedStartIndex
      ? selectedEndIndex - selectedStartIndex + 1
      : 0;
  const remainingSelectionCapacity = Math.max(0, turnLimit - selectedCount);
  const boardHudTitle = selectedCount > 0 ? `Fila ${selectedRowIndex! + 1}` : canInteract ? 'Tu turno' : 'Esperando';
  const boardHudBody = selectedCount > 0
    ? `${selectedCount}/${turnLimit} seleccionadas · restan ${remainingSelectionCapacity}`
    : canInteract
      ? `Hasta ${turnLimit} seguida${turnLimit === 1 ? '' : 's'} en una fila`
      : 'Esperando jugada rival';

  useEffect(() => {
    onBallClickRef.current = onBallClick;
  }, [onBallClick]);

  useEffect(() => {
    onDiceRollRef.current = onDiceRoll;
  }, [onDiceRoll]);

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

  const showDiceAction = !!diceAvailable && canInteract && game.status === 'playing';

  const triggerDiceRoll = useMemo(
    () => async (): Promise<void> => {
      const rollFn = onDiceRollRef.current;
      const context = sceneRef.current;
      if (!rollFn || isRollingDice) return;

      setIsRollingDice(true);
      if (context) {
        context.diceSpinning = true;
        context.diceSpinT = 0;
      }

      try {
        await rollFn();
      } finally {
        window.setTimeout(() => {
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

  useEffect(() => {
    if (!showDiceAction && isRollingDice) {
      setIsRollingDice(false);
    }
  }, [showDiceAction, isRollingDice]);

  useEffect(() => {
    if (renderMode !== 'three') return;
    const context = sceneRef.current;
    if (!context) return;

    if (showDiceAction && !context.diceGroup) {
      const { diceGroup, diceMesh } = createDice3D(context.THREE, context.scene);

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
      context.diceSpinning = false;
      context.diceSpinT = 0;
    } else if (!showDiceAction && context.diceGroup) {
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
        'relative flex flex-1 flex-col bg-background-dark dark:bg-dark-bg min-h-0 transition-[padding] duration-200',
        boardBottomInsetClass
      ].join(' ')}
    >
      {renderMode === 'fallback' ? (
        <LegacyBoardGrid
          game={game}
          selectedRowIndex={selectedRowIndex}
          selectedStartIndex={selectedStartIndex}
          selectedEndIndex={selectedEndIndex}
          canInteract={canInteract}
          onBallClick={onBallClick}
        />
      ) : (
        <div className="relative flex flex-1 flex-col">
          <div
            ref={mountRef}
            className="board-canvas-enter relative min-h-[300px] flex-1 w-full overflow-hidden"
          />
          {renderMode === 'loading' ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-brown/90 dark:text-dark-muted">
              Cargando motor de canicas 3D...
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
              <span
                className={[
                  'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                  selectedCount > 0
                    ? 'bg-primary/15 text-primary'
                    : canInteract
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                ].join(' ')}
              >
                {boardHudTitle}
              </span>
              <span className="rounded-full border border-brown/15 bg-sand/55 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface dark:text-dark-muted">
                max {turnLimit}
              </span>
              {canInteract ? (
                <span className="rounded-full border border-brown/15 bg-sand/55 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#6b5d4f] dark:border-white/10 dark:bg-dark-surface dark:text-dark-muted">
                  {diceAvailable ? 'dado listo' : 'sin dado'}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-snug text-inherit">
              {boardHudBody}
            </p>
            {selectedCount > 0 ? (
              <p className="mt-1 text-[10px] leading-snug text-[#8c7d6b] dark:text-dark-muted">
                Toca fuera del bloque para ampliarlo si sigue contiguo; toca un extremo para recortar.
              </p>
            ) : canInteract ? (
              <p className="mt-1 text-[10px] leading-snug text-[#8c7d6b] dark:text-dark-muted">
                El HUD se actualiza al tocar una fila, así no tienes que bajar para comprobar la selección.
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
              <span className="text-base leading-none" aria-hidden>
                {isRollingDice ? '🎲' : '✨'}
              </span>
              <span>{isRollingDice ? 'Lanzando...' : 'Dado x1'}</span>
            </button>
            <p className="rounded-full bg-black/45 px-2.5 py-1 text-right text-[10px] font-semibold leading-tight text-white/80 backdrop-blur">
              {renderMode === 'fallback'
                ? 'Tu navegador usa tablero 2D: el dado sigue disponible aquí.'
                : 'Acceso táctil rápido al dado especial.'}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

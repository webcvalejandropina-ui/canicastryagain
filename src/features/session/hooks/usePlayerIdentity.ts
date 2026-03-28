'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'canicas-try-again-player-session-v1';
const LEGACY_STORAGE_KEYS = ['bolitas-player-session-v2'];

type StoredSession = {
  playerId: string;
  playerName: string;
  isAdmin?: boolean;
};

export function usePlayerIdentity(): {
  ready: boolean;
  playerId: string;
  playerName: string;
  isAdmin: boolean;
  setPlayerName: (name: string) => void;
  persistPlayer: (name: string) => void;
  loginWithServer: (playerId: string, alias: string, isAdmin: boolean) => void;
  logout: () => void;
} {
  const [ready, setReady] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const legacyRaw = raw ? null : LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const source = raw ?? legacyRaw;

    if (source) {
      try {
        const parsed = JSON.parse(source) as StoredSession;
        if (parsed.playerId && parsed.playerName) {
          setPlayerId(parsed.playerId);
          setPlayerName(parsed.playerName);
          setIsAdmin(parsed.isAdmin === true);
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              playerId: parsed.playerId,
              playerName: parsed.playerName,
              isAdmin: parsed.isAdmin === true
            } satisfies StoredSession)
          );
          LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
          setReady(true);
          return;
        }
      } catch {
        // Se ignora sesión corrupta
      }
    }

    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    setPlayerId('');
    setPlayerName('');
    setIsAdmin(false);
    setReady(true);
  }, []);

  const persistPlayer = useCallback(
    (name: string): void => {
      const normalized = name.trim().slice(0, 32);
      setPlayerName(normalized);

      if (playerId) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            playerId,
            playerName: normalized,
            isAdmin
          } satisfies StoredSession)
        );
      }
    },
    [playerId, isAdmin]
  );

  const loginWithServer = useCallback((serverPlayerId: string, alias: string, admin: boolean): void => {
    const normalized = alias.trim().slice(0, 32);
    setPlayerId(serverPlayerId);
    setPlayerName(normalized);
    setIsAdmin(admin);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        playerId: serverPlayerId,
        playerName: normalized,
        isAdmin: admin
      } satisfies StoredSession)
    );
  }, []);

  const logout = useCallback((): void => {
    setPlayerId('');
    setPlayerName('');
    setIsAdmin(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    ready,
    playerId,
    playerName,
    isAdmin,
    setPlayerName,
    persistPlayer,
    loginWithServer,
    logout
  };
}

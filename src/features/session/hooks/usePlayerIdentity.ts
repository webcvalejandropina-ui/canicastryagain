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
    let cancelled=false;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),7000);
    void (async()=>{
      let stored:StoredSession|null=null;
      try{stored=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null') as StoredSession|null;}catch{/* Optional cache. */}
      try{
        const response=await fetch('/api/auth/session',{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('Session unavailable');
        const {actor}=await response.json() as {actor:{playerId:string;playerName:string;isAdmin?:boolean}|null};
        stored=actor?{playerId:actor.playerId,playerName:actor.playerName,isAdmin:Boolean(actor.isAdmin)}:null;
      }catch{/* Offline practice can retain its local display identity; all server actions still require a cookie. */}
      finally{clearTimeout(timer);}
      if(cancelled)return;
      setPlayerId(stored?.playerId??'');setPlayerName(stored?.playerName??'');setIsAdmin(Boolean(stored?.isAdmin));
      try{if(stored)localStorage.setItem(STORAGE_KEY,JSON.stringify(stored));else localStorage.removeItem(STORAGE_KEY);LEGACY_STORAGE_KEYS.forEach(key=>localStorage.removeItem(key));}catch{/* Optional storage. */}
      setReady(true);
    })();
    return()=>{cancelled=true;clearTimeout(timer);controller.abort();};
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
    window.dispatchEvent(new Event('canicas-identity'));
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
    void fetch('/api/auth/logout', {method:'POST'}).catch(() => undefined).finally(() => window.dispatchEvent(new Event('canicas-identity')));
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

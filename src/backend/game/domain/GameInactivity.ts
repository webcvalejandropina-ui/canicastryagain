export const GAME_INACTIVITY_MS = 24 * 60 * 60 * 1000;
/** Reads/heartbeats do not extend a table: only a persisted game action does. */
export function isGameInactive(status:string,updatedAt:string,now=Date.now()):boolean {
  const lastAction=Date.parse(updatedAt);
  return status==='playing' && Number.isFinite(lastAction) && now-lastAction>=GAME_INACTIVITY_MS;
}

import { Game } from '@/backend/game/domain/Game';

export interface GameRepository {
  save(game: Game): Promise<void>;
  getById(gameId: string): Promise<Game | null>;
  getByCode(gameCode: string): Promise<Game | null>;
  deleteById(gameId: string): Promise<void>;
  deleteExpiredWaitingGames(cutoffIso: string): Promise<number>;
}

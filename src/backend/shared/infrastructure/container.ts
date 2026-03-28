import { CreateGameUseCase } from '@/backend/game/application/CreateGameUseCase';
import { GetGameUseCase } from '@/backend/game/application/GetGameUseCase';
import { JoinGameUseCase } from '@/backend/game/application/JoinGameUseCase';
import { MakeMoveUseCase } from '@/backend/game/application/MakeMoveUseCase';
import { LeaveGameUseCase } from '@/backend/game/application/LeaveGameUseCase';
import { UseDiceUseCase } from '@/backend/game/application/UseDiceUseCase';
import { SqliteGameRepository } from '@/backend/game/infrastructure/SqliteGameRepository';
import { AdminUseCase } from '@/backend/player/application/AdminUseCase';
import { AuthenticateUseCase } from '@/backend/player/application/AuthenticateUseCase';
import { DeleteAccountUseCase } from '@/backend/player/application/DeleteAccountUseCase';
import { SqlitePlayerRepository } from '@/backend/player/infrastructure/SqlitePlayerRepository';
import { GetRankingsUseCase } from '@/backend/ranking/application/GetRankingsUseCase';
import { SqliteRankingRepository } from '@/backend/ranking/infrastructure/SqliteRankingRepository';

const gameRepository = new SqliteGameRepository();
const rankingRepository = new SqliteRankingRepository();
const playerRepository = new SqlitePlayerRepository();

export const container = {
  createGameUseCase: new CreateGameUseCase(gameRepository),
  joinGameUseCase: new JoinGameUseCase(gameRepository),
  getGameUseCase: new GetGameUseCase(gameRepository),
  makeMoveUseCase: new MakeMoveUseCase(gameRepository, rankingRepository),
  leaveGameUseCase: new LeaveGameUseCase(gameRepository, rankingRepository),
  useDiceUseCase: new UseDiceUseCase(gameRepository, rankingRepository),
  getRankingsUseCase: new GetRankingsUseCase(rankingRepository),
  authenticateUseCase: new AuthenticateUseCase(playerRepository),
  deleteAccountUseCase: new DeleteAccountUseCase(playerRepository),
  adminUseCase: new AdminUseCase(playerRepository)
};

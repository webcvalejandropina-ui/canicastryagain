import { SqlitePlayerRepository } from '@/backend/player/infrastructure/SqlitePlayerRepository';
import { verifyPassword } from '@/backend/player/domain/PasswordHasher';
import { AppError } from '@/backend/shared/domain/AppError';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';

const deleteRankingStatement = sqlite.prepare(
  'DELETE FROM ranking_stats WHERE player_id = ?'
);

export class DeleteAccountUseCase {
  constructor(private readonly playerRepository: SqlitePlayerRepository) {}

  async execute(input: { playerId: string; password: string }): Promise<void> {
    const player = this.playerRepository.findById(input.playerId);
    if (!player) {
      throw new AppError('Cuenta no encontrada', 404, 'ACCOUNT_NOT_FOUND');
    }

    const valid = await verifyPassword(input.password, player.password_hash);
    if (!valid) {
      throw new AppError('Contraseña incorrecta', 401, 'INVALID_PASSWORD');
    }

    deleteRankingStatement.run(input.playerId);
    this.playerRepository.deleteById(input.playerId);
  }
}

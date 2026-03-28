import { SqlitePlayerRepository } from '@/backend/player/infrastructure/SqlitePlayerRepository';
import { hashPassword, verifyPassword } from '@/backend/player/domain/PasswordHasher';
import { AppError } from '@/backend/shared/domain/AppError';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';

function generatePlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `player_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const findRankingByNameStatement = sqlite.prepare(
  'SELECT player_id FROM ranking_stats WHERE player_name = ? COLLATE NOCASE LIMIT 1'
);

const updateRankingPlayerIdStatement = sqlite.prepare(
  'UPDATE ranking_stats SET player_id = @new_id, player_name = @alias WHERE player_id = @old_id'
);

export type AuthResult = {
  playerId: string;
  alias: string;
  isNew: boolean;
  isAdmin: boolean;
};

export class AuthenticateUseCase {
  constructor(private readonly playerRepository: SqlitePlayerRepository) {}

  async execute(input: { alias: string; password: string }): Promise<AuthResult> {
    const alias = input.alias.trim().slice(0, 32);
    if (!alias) {
      throw new AppError('El alias es obligatorio', 400, 'ALIAS_REQUIRED');
    }

    const password = input.password;
    if (!password || password.length < 4) {
      throw new AppError('La contraseña debe tener al menos 4 caracteres', 400, 'PASSWORD_TOO_SHORT');
    }

    const existing = this.playerRepository.findByAlias(alias);

    if (existing) {
      if (existing.password_reset === 1) {
        const newHash = await hashPassword(password);
        this.playerRepository.updatePasswordHash(existing.id, newHash);
      } else {
        const valid = await verifyPassword(password, existing.password_hash);
        if (!valid) {
          throw new AppError('Contraseña incorrecta', 401, 'INVALID_PASSWORD');
        }
      }

      const isAdmin = this.syncAdminFlag(existing.id, alias);
      return { playerId: existing.id, alias: existing.alias, isNew: false, isAdmin };
    }

    const playerId = generatePlayerId();
    const passwordHash = await hashPassword(password);
    this.playerRepository.create(playerId, alias, passwordHash);

    this.linkExistingRanking(playerId, alias);

    const isAdmin = this.syncAdminFlag(playerId, alias);
    return { playerId, alias, isNew: true, isAdmin };
  }

  private syncAdminFlag(playerId: string, alias: string): boolean {
    const adminAlias = process.env.ADMIN_ALIAS?.trim();
    if (adminAlias && adminAlias.toLowerCase() === alias.toLowerCase()) {
      this.playerRepository.setAdmin(playerId, true);
      return true;
    }
    const player = this.playerRepository.findById(playerId);
    return player?.is_admin === 1;
  }

  private linkExistingRanking(newPlayerId: string, alias: string): void {
    const row = findRankingByNameStatement.get(alias) as { player_id: string } | undefined;
    if (row && row.player_id !== newPlayerId) {
      updateRankingPlayerIdStatement.run({
        new_id: newPlayerId,
        alias,
        old_id: row.player_id
      });
    }
  }
}

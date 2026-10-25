import { decodeBirthday, type Birthday } from '@/shared/birthday';
import { playerProfileSchema, type PlayerProfileInput } from '@/features/session/profile';
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
  birthday: Birthday | null;
  age: number | null;
  locality: string | null;
};

export class AuthenticateUseCase {
  constructor(private readonly playerRepository: SqlitePlayerRepository) {}

  async execute(input: { alias: string; password: string } & PlayerProfileInput): Promise<AuthResult> {
    const profile = playerProfileSchema.parse(input);
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
      const valid = await verifyPassword(password, existing.password_hash);
      if (!valid) throw new AppError('Contraseña incorrecta',401,'INVALID_PASSWORD');

      if (profile.age !== undefined || profile.locality !== undefined || profile.birthday !== undefined) this.playerRepository.updateProfile(existing.id, profile);
      const isAdmin = this.syncAdminFlag(existing.id);
      return { playerId: existing.id, alias: existing.alias, isNew: false, isAdmin, birthday:profile.birthday===undefined?decodeBirthday(existing.birthday):profile.birthday, age:profile.age??existing.age, locality:profile.locality??existing.locality };
    }

    if(password.length<8)throw new AppError('Para una cuenta nueva utiliza al menos 8 caracteres.',400,'PASSWORD_TOO_SHORT');
    const playerId = generatePlayerId();
    const passwordHash = await hashPassword(password);
    this.playerRepository.create(playerId, alias, passwordHash, profile);

    this.linkExistingRanking(playerId, alias);

    const isAdmin = this.syncAdminFlag(playerId);
    return { playerId, alias, isNew: true, isAdmin, birthday:profile.birthday??null, age:profile.age??null, locality:profile.locality??null };
  }

  private syncAdminFlag(playerId: string): boolean {
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

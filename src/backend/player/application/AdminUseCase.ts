import { randomBytes } from 'node:crypto';
import { hashPassword } from '../domain/PasswordHasher';
import { SqlitePlayerRepository } from '@/backend/player/infrastructure/SqlitePlayerRepository';
import { AppError } from '@/backend/shared/domain/AppError';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';

const deleteRankingStatement = sqlite.prepare(
  'DELETE FROM ranking_stats WHERE player_id = ?'
);

export type AdminPlayerView = {
  id: string;
  alias: string;
  isAdmin: boolean;
  passwordReset: boolean;
  createdAt: string;
};

export class AdminUseCase {
  constructor(private readonly playerRepository: SqlitePlayerRepository) {}

  private assertAdmin(adminId: string): void {
    const admin = this.playerRepository.findById(adminId);
    if (!admin || admin.is_admin !== 1) {
      throw new AppError('No tienes permisos de administrador', 403, 'FORBIDDEN');
    }
  }

  listUsers(adminId: string): AdminPlayerView[] {
    this.assertAdmin(adminId);

    return this.playerRepository.findAll().map((row) => ({
      id: row.id,
      alias: row.alias,
      isAdmin: row.is_admin === 1,
      passwordReset: row.password_reset === 1,
      createdAt: row.created_at
    }));
  }

  deleteUser(adminId: string, targetId: string): void {
    this.assertAdmin(adminId);

    if (adminId === targetId) {
      throw new AppError('No puedes eliminar tu propia cuenta de admin', 400, 'CANNOT_DELETE_SELF');
    }

    const target = this.playerRepository.findById(targetId);
    if (!target) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }

    deleteRankingStatement.run(targetId);
    this.playerRepository.deleteById(targetId);
  }

  async resetPassword(adminId: string, targetId: string): Promise<string> {
    this.assertAdmin(adminId);

    const target = this.playerRepository.findById(targetId);
    if (!target) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }

    const temporaryPassword=randomBytes(18).toString('base64url');
    const hashed=await hashPassword(temporaryPassword);
    this.assertAdmin(adminId);
    this.playerRepository.updatePasswordHash(targetId,hashed);
    sqlite.prepare('DELETE FROM appearance_sessions WHERE player_id=?').run(targetId);
    return temporaryPassword;
  }
}

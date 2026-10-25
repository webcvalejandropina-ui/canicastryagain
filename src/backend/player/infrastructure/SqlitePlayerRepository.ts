import { encodeBirthday } from '@/shared/birthday';
import type { PlayerProfileInput } from '@/features/session/profile';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';

export type PlayerRow = {
  id: string;
  alias: string;
  password_hash: string;
  is_admin: number;
  password_reset: number;
  created_at: string;
  birthday: string | null;
  age: number | null;
  locality: string | null;
};

const ALL_COLUMNS = 'id, alias, password_hash, is_admin, password_reset, created_at, age, locality, birthday';

const findByAliasStatement = sqlite.prepare(
  `SELECT ${ALL_COLUMNS} FROM players WHERE alias = ? COLLATE NOCASE LIMIT 1`
);

const findByIdStatement = sqlite.prepare(
  `SELECT ${ALL_COLUMNS} FROM players WHERE id = ? LIMIT 1`
);

const findAllStatement = sqlite.prepare(
  `SELECT ${ALL_COLUMNS} FROM players ORDER BY created_at ASC`
);

const insertStatement = sqlite.prepare(
  'INSERT INTO players (id, alias, password_hash, created_at, age, locality, birthday) VALUES (@id, @alias, @password_hash, @created_at, @age, @locality, @birthday)'
);

const deleteByIdStatement = sqlite.prepare(
  'DELETE FROM players WHERE id = ?'
);

const setAdminStatement = sqlite.prepare(
  'UPDATE players SET is_admin = @flag WHERE id = @id'
);

const setPasswordResetStatement = sqlite.prepare(
  'UPDATE players SET password_reset = @flag WHERE id = @id'
);

const updatePasswordHashStatement = sqlite.prepare(
  'UPDATE players SET password_hash = @hash, password_reset = 0 WHERE id = @id'
);

export class SqlitePlayerRepository {
  findByAlias(alias: string): PlayerRow | null {
    const row = findByAliasStatement.get(alias) as PlayerRow | undefined;
    return row ?? null;
  }

  findById(id: string): PlayerRow | null {
    const row = findByIdStatement.get(id) as PlayerRow | undefined;
    return row ?? null;
  }

  findAll(): PlayerRow[] {
    return findAllStatement.all() as PlayerRow[];
  }

  create(id: string, alias: string, passwordHash: string, profile: PlayerProfileInput = {}): void {
    insertStatement.run({
      id,
      alias,
      password_hash: passwordHash,
      birthday: encodeBirthday(profile.birthday??null),
      age: profile.age ?? null,
      locality: profile.locality ?? null,
      created_at: new Date().toISOString()
    });
  }

  updateProfile(id: string, profile: PlayerProfileInput): void {
    sqlite.prepare('UPDATE players SET age = COALESCE(@age, age), locality = COALESCE(@locality, locality), birthday = CASE WHEN @birthday_set THEN @birthday ELSE birthday END WHERE id = @id')
      .run({id, age:profile.age??null, locality:profile.locality??null,birthday_set:profile.birthday!==undefined?1:0,birthday:encodeBirthday(profile.birthday??null)});
  }

  deleteById(id: string): boolean {
    const result = deleteByIdStatement.run(id);
    return result.changes > 0;
  }

  setAdmin(id: string, flag: boolean): void {
    setAdminStatement.run({ id, flag: flag ? 1 : 0 });
  }

  setPasswordReset(id: string, flag: boolean): void {
    setPasswordResetStatement.run({ id, flag: flag ? 1 : 0 });
  }

  updatePasswordHash(id: string, hash: string): void {
    updatePasswordHashStatement.run({ id, hash });
  }
}

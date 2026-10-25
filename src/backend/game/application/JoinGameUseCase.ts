import { isPrivateInvite } from '@/backend/game/domain/PrivateInvitation';
import { normalizeGameCode } from '@/backend/game/domain/GameCode';
import { GameRepository } from '@/backend/game/domain/GameRepository';
import { GameView, toGameView } from '@/backend/game/application/GameView';
import { decodeInviteToken } from '@/backend/game/application/InviteToken';
import { publishGameUpdated } from '@/backend/game/infrastructure/GameEvents';
import { AppError } from '@/backend/shared/domain/AppError';

const WAITING_GAME_TTL_MS = 5 * 60 * 1000;

function normalizePlayerName(playerName: string): string {
  const normalized = playerName.trim();
  if (!normalized) {
    throw new AppError('El nombre del jugador es obligatorio', 400, 'PLAYER_NAME_REQUIRED');
  }
  return normalized.slice(0, 32);
}

export class JoinGameUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(input: { playerId: string; playerName: string; gameCode?: string; inviteToken?: string }): Promise<GameView> {
    const playerId = input.playerId.trim();
    if (!playerId) {
      throw new AppError('playerId es obligatorio', 400, 'PLAYER_ID_REQUIRED');
    }

    const normalizedInputCode = normalizeGameCode(input.gameCode ?? '');
    const privateLink = isPrivateInvite(input.inviteToken ?? '');
    const decodedToken = input.inviteToken && !privateLink ? decodeInviteToken(input.inviteToken) : null;
    const decodedCode = decodedToken?.code ?? '';

    if (normalizedInputCode && decodedCode && normalizedInputCode !== decodedCode) {
      throw new AppError('El código no coincide con el token compartido', 400, 'INVITE_CODE_MISMATCH');
    }

    const normalizedCode = normalizeGameCode(normalizedInputCode || decodedCode);
    if (!normalizedCode && !privateLink) {
      throw new AppError('Debes indicar un código o token de partida', 400, 'GAME_CODE_REQUIRED');
    }

    const cutoffIso = new Date(Date.now() - WAITING_GAME_TTL_MS).toISOString();
    if (!privateLink) await this.gameRepository.deleteExpiredWaitingGames(cutoffIso);

    const game = privateLink ? await this.gameRepository.getByInviteToken(input.inviteToken!) : await this.gameRepository.getByCode(normalizedCode);
    if (!game) {
      if (privateLink) throw new AppError('Este enlace ha caducado o la mesa se ha cancelado.',410,'INVITE_EXPIRED');
      throw new AppError('Código de partida no encontrado', 404, 'GAME_NOT_FOUND');
    }

    if (decodedToken && decodedToken.version !== game.inviteVersion) {
      throw new AppError('El enlace de invitación ya no es válido', 410, 'INVITE_TOKEN_REVOKED');
    }

    const normalizedPlayer = {
      id: playerId,
      name: normalizePlayerName(input.playerName)
    };

    const isAlreadyInGame = game.getPlayerNumber(playerId) !== null;
    if (isAlreadyInGame) return toGameView(game, playerId);
    // A display name never grants ownership. Only the authenticated member can resume.
    const codeInvitation = normalizedInputCode && normalizedInputCode === game.code;
    game.join(normalizedPlayer, input.inviteToken ?? (codeInvitation ? game.toPrimitives().privateInviteToken ?? undefined : undefined));

    try { await this.gameRepository.save(game); }
    catch (error) {
      if (privateLink && error instanceof AppError && error.code === 'STALE_GAME_STATE') {
        const latest = await this.gameRepository.getById(game.id);
        if (latest?.getPlayerNumber(playerId)) return toGameView(latest, playerId);
        throw new AppError('El enlace ya ha sido utilizado. La mesa tiene rival.',409,'INVITE_ALREADY_USED');
      }
      throw error;
    }
    publishGameUpdated(game.id, 'join', game);

    return toGameView(game, playerId);
  }
}

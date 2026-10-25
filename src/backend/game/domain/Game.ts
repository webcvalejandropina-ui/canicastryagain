import { MIN_ROWS, MAX_ROWS, validRowCount } from '@/shared/gameConfig';
import { DICE_POWER_NAMES, targetPowerCells, type DiceTarget } from './DicePowers';
import { createPrivateInvite, matchesPrivateInvite, PRIVATE_INVITE_TTL_MS } from './PrivateInvitation';
import { resolveAncientShot, type AncientShot } from './AncientShot';
import { AppError } from '@/backend/shared/domain/AppError';
import { DicePowerName, DiceResult, GamePrimitives, Move, PlayerNumber, PlayerSlot } from '@/backend/game/domain/types';

type CreateGameInput = {
  privateInvitation?: boolean;
  id: string;
  code: string;
  numRows: number;
  creator: PlayerSlot;
};

type MakeMoveInput = {
  playerId: string;
  rowIndex: number;
  startIndex: number;
  removeCount: number;
};

function normalizeComparableName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function toTurnLimit(moveCount: number): number {
  return moveCount + 1;
}

function nowIsoDate(): string {
  return new Date().toISOString();
}

export class Game {
  private state: GamePrimitives;

  private constructor(state: GamePrimitives) {
    this.state = {
      ...state,
      rows: [...state.rows],
      moveHistory: [...state.moveHistory],
      player1: state.player1 ? { ...state.player1 } : null,
      player2: state.player2 ? { ...state.player2 } : null
    };
  }

  static create(input: CreateGameInput): Game {
    if (!validRowCount(input.numRows)) {
      throw new AppError(`Elige un número entero de filas entre ${MIN_ROWS} y ${MAX_ROWS}`, 400, 'INVALID_ROW_COUNT');
    }
    const rows = Array.from({ length: input.numRows }, (_, rowIndex) =>
      Array.from({ length: rowIndex + 1 }, () => 1)
    );
    const now = nowIsoDate();

    return new Game({
      id: input.id,
      code: input.code,
      inviteVersion: 1,
      privateInviteToken: input.privateInvitation ? createPrivateInvite() : null,
      privateInviteExpiresAt: input.privateInvitation ? new Date(Date.parse(now)+PRIVATE_INVITE_TTL_MS).toISOString() : null,
      numRows: input.numRows,
      rows,
      status: 'waiting',
      currentTurn: 1,
      forcedRowIndex: null,
      turnDieValue: null,
      lastTouchedRowIndex: null,
      winner: null,
      player1: { ...input.creator },
      player2: null,
      player1DiceUsed: false,
      player2DiceUsed: false,
      moveHistory: [],
      createdAt: now,
      updatedAt: now
    });
  }

  static rehydrate(state: GamePrimitives): Game {
    return new Game(state);
  }

  get revision(): number {
    return this.state.revision ?? 0;
  }

  markPersisted(): void {
    this.state.revision = this.revision + 1;
  }

  get id(): string {
    return this.state.id;
  }

  get code(): string {
    return this.state.code;
  }

  get status(): GamePrimitives['status'] {
    return this.state.status;
  }

  get inviteVersion(): number {
    return this.state.inviteVersion;
  }

  get player1(): PlayerSlot | null {
    return this.state.player1 ? { ...this.state.player1 } : null;
  }

  get player2(): PlayerSlot | null {
    return this.state.player2 ? { ...this.state.player2 } : null;
  }

  get winner(): PlayerNumber | null {
    return this.state.winner;
  }

  getPlayerNumber(playerId: string): PlayerNumber | null {
    if (this.state.player1?.id === playerId) return 1;
    if (this.state.player2?.id === playerId) return 2;
    return null;
  }

  join(player: PlayerSlot, inviteToken?: string): void {
    if (this.state.player1?.id === player.id || this.state.player2?.id === player.id) {
      return;
    }

    if (this.state.privateInviteToken) {
      if (!inviteToken || !matchesPrivateInvite(this.state.privateInviteToken, inviteToken))
        throw new AppError('Necesitas el enlace privado de esta mesa.',403,'PRIVATE_INVITE_REQUIRED');
      if (this.state.status !== 'waiting')
        throw new AppError('El enlace ya ha sido utilizado. La mesa tiene rival.',409,'INVITE_ALREADY_USED');
      if (!this.state.privateInviteExpiresAt || Date.parse(this.state.privateInviteExpiresAt) <= Date.now())
        throw new AppError('El enlace ha caducado. Pide una nueva partida.',410,'INVITE_EXPIRED');
    }
    if (this.state.status !== 'waiting') {
      throw new AppError('La partida ya está en progreso', 409, 'GAME_ALREADY_STARTED');
    }

    if (!this.state.player1) {
      this.state.player1 = { ...player };
      this.touch();
      return;
    }

    if (!this.state.player2) {
      this.state.player2 = { ...player };
      this.state.status = 'playing';
      this.state.forcedRowIndex = null;
      this.state.turnDieValue = null;
      this.touch();
      return;
    }

    throw new AppError('La partida está llena', 409, 'GAME_FULL');
  }

  reconnectPlayerByName(player: PlayerSlot): boolean {
    const comparableName = normalizeComparableName(player.name);
    if (!comparableName) {
      return false;
    }

    if (this.state.player1 && normalizeComparableName(this.state.player1.name) === comparableName) {
      this.state.player1 = {
        id: player.id,
        name: player.name
      };
      this.touch();
      return true;
    }

    if (this.state.player2 && normalizeComparableName(this.state.player2.name) === comparableName) {
      this.state.player2 = {
        id: player.id,
        name: player.name
      };
      this.touch();
      return true;
    }

    return false;
  }

  makeMove(input: MakeMoveInput): { gameOver: boolean; winner: PlayerNumber | null } {
    if (this.state.pendingTargetPower) throw new AppError('Elige el objetivo de tu poder antes de hacer otra jugada.',409,'DICE_TARGET_PENDING');
    if (this.state.pendingAncientShot) throw new AppError('Completa tu Tirada antigua antes de hacer otra jugada.',409,'ANCIENT_SHOT_PENDING');
    if (this.state.status !== 'playing') {
      throw new AppError('La partida no está en curso', 409, 'GAME_NOT_PLAYING');
    }

    const playerNumber = this.getPlayerNumber(input.playerId);
    if (!playerNumber) {
      throw new AppError('Jugador no pertenece a esta partida', 403, 'PLAYER_NOT_IN_GAME');
    }

    if (this.state.currentTurn !== playerNumber) {
      throw new AppError('No es tu turno', 409, 'NOT_YOUR_TURN');
    }

    this.validateMove(input.rowIndex, input.startIndex, input.removeCount);

    const row = this.state.rows[input.rowIndex];
    for (let offset = 0; offset < input.removeCount; offset += 1) {
      const cellIndex = input.startIndex + offset;
      row[cellIndex] = 0;
    }
    const move: Move = {
      player: playerNumber,
      rowIndex: input.rowIndex,
      startIndex: input.startIndex,
      count: input.removeCount,
      timestamp: nowIsoDate()
    };

    this.state.moveHistory.push(move);

    if (this.finishIfEmpty(playerNumber)) {
      return { gameOver: true, winner: this.state.winner };
    }

    this.state.lastTouchedRowIndex = input.rowIndex;
    this.state.currentTurn = this.state.currentTurn === 1 ? 2 : 1;
    this.state.forcedRowIndex = null;
    this.state.turnDieValue = null;
    this.touch();

    return { gameOver: false, winner: null };
  }

  leave(playerId: string): { winner: PlayerNumber | null; gameWasPlayable: boolean } {
    const playerNumber = this.getPlayerNumber(playerId);
    if (!playerNumber) {
      throw new AppError('Jugador no pertenece a esta partida', 403, 'PLAYER_NOT_IN_GAME');
    }

    if (this.state.status === 'finished') {
      throw new AppError('La partida ya finalizó', 409, 'GAME_ALREADY_FINISHED');
    }

    const gameWasPlayable = this.state.status === 'playing' && Boolean(this.state.player1 && this.state.player2);
    const winner: PlayerNumber | null = gameWasPlayable ? (playerNumber === 1 ? 2 : 1) : null;

    this.state.status = 'finished';
    this.state.pendingAncientShot = false;
    this.state.pendingTargetPower = null;
    this.state.winner = winner;
    this.state.forcedRowIndex = null;
    this.state.turnDieValue = null;
    this.state.inviteVersion += 1;
    this.touch();

    return {
      winner,
      gameWasPlayable
    };
  }

  toPrimitives(): GamePrimitives {
    return {
      ...this.state,
      rows: [...this.state.rows],
      moveHistory: [...this.state.moveHistory],
      player1: this.state.player1 ? { ...this.state.player1 } : null,
      player2: this.state.player2 ? { ...this.state.player2 } : null
    };
  }

  hasDiceAvailable(playerNumber: PlayerNumber): boolean {
    return playerNumber === 1 ? !this.state.player1DiceUsed : !this.state.player2DiceUsed;
  }

  useDice(playerId: string, draw: () => number = Math.random): { gameOver: boolean; winner: PlayerNumber | null; dice: DiceResult } {
    if (this.state.status !== 'playing') {
      throw new AppError('La partida no está en curso', 409, 'GAME_NOT_PLAYING');
    }

    const playerNumber = this.getPlayerNumber(playerId);
    if (!playerNumber) {
      throw new AppError('Jugador no pertenece a esta partida', 403, 'PLAYER_NOT_IN_GAME');
    }

    if (this.state.currentTurn !== playerNumber) {
      throw new AppError('No es tu turno', 409, 'NOT_YOUR_TURN');
    }

    if (!this.hasDiceAvailable(playerNumber)) {
      throw new AppError('Ya usaste tu dado en esta partida', 409, 'DICE_ALREADY_USED');
    }

    if (playerNumber === 1) {
      this.state.player1DiceUsed = true;
    } else {
      this.state.player2DiceUsed = true;
    }

    const powers = DICE_POWER_NAMES;
    const power = powers[Math.floor(draw() * powers.length)];
    if(power==='avalancha'||power==='fantasma') {
      this.state.pendingTargetPower=power;this.touch();
      return {gameOver:false,winner:null,dice:{power,affected:[],pending:true}};
    }
    if(power==='remolino') {
      const shuffledRows:Array<{row:number;order:number[]}>=[],affected:Array<{row:number;col:number}>=[];
      this.state.rows.forEach((row,r)=>{
        if(!row.includes(0)||!row.includes(1))return;
        const order=row.map((_,i)=>i);
        for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
        if(order.every((from,c)=>row[from]===row[c])) {
          const live=row.indexOf(1),hole=row.indexOf(0);[order[live],order[hole]]=[order[hole],order[live]];
        }
        const next=order.map(from=>row[from]);
        next.forEach((value,c)=>{if(value!==row[c])affected.push({row:r,col:c});});
        this.state.rows[r]=next;shuffledRows.push({row:r,order});
      });
      return this.completeDice(playerNumber,{power,affected,shuffledRows});
    }
    if (power === 'antigua') {
      this.state.pendingAncientShot = true;
      this.touch();
      return {gameOver:false,winner:null,dice:{power,affected:[],pending:true}};
    }
    const affected = this.applyDicePower(power);

    return this.completeDice(playerNumber,{power,affected});
  }

  launchAncientShot(playerId:string, shot:AncientShot): {gameOver:boolean;winner:PlayerNumber|null;dice:DiceResult} {
    if(this.state.status!=='playing') throw new AppError('La partida no está en curso',409,'GAME_NOT_PLAYING');
    const player=this.getPlayerNumber(playerId);
    if(!player) throw new AppError('Jugador no pertenece a esta partida',403,'PLAYER_NOT_IN_GAME');
    if(player!==this.state.currentTurn) throw new AppError('No es tu turno',409,'NOT_YOUR_TURN');
    if(!this.state.pendingAncientShot) throw new AppError('El dado no ha activado una Tirada antigua',409,'ANCIENT_SHOT_NOT_PENDING');
    const resolved=resolveAncientShot(this.state.rows,shot);
    for(const cell of resolved.affected)this.state.rows[cell.row][cell.col]=0;
    this.state.pendingAncientShot=false;
    return this.completeDice(player,{power:'antigua',...resolved});
  }

  resolveDiceTarget(playerId:string,target:DiceTarget): {gameOver:boolean;winner:PlayerNumber|null;dice:DiceResult} {
    if(this.state.status!=='playing')throw new AppError('La partida no está en curso',409,'GAME_NOT_PLAYING');
    const player=this.getPlayerNumber(playerId);
    if(!player)throw new AppError('Jugador no pertenece a esta partida',403,'PLAYER_NOT_IN_GAME');
    if(player!==this.state.currentTurn)throw new AppError('No es tu turno',409,'NOT_YOUR_TURN');
    const power=this.state.pendingTargetPower;
    if(!power)throw new AppError('No hay un poder pendiente de objetivo',409,'DICE_TARGET_NOT_PENDING');
    if(!Number.isInteger(target.row)||!Number.isInteger(target.col)||this.state.rows[target.row]?.[target.col]!==1)
      throw new AppError('Elige una canica viva como objetivo.',400,'INVALID_DICE_TARGET');
    const affected=targetPowerCells(this.state.rows,power,target);
    for(const cell of affected)this.state.rows[cell.row][cell.col]=0;
    this.state.pendingTargetPower=null;
    return this.completeDice(player,{power,target:{...target},affected});
  }

  private completeDice(playerNumber:PlayerNumber, dice:DiceResult): {gameOver:boolean;winner:PlayerNumber|null;dice:DiceResult} {
    const first=dice.affected[0];
    this.state.moveHistory.push({player:playerNumber,rowIndex:first?.row??0,startIndex:first?.col??0,
      count:1,timestamp:nowIsoDate(),fromDice:true,dice});
    if(this.finishIfEmpty(playerNumber))return {gameOver:true,winner:this.state.winner,dice};
    this.state.lastTouchedRowIndex=null;
    this.state.currentTurn=this.state.currentTurn===1?2:1;
    this.state.forcedRowIndex=null;
    this.state.turnDieValue=null;
    this.touch();
    return {gameOver:false,winner:null,dice};
  }

  /** A normal move and a power obey the same misère ending. One marble is still playable. */
  private finishIfEmpty(lastPlayer: PlayerNumber): boolean {
    if (this.state.rows.some((row) => row.some((cell) => cell === 1))) {
      return false;
    }
    this.state.status = 'finished';
    this.state.winner = lastPlayer === 1 ? 2 : 1;
    this.touch();
    return true;
  }

  private applyDicePower(power: DicePowerName): Array<{ row: number; col: number }> {
    switch (power) {
      case 'bomba':
        return this.diceBomba();
      case 'rayo':
        return this.diceRayo();
      case 'diagonal':
        return this.diceDiagonal();
      case 'resurreccion':
        return this.diceResurreccion();
      case 'antigua':
      case 'avalancha':
      case 'fantasma':
      case 'remolino':
        return [];
    }
  }

  private diceBomba(): Array<{ row: number; col: number }> {
    const activeRows = this.state.rows
      .map((row, i) => ({ i, active: row.some((c) => c === 1) }))
      .filter((r) => r.active);
    if (activeRows.length === 0) return [];
    const target = activeRows[Math.floor(Math.random() * activeRows.length)].i;
    const affected: Array<{ row: number; col: number }> = [];
    for (let c = 0; c < this.state.rows[target].length; c += 1) {
      if (this.state.rows[target][c] === 1) {
        this.state.rows[target][c] = 0;
        affected.push({ row: target, col: c });
      }
    }
    return affected;
  }

  private diceRayo(): Array<{ row: number; col: number }> {
    const affected: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < this.state.rows.length; r += 1) {
      const activeCols: number[] = [];
      for (let c = 0; c < this.state.rows[r].length; c += 1) {
        if (this.state.rows[r][c] === 1) activeCols.push(c);
      }
      if (activeCols.length > 0) {
        const pick = activeCols[Math.floor(Math.random() * activeCols.length)];
        this.state.rows[r][pick] = 0;
        affected.push({ row: r, col: pick });
      }
    }
    return affected;
  }

  private diceDiagonal(): Array<{ row: number; col: number }> {
    const candidates: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < this.state.rows.length; r += 1) {
      for (let c = 0; c < this.state.rows[r].length; c += 1) {
        if (this.state.rows[r][c] === 1) candidates.push({ row: r, col: c });
      }
    }
    if (candidates.length === 0) return [];
    const origin = candidates[Math.floor(Math.random() * candidates.length)];
    const affected: Array<{ row: number; col: number }> = [];
    const directions = [
      { dr: -1, dc: -1 },
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 }
    ];
    for (const { dr, dc } of directions) {
      let r = origin.row + dr;
      let c = origin.col + dc;
      while (r >= 0 && r < this.state.rows.length && c >= 0 && c < this.state.rows[r].length) {
        if (this.state.rows[r][c] === 1) {
          this.state.rows[r][c] = 0;
          affected.push({ row: r, col: c });
        }
        r += dr;
        c += dc;
      }
    }
    if (this.state.rows[origin.row][origin.col] === 1) {
      this.state.rows[origin.row][origin.col] = 0;
      affected.push({ row: origin.row, col: origin.col });
    }
    return affected;
  }

  private diceResurreccion(): Array<{ row: number; col: number }> {
    const eliminated: Array<{row:number;col:number}> = [];
    this.state.rows.forEach((row,r)=>row.forEach((live,c)=>{
      if(live===0)eliminated.push({row:r,col:c});
    }));
    if(eliminated.length===0)return [];
    // Uniform count from 1 to every eliminated marble, then sample without replacement.
    const count=1+Math.floor(Math.random()*eliminated.length);
    const affected: Array<{row:number;col:number}> = [];
    for(let i=0;i<count;i++) {
      const pick=i+Math.floor(Math.random()*(eliminated.length-i));
      [eliminated[i],eliminated[pick]]=[eliminated[pick],eliminated[i]];
      const cell=eliminated[i];this.state.rows[cell.row][cell.col]=1;affected.push(cell);
    }
    return affected;
  }

  private validateMove(rowIndex: number, startIndex: number, removeCount: number): void {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= this.state.rows.length) {
      throw new AppError('Fila inválida', 400, 'INVALID_ROW');
    }

    if (!Number.isInteger(removeCount) || removeCount < 1) {
      throw new AppError('Debes quitar al menos 1 canica', 400, 'INVALID_REMOVE_COUNT');
    }

    if (!Number.isInteger(startIndex) || startIndex < 0) {
      throw new AppError('Posición inicial inválida', 400, 'INVALID_START_INDEX');
    }

    const turnLimit = toTurnLimit(this.state.moveHistory.length);
    if (removeCount > turnLimit) {
      throw new AppError(
        `En el turno ${turnLimit} solo puedes quitar hasta ${turnLimit} canica${turnLimit > 1 ? 's' : ''}`,
        400,
        'TURN_LIMIT_EXCEEDED'
      );
    }

    const row = this.state.rows[rowIndex];

    if (row.every((cell) => cell === 0)) {
      throw new AppError('La fila ya está vacía', 400, 'EMPTY_ROW');
    }

    if (startIndex >= row.length || startIndex + removeCount > row.length) {
      throw new AppError('Rango fuera de la fila', 400, 'OUT_OF_ROW_RANGE');
    }

    // Todas las canicas seleccionadas deben existir y ser contiguas (sin huecos)
    for (let offset = 0; offset < removeCount; offset += 1) {
      const cellIndex = startIndex + offset;
      if (row[cellIndex] !== 1) {
        throw new AppError('Solo puedes quitar canicas contiguas sin huecos', 400, 'NON_CONTIGUOUS_SELECTION');
      }
    }

  }

  private touch(): void {
    this.state.updatedAt = nowIsoDate();
  }

}

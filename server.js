const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const SOCKET_VERBOSE = process.env.SOCKET_VERBOSE === '1';

function socketLog(...args) {
    if (SOCKET_VERBOSE) {
        console.log(...args);
    }
}

function socketWarn(...args) {
    if (SOCKET_VERBOSE) {
        console.warn(...args);
    }
}

// ============================================
// ESTADO DEL SERVIDOR
// ============================================

const games = new Map(); // gameId -> GameState
const gameCodes = new Map(); // gameCode -> gameId (mapeo de códigos cortos a IDs)
const players = new Map(); // playerId -> PlayerInfo
const rankings = new Map(); // playerName -> { wins, losses, games }

// ============================================
// ESTRUCTURAS DE DATOS
// ============================================

class GameState {
    constructor(gameId, numRows = 7) {
        this.gameId = gameId;
        this.rows = Array.from({ length: numRows }, (_, i) => i + 1);
        this.player1 = null;
        this.player2 = null;
        this.currentTurn = 1;
        this.lastTouchedRowIndex = null;
        this.moveHistory = [];
        this.status = 'waiting'; // waiting, playing, finished
        this.winner = null;
        this.numRows = numRows;
        this.createdAt = Date.now();
    }
    
    addPlayer(playerId, playerName) {
        if (!this.player1) {
            this.player1 = { id: playerId, name: playerName };
            return 1;
        } else if (!this.player2) {
            this.player2 = { id: playerId, name: playerName };
            this.status = 'playing';
            return 2;
        }
        return null;
    }
    
    getPlayerNumber(playerId) {
        if (this.player1 && this.player1.id === playerId) return 1;
        if (this.player2 && this.player2.id === playerId) return 2;
        return null;
    }
    
    isPlayerTurn(playerId) {
        const playerNum = this.getPlayerNumber(playerId);
        return playerNum === this.currentTurn;
    }
}

// ============================================
// LÓGICA DEL JUEGO
// ============================================

function validateMove(game, rowIndex, removeCount) {
    if (rowIndex < 0 || rowIndex >= game.rows.length) {
        return { valid: false, reason: 'Fila inválida' };
    }
    
    if (removeCount < 1) {
        return { valid: false, reason: 'Debes quitar al menos 1 canica' };
    }
    
    if (game.rows[rowIndex] === 0) {
        return { valid: false, reason: 'Esta fila ya está vacía' };
    }
    
    if (removeCount > game.rows[rowIndex]) {
        return { valid: false, reason: 'No hay suficientes canicas en esa fila' };
    }
    
    // Validar restricción de fila bloqueada
    // EXCEPCIÓN: Si es la única canica que queda en todo el tablero, se puede tomar (fin del juego)
    const totalBalls = game.rows.reduce((sum, count) => sum + count, 0);
    const isLastBall = totalBalls === 1 && game.rows[rowIndex] === 1 && removeCount === 1;
    
    if (game.lastTouchedRowIndex === rowIndex && !isLastBall) {
        const remainingAfterMove = game.rows[rowIndex] - removeCount;
        if (remainingAfterMove === 0) {
            return { 
                valid: false, 
                reason: `No puedes vaciar la fila ${rowIndex + 1} porque el rival la tocó en el turno anterior. Debes dejar al menos 1 canica.` 
            };
        }
    }
    
    return { valid: true };
}

function makeMove(game, playerId, rowIndex, removeCount) {
    // Aplicar movimiento
    game.rows[rowIndex] -= removeCount;
    
    // Registrar en historial
    const playerNum = game.getPlayerNumber(playerId);
    game.moveHistory.push({
        player: playerNum,
        rowIndex: rowIndex,
        count: removeCount,
        timestamp: Date.now()
    });
    
    // Verificar condición de derrota (misère)
    const totalBalls = game.rows.reduce((sum, count) => sum + count, 0);
    
    if (totalBalls === 0) {
        // El jugador que hizo el movimiento perdió
        game.status = 'finished';
        game.winner = playerNum === 1 ? 2 : 1;
        updateRankings(game);
        return { gameOver: true, winner: game.winner };
    }
    
    // Actualizar última fila tocada
    game.lastTouchedRowIndex = rowIndex;
    
    // Cambiar turno
    game.currentTurn = game.currentTurn === 1 ? 2 : 1;
    
    return { gameOver: false };
}

function updateRankings(game) {
    if (!game.winner) return;
    
    const winner = game.winner === 1 ? game.player1 : game.player2;
    const loser = game.winner === 1 ? game.player2 : game.player1;
    
    if (winner) {
        const winnerStats = rankings.get(winner.name) || { wins: 0, losses: 0, games: 0 };
        winnerStats.wins++;
        winnerStats.games++;
        rankings.set(winner.name, winnerStats);
    }
    
    if (loser) {
        const loserStats = rankings.get(loser.name) || { wins: 0, losses: 0, games: 0 };
        loserStats.losses++;
        loserStats.games++;
        rankings.set(loser.name, loserStats);
    }
    
    // Guardar rankings en archivo
    saveRankings();
}

function saveRankings() {
    const rankingsData = Array.from(rankings.entries()).map(([name, stats]) => ({
        name,
        ...stats
    }));
    
    fs.writeFileSync(
        path.join(__dirname, 'rankings.json'),
        JSON.stringify(rankingsData, null, 2)
    );
}

function loadRankings() {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'rankings.json'), 'utf8');
        const rankingsData = JSON.parse(data);
        rankingsData.forEach(({ name, ...stats }) => {
            rankings.set(name, stats);
        });
    } catch (err) {
        // Archivo no existe, empezar con rankings vacíos
    }
}

// ============================================
// SERVIDOR HTTP
// ============================================

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(requestUrl.pathname || '/');
    if (pathname === '/') pathname = '/index.html';
    
    const normalizedPath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(__dirname, normalizedPath.replace(/^[/\\]+/, ''));
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// ============================================
// WEBSOCKET SERVER
// ============================================

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const playerId = generatePlayerId();
    let currentGameId = null;
    let playerName = null;
    
    players.set(playerId, { ws, gameId: null, name: null });
    
    socketLog(`Cliente conectado: ${playerId}`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, playerId, data);
        } catch (error) {
            console.error('Error parsing message:', error);
            sendError(ws, 'Mensaje inválido');
        }
    });
    
    ws.on('close', () => {
        socketLog(`Cliente desconectado: ${playerId}`);
        handleDisconnect(playerId);
        players.delete(playerId);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    
    // Enviar estado inicial tras un pequeño retraso para garantizar que el cliente
    // ha registrado su listener on('message') antes de recibir este mensaje.
    // Esto evita una race condition donde el servidor envía antes de que el cliente
    // esté listo para escuchar.
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            send(ws, {
                type: 'connected',
                playerId: playerId,
                rankings: getRankingsArray()
            });
        }
    }, 15);
});

function handleMessage(ws, playerId, data) {
    switch (data.type) {
        case 'joinGame':
            handleJoinGame(ws, playerId, data);
            break;
        case 'createGame':
            handleCreateGame(ws, playerId, data);
            break;
        case 'makeMove':
            handleMakeMove(ws, playerId, data);
            break;
        case 'getRankings':
            send(ws, { type: 'rankings', rankings: getRankingsArray() });
            break;
        default:
            sendError(ws, 'Tipo de mensaje desconocido');
    }
}

function handleCreateGame(ws, playerId, data) {
    const gameId = generateGameId();
    const gameCode = generateGameCode();
    const numRows = Math.max(7, Math.min(12, parseInt(data.numRows) || 7));
    const game = new GameState(gameId, numRows);
    
    const playerName = data.playerName || `Jugador ${playerId.slice(0, 6)}`;
    const playerNum = game.addPlayer(playerId, playerName);
    
    games.set(gameId, game);
    gameCodes.set(gameCode, gameId); // Mapear código a gameId
    
    const player = players.get(playerId);
    if (player) {
        player.gameId = gameId;
        player.name = playerName;
    }
    
    send(ws, {
        type: 'gameCreated',
        gameId: gameId,
        gameCode: gameCode,
        playerNumber: playerNum,
        gameState: getGameStateForPlayer(game, playerId)
    });
    
    socketLog(`Juego ${gameId} (código: ${gameCode}) creado por ${playerName}`);
}

function handleJoinGame(ws, playerId, data) {
    let gameId = data.gameId;
    
    // Si se proporciona un código, buscar el gameId correspondiente
    if (data.gameCode && !gameId) {
        const normalizedCode = String(data.gameCode).trim().toUpperCase();
        gameId = gameCodes.get(normalizedCode);
        if (!gameId) {
            sendError(ws, 'Código de juego no encontrado');
            return;
        }
    }
    
    if (!gameId) {
        sendError(ws, 'ID o código de juego requerido');
        return;
    }
    
    const game = games.get(gameId);
    
    if (!game) {
        sendError(ws, 'Juego no encontrado');
        return;
    }
    
    if (game.status !== 'waiting') {
        sendError(ws, 'El juego ya está en progreso');
        return;
    }
    
    const playerName = data.playerName || `Jugador ${playerId.slice(0, 6)}`;
    const playerNum = game.addPlayer(playerId, playerName);
    
    if (!playerNum) {
        sendError(ws, 'El juego está lleno');
        return;
    }
    
    const player = players.get(playerId);
    if (player) {
        player.gameId = gameId;
        player.name = playerName;
    }
    
    // Notificar a ambos jugadores con su estado personalizado
    const player1Id = game.player1?.id;
    const player2Id = game.player2?.id;
    
    if (player1Id) {
        const player1 = players.get(player1Id);
        if (player1 && player1.ws.readyState === WebSocket.OPEN) {
            send(player1.ws, {
                type: 'gameStarted',
                gameState: getGameStateForPlayer(game, player1Id)
            });
        }
    }
    
    if (player2Id) {
        const player2 = players.get(player2Id);
        if (player2 && player2.ws.readyState === WebSocket.OPEN) {
            send(player2.ws, {
                type: 'gameStarted',
                gameState: getGameStateForPlayer(game, player2Id)
            });
        }
    }
    
    socketLog(`Jugador ${playerName} se unió al juego ${gameId}`);
}

function handleMakeMove(ws, playerId, data) {
    const gameId = data.gameId;
    const game = games.get(gameId);
    
    if (!game) {
        sendError(ws, 'Juego no encontrado');
        return;
    }
    
    if (game.status !== 'playing') {
        sendError(ws, 'El juego no está en progreso');
        return;
    }
    
    if (!game.isPlayerTurn(playerId)) {
        sendError(ws, 'No es tu turno');
        return;
    }
    
    const { rowIndex, removeCount } = data;
    const validation = validateMove(game, rowIndex, removeCount);
    
    if (!validation.valid) {
        sendError(ws, validation.reason);
        return;
    }
    
    const result = makeMove(game, playerId, rowIndex, removeCount);
    
    socketLog(`Jugador ${playerId} hizo movimiento: fila ${rowIndex}, quitar ${removeCount}`);
    socketLog(`Estado del juego después del movimiento:`, {
        rows: game.rows,
        currentTurn: game.currentTurn,
        gameOver: result.gameOver,
        winner: result.winner
    });
    
    // Broadcast a todos los jugadores del juego
    const broadcastData = {
        type: 'moveMade',
        move: {
            player: game.getPlayerNumber(playerId),
            rowIndex,
            removeCount
        },
        gameOver: result.gameOver,
        winner: result.gameOver ? result.winner : null
    };
    
    broadcastToGame(gameId, broadcastData);
    
    if (result.gameOver) {
        // Enviar rankings actualizados inmediatamente
        setTimeout(() => {
            broadcastToGame(gameId, {
                type: 'rankings',
                rankings: getRankingsArray()
            });
        }, 500);
    }
}

function handleDisconnect(playerId) {
    const player = players.get(playerId);
    if (!player || !player.gameId) return;
    
    const game = games.get(player.gameId);
    if (!game) return;
    
    // Notificar al otro jugador
    const otherPlayerId = game.player1?.id === playerId 
        ? game.player2?.id 
        : game.player1?.id;
    
    if (otherPlayerId) {
        const otherPlayer = players.get(otherPlayerId);
        if (otherPlayer && otherPlayer.ws.readyState === WebSocket.OPEN) {
            send(otherPlayer.ws, {
                type: 'opponentDisconnected'
            });
        }
        
        // Permitir que el jugador restante pueda crear/unirse a otra partida
        if (otherPlayer) {
            otherPlayer.gameId = null;
        }
    }
    
    // Limpiar siempre para evitar partidas huérfanas o códigos inválidos colgados.
    cleanupGame(game.gameId);
}

function broadcastToGame(gameId, message) {
    const game = games.get(gameId);
    if (!game) {
        console.error('Juego no encontrado para broadcast:', gameId);
        return;
    }
    
    const playerIds = [game.player1?.id, game.player2?.id].filter(Boolean);
    socketLog(`Broadcasting ${message.type} a ${playerIds.length} jugadores en juego ${gameId}`);
    
    playerIds.forEach(playerId => {
        const player = players.get(playerId);
        if (player && player.ws.readyState === WebSocket.OPEN) {
            // Crear una copia del mensaje para cada jugador
            const playerMessage = { ...message };
            
            // Enviar estado personalizado para cada jugador
            if (playerMessage.type === 'moveMade' || playerMessage.type === 'gameStarted') {
                playerMessage.gameState = getGameStateForPlayer(game, playerId);
            }
            
            socketLog(`Enviando ${playerMessage.type} a jugador ${playerId} (Player ${game.getPlayerNumber(playerId)})`);
            send(player.ws, playerMessage);
        } else {
            socketWarn(`Jugador ${playerId} no está conectado o WebSocket no está abierto`);
        }
    });
}

function getGameStateForPlayer(game, playerId) {
    const playerNum = game.getPlayerNumber(playerId);
    return {
        gameId: game.gameId,
        rows: [...game.rows],
        player1: game.player1 ? { name: game.player1.name } : null,
        player2: game.player2 ? { name: game.player2.name } : null,
        currentTurn: game.currentTurn,
        lastTouchedRowIndex: game.lastTouchedRowIndex,
        moveHistory: [...game.moveHistory],
        status: game.status,
        winner: game.winner,
        numRows: game.numRows,
        yourPlayerNumber: playerNum
    };
}

function getRankingsArray() {
    return Array.from(rankings.entries())
        .map(([name, stats]) => ({
            name,
            wins: stats.wins || 0,
            losses: stats.losses || 0,
            games: stats.games || 0,
            winRate: stats.games > 0 ? ((stats.wins || 0) / stats.games * 100).toFixed(1) : '0.0'
        }))
        .sort((a, b) => {
            // Ordenar por wins primero, luego por winRate
            if (b.wins !== a.wins) return b.wins - a.wins;
            return parseFloat(b.winRate) - parseFloat(a.winRate);
        });
}

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function sendError(ws, message) {
    send(ws, { type: 'error', message });
}

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateGameId() {
    return 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateGameCode() {
    // Generar código corto de 6 caracteres alfanuméricos
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (gameCodes.has(code));
    return code;
}

function cleanupGame(gameId) {
    games.delete(gameId);
    for (const [code, id] of gameCodes.entries()) {
        if (id === gameId) {
            gameCodes.delete(code);
            break;
        }
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

const PORT = process.env.PORT || 3000;

loadRankings();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor HTTP corriendo en http://0.0.0.0:${PORT}`);
    console.log(`WebSocket server listo en ws://0.0.0.0:${PORT}`);
    console.log(`Accede desde: http://localhost:${PORT} o desde la IP de tu máquina`);
});

    // Limpiar juegos antiguos cada hora
setInterval(() => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    
    for (const [gameId, game] of games.entries()) {
        if (now - game.createdAt > maxAge && game.status === 'finished') {
            cleanupGame(gameId);
            socketLog(`Juego ${gameId} eliminado por antigüedad`);
        }
    }
}, 60 * 60 * 1000);

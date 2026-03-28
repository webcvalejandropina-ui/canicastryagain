const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:3000';

function waitForMessageType(ws, expectedTypes, timeout = 5000) {
    const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout esperando mensaje: ${types.join(', ')}`));
        }, timeout);

        const onMessage = (raw) => {
            try {
                const message = JSON.parse(raw);
                if (types.includes(message.type)) {
                    cleanup();
                    resolve(message);
                }
            } catch (error) {
                cleanup();
                reject(error);
            }
        };

        const onError = (error) => {
            cleanup();
            reject(error);
        };

        function cleanup() {
            clearTimeout(timer);
            ws.off('message', onMessage);
            ws.off('error', onError);
        }

        ws.on('message', onMessage);
        ws.on('error', onError);
    });
}

async function testBlockedRow() {
    let player1 = null;
    let player2 = null;
    let gameCode = null;
    let gameState = null;
    
    try {
        console.log('🧪 Probando filas bloqueadas...\n');
        
        // Conectar jugadores
        player1 = await new Promise((resolve, reject) => {
            const ws = new WebSocket(WS_URL);
            ws.on('error', reject);
            ws.on('open', () => resolve(ws));
        });
        
        player2 = await new Promise((resolve, reject) => {
            const ws = new WebSocket(WS_URL);
            ws.on('error', reject);
            ws.on('open', () => resolve(ws));
        });
        
        // El mensaje "connected" puede llegar en cualquier momento; no es necesario bloquear aquí.
        
        // Crear partida
        const createMsgPromise = waitForMessageType(player1, 'gameCreated');
        player1.send(JSON.stringify({
            type: 'createGame',
            playerName: 'Test1',
            numRows: 7
        }));
        
        const createMsg = await createMsgPromise;
        
        gameCode = createMsg.gameCode;
        console.log('✅ Partida creada:', gameCode);
        
        // Unirse
        const start1Promise = waitForMessageType(player1, 'gameStarted');
        const start2Promise = waitForMessageType(player2, 'gameStarted');
        player2.send(JSON.stringify({
            type: 'joinGame',
            gameCode: gameCode,
            playerName: 'Test2'
        }));
        
        const [start1] = await Promise.all([start1Promise, start2Promise]);
        
        gameState = start1.gameState;
        console.log('✅ Juego iniciado. Filas:', gameState.rows);
        
        // Jugador 1 toca la fila 4 (índice 3), dejando canicas para probar bloqueo.
        const blockedRowIndex = 3;
        console.log('\n📝 Jugador 1 toca fila 4 (índice 3)...');
        const move1ForP1 = waitForMessageType(player1, 'moveMade');
        const move1ForP2 = waitForMessageType(player2, 'moveMade');
        player1.send(JSON.stringify({
            type: 'makeMove',
            gameId: gameState.gameId,
            rowIndex: blockedRowIndex,
            removeCount: 1
        }));
        
        const [move1] = await Promise.all([move1ForP1, move1ForP2]);
        
        gameState = move1.gameState;
        console.log('   Filas después:', gameState.rows);
        console.log('   Última fila tocada:', gameState.lastTouchedRowIndex);
        console.log('   Turno actual:', gameState.currentTurn);
        
        // Jugador 2 intenta vaciar la fila bloqueada (debería fallar)
        console.log('\n🚫 Jugador 2 intenta vaciar fila 4 (bloqueada)...');
        const move2Promise = waitForMessageType(player2, ['error', 'moveMade']);
        player2.send(JSON.stringify({
            type: 'makeMove',
            gameId: gameState.gameId,
            rowIndex: blockedRowIndex,
            removeCount: gameState.rows[blockedRowIndex] // Intentar quitar todas
        }));
        
        const move2 = await move2Promise;
        
        if (move2.type === 'error') {
            console.log('   ✅ Correcto: Movimiento rechazado:', move2.message);
        } else {
            throw new Error('Debería haber sido rechazado al intentar vaciar una fila bloqueada');
        }
        
        // Jugador 2 quita parcialmente (debería funcionar)
        console.log('\n✅ Jugador 2 quita parcialmente de fila 4...');
        if (gameState.rows[blockedRowIndex] > 1) {
            const move3Promise = waitForMessageType(player2, ['moveMade', 'error']);
            player2.send(JSON.stringify({
                type: 'makeMove',
                gameId: gameState.gameId,
                rowIndex: blockedRowIndex,
                removeCount: gameState.rows[blockedRowIndex] - 1 // Dejar 1
            }));
            
            const move3 = await move3Promise;
            
            if (move3.type === 'moveMade') {
                gameState = move3.gameState;
                console.log('   ✅ Correcto: Movimiento aceptado');
                console.log('   Filas después:', gameState.rows);
            } else {
                throw new Error('Debería haber sido aceptado al dejar 1 canica en la fila bloqueada');
            }
        }
        
        console.log('\n✅ Prueba de filas bloqueadas completada');
        
        player1.close();
        player2.close();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (player1) player1.close();
        if (player2) player2.close();
        process.exit(1);
    }
}

testBlockedRow();

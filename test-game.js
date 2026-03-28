const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:3000';

// Simular dos jugadores
let player1 = null;
let player2 = null;
let gameCode = null;
let player1Number = null;
let player2Number = null;
let gameState = null;

function createPlayer(name) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        
        ws.on('open', () => {
            console.log(`✅ ${name} conectado`);
            resolve(ws);
        });
        
        ws.on('error', (error) => {
            console.error(`❌ Error en ${name}:`, error.message);
            reject(error);
        });
    });
}

function waitForMessage(ws, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Timeout esperando mensaje'));
        }, timeout);
        
        ws.once('message', (data) => {
            clearTimeout(timer);
            const message = JSON.parse(data);
            resolve(message);
        });
    });
}

async function playGame() {
    try {
        console.log('🎮 Iniciando partida de prueba...\n');
        
        // Conectar jugador 1
        console.log('1️⃣ Conectando Jugador 1...');
        player1 = await createPlayer('Jugador1');
        const msg1 = await waitForMessage(player1);
        console.log('   Recibido:', msg1.type);
        
        // Conectar jugador 2
        console.log('\n2️⃣ Conectando Jugador 2...');
        player2 = await createPlayer('Jugador2');
        const msg2 = await waitForMessage(player2);
        console.log('   Recibido:', msg2.type);
        
        // Jugador 1 crea partida
        console.log('\n3️⃣ Jugador 1 crea partida...');
        player1.send(JSON.stringify({
            type: 'createGame',
            playerName: 'Jugador1',
            numRows: 7
        }));
        
        const createMsg = await waitForMessage(player1);
        console.log('   Partida creada:', createMsg.type);
        if (createMsg.gameCode) {
            gameCode = createMsg.gameCode;
            player1Number = createMsg.playerNumber;
            console.log('   Código:', gameCode);
            console.log('   Jugador 1 es:', player1Number === 1 ? 'Jugador 1' : 'Jugador 2');
        }
        
        // Jugador 2 se une
        console.log('\n4️⃣ Jugador 2 se une a la partida...');
        player2.send(JSON.stringify({
            type: 'joinGame',
            gameCode: gameCode,
            playerName: 'Jugador2'
        }));
        
        // Esperar que ambos reciban gameStarted
        console.log('   Esperando inicio del juego...');
        const [startMsg1, startMsg2] = await Promise.all([
            waitForMessage(player1, 10000),
            waitForMessage(player2, 10000)
        ]);
        
        console.log('   Jugador 1 recibió:', startMsg1.type);
        console.log('   Jugador 2 recibió:', startMsg2.type);
        
        if (startMsg1.gameState) {
            gameState = startMsg1.gameState;
            player2Number = startMsg2.gameState.yourPlayerNumber;
            console.log('   Jugador 2 es:', player2Number === 1 ? 'Jugador 1' : 'Jugador 2');
            console.log('   Estado inicial:', {
                filas: gameState.rows,
                turno: gameState.currentTurn
            });
        }
        
        // Jugar algunos movimientos
        console.log('\n5️⃣ Iniciando jugadas...\n');
        
        let moveCount = 0;
        const maxMoves = 10; // Limitar movimientos para la prueba
        
        while (moveCount < maxMoves) {
            const currentPlayer = gameState.currentTurn === 1 ? player1 : player2;
            const playerName = gameState.currentTurn === 1 ? 'Jugador1' : 'Jugador2';
            
            // Encontrar una fila con canicas
            let rowIndex = -1;
            for (let i = 0; i < gameState.rows.length; i++) {
                if (gameState.rows[i] > 0) {
                    rowIndex = i;
                    break;
                }
            }
            
            if (rowIndex === -1) {
                console.log('   ⚠️ No hay más canicas, juego terminado');
                break;
            }
            
            // Verificar restricción de fila bloqueada
            let removeCount = 1;
            if (gameState.lastTouchedRowIndex === rowIndex) {
                // Si la fila está bloqueada, dejar al menos 1
                if (gameState.rows[rowIndex] > 1) {
                    removeCount = gameState.rows[rowIndex] - 1;
                } else {
                    // Buscar otra fila
                    for (let i = 0; i < gameState.rows.length; i++) {
                        if (gameState.rows[i] > 0 && i !== rowIndex) {
                            rowIndex = i;
                            removeCount = 1;
                            break;
                        }
                    }
                }
            } else {
                // Puede quitar cualquier cantidad
                removeCount = Math.min(2, gameState.rows[rowIndex]);
            }
            
            console.log(`   ${playerName} (Turno ${gameState.currentTurn}): Quita ${removeCount} de fila ${rowIndex + 1}`);
            
            // Enviar movimiento
            currentPlayer.send(JSON.stringify({
                type: 'makeMove',
                gameId: gameState.gameId,
                rowIndex: rowIndex,
                removeCount: removeCount
            }));
            
            // Esperar respuesta
            const moveMsg = await waitForMessage(currentPlayer, 5000);
            
            if (moveMsg.type === 'error') {
                console.log(`   ❌ Error: ${moveMsg.message}`);
                break;
            }
            
            if (moveMsg.type === 'moveMade') {
                gameState = moveMsg.gameState;
                const totalBalls = gameState.rows.reduce((sum, count) => sum + count, 0);
                console.log(`   ✅ Movimiento realizado. Canicas restantes: ${totalBalls}`);
                
                if (moveMsg.gameOver) {
                    console.log(`\n   🏆 ¡Juego terminado! Ganador: Jugador ${moveMsg.winner}`);
                    break;
                }
                
                moveCount++;
            } else {
                console.log(`   ⚠️ Mensaje inesperado: ${moveMsg.type}`);
            }
            
            // Pequeña pausa entre movimientos
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('\n✅ Partida de prueba completada');
        
        // Cerrar conexiones
        player1.close();
        player2.close();
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error en la prueba:', error.message);
        if (player1) player1.close();
        if (player2) player2.close();
        process.exit(1);
    }
}

// Ejecutar prueba
playGame();

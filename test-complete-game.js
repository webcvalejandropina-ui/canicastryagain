const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:3000';

function waitForMessageType(ws, expectedTypes, timeout = 7000) {
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

async function playCompleteGame() {
    let player1 = null;
    let player2 = null;
    let gameCode = null;
    let gameState = null;
    
    try {
        console.log('🎮 Jugando partida completa hasta el final...\n');
        
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
        
        // El mensaje "connected" puede llegar antes/después del open; no bloqueamos por ese evento.
        
        // Crear partida
        const createMsgPromise = waitForMessageType(player1, 'gameCreated');
        player1.send(JSON.stringify({
            type: 'createGame',
            playerName: 'TestPlayer1',
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
            playerName: 'TestPlayer2'
        }));
        
        const [start1] = await Promise.all([start1Promise, start2Promise]);
        
        gameState = start1.gameState;
        console.log('✅ Juego iniciado');
        console.log('   Filas iniciales:', gameState.rows);
        console.log('   Total canicas:', gameState.rows.reduce((a, b) => a + b, 0));
        
        let moveCount = 0;
        let gameOver = false;
        let winner = null;
        
        // Jugar hasta el final
        while (!gameOver && moveCount < 50) {
            const currentPlayer = gameState.currentTurn === 1 ? player1 : player2;
            const playerName = gameState.currentTurn === 1 ? 'TestPlayer1' : 'TestPlayer2';
            
            // Encontrar fila con canicas
            let rowIndex = -1;
            for (let i = 0; i < gameState.rows.length; i++) {
                if (gameState.rows[i] > 0) {
                    rowIndex = i;
                    break;
                }
            }
            
            if (rowIndex === -1) {
                console.log('   ⚠️ No hay más canicas');
                break;
            }
            
            // Calcular cuántas quitar
            let removeCount = 1;
            const totalBalls = gameState.rows.reduce((a, b) => a + b, 0);
            
            // Si quedan pocas canicas, ser más estratégico
            if (totalBalls <= 3) {
                // Intentar dejar 1 canica para que el oponente la tome
                if (totalBalls > 1) {
                    removeCount = totalBalls - 1;
                } else {
                    removeCount = 1; // Tomar la última (perder)
                }
            } else {
                // Verificar restricción de fila bloqueada
                if (gameState.lastTouchedRowIndex === rowIndex && gameState.rows[rowIndex] > 1) {
                    removeCount = gameState.rows[rowIndex] - 1; // Dejar 1
                } else {
                    removeCount = Math.min(2, gameState.rows[rowIndex]);
                }
            }
            
            console.log(`\n   ${playerName}: Quita ${removeCount} de fila ${rowIndex + 1}`);
            
            const movePromise = waitForMessageType(currentPlayer, ['moveMade', 'error']);
            currentPlayer.send(JSON.stringify({
                type: 'makeMove',
                gameId: gameState.gameId,
                rowIndex: rowIndex,
                removeCount: removeCount
            }));
            
            const moveMsg = await movePromise;
            
            if (moveMsg.type === 'error') {
                console.log(`   ❌ Error: ${moveMsg.message}`);
                // Intentar otra fila
                let retrySuccess = false;
                for (let i = 0; i < gameState.rows.length; i++) {
                    if (gameState.rows[i] > 0 && i !== rowIndex) {
                        const newRowIndex = i;
                        const newRemoveCount = Math.min(1, gameState.rows[i]);
                        const retryPromise = waitForMessageType(currentPlayer, ['moveMade', 'error']);
                        currentPlayer.send(JSON.stringify({
                            type: 'makeMove',
                            gameId: gameState.gameId,
                            rowIndex: newRowIndex,
                            removeCount: newRemoveCount
                        }));
                        const retryMsg = await retryPromise;
                        if (retryMsg.type === 'moveMade') {
                            gameState = retryMsg.gameState;
                            const totalBalls = gameState.rows.reduce((a, b) => a + b, 0);
                            console.log(`   ✅ Reintento exitoso. Canicas restantes: ${totalBalls}`);
                            if (retryMsg.gameOver) {
                                gameOver = true;
                                winner = retryMsg.winner;
                                console.log(`\n   🏆 ¡Juego terminado! Ganador: Jugador ${winner}`);
                            }
                            retrySuccess = true;
                            break;
                        }
                    }
                }
                if (!retrySuccess) {
                    console.log('   ❌ No se pudo hacer el movimiento');
                    break;
                }
                if (gameOver) break;
                moveCount++;
                await new Promise(r => setTimeout(r, 200));
                continue;
            }
            
            if (moveMsg.type === 'moveMade') {
                gameState = moveMsg.gameState;
                const totalBalls = gameState.rows.reduce((a, b) => a + b, 0);
                console.log(`   ✅ Canicas restantes: ${totalBalls}`);
                
                if (moveMsg.gameOver) {
                    gameOver = true;
                    winner = moveMsg.winner;
                    console.log(`\n   🏆 ¡Juego terminado! Ganador: Jugador ${winner}`);
                    console.log(`   ${winner === 1 ? 'TestPlayer1' : 'TestPlayer2'} ganó`);
                    
                    // Esperar ranking
                    setTimeout(async () => {
                        const rankingMsg = await waitForMessageType(player1, 'rankings');
                        if (rankingMsg.type === 'rankings') {
                            console.log('\n   📊 Ranking actualizado:');
                            rankingMsg.rankings.forEach((p, i) => {
                                console.log(`      ${i + 1}. ${p.name}: ${p.wins}W/${p.losses}L (${p.winRate}%)`);
                            });
                        }
                    }, 1000);
                    break;
                }
                
                moveCount++;
            }
            
            await new Promise(r => setTimeout(r, 200));
        }
        
        console.log('\n✅ Partida completa finalizada');
        
        // Verificar ranking
        player1.send(JSON.stringify({ type: 'getRankings' }));
        const rankingMsg = await waitForMessageType(player1, 'rankings');
        
        if (rankingMsg.type === 'rankings') {
            console.log('\n📊 Ranking final:');
            if (rankingMsg.rankings.length > 0) {
                rankingMsg.rankings.forEach((p, i) => {
                    console.log(`   ${i + 1}. ${p.name}: ${p.wins}W/${p.losses}L - ${p.winRate}% win rate`);
                });
            } else {
                console.log('   (Vacío)');
            }
        }
        
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

playCompleteGame();

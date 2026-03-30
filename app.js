// ============================================
// ESTADO DEL JUEGO
// ============================================

const GameState = {
    rows: [],
    originalRows: [], // Filas originales para mostrar canicas eliminadas
    playerTurn: 1,
    lastTouchedRowIndex: null,
    moveHistory: [],
    selectedRowIndex: null,
    selectedCount: 0,
    numRows: 7,
    mode: 'local', // 'local' o 'multiplayer'
    gameId: null,
    gameCode: null, // Código corto de la partida
    playerId: null,
    playerNumber: null,
    playerName: null, // Nombre del usuario logueado
    player1Name: null,
    player2Name: null,
    ws: null,
    connected: false,
    loggedIn: false,
    pendingGameCode: null // Código de juego pendiente después del login
};

// ============================================
// CONSTANTES
// ============================================

const MIN_ROWS = 7;
const MAX_ROWS = 12;
// Usar el mismo host y puerto que la página, o detectar automáticamente
const WS_URL = window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.host}`;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
    setupEventListeners();
    registerServiceWorker();
    setupPWAInstall();
});

function checkLogin() {
    const savedName = localStorage.getItem('playerName');
    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('code');
    
    if (savedName) {
        GameState.playerName = savedName;
        GameState.loggedIn = true;
        showMainInterface();
        
        // Si hay un código en la URL, unirse automáticamente después del login
        if (gameCode) {
            setTimeout(() => {
                joinGameByCode(gameCode);
            }, 1000);
        }
    } else {
        showLoginModal();
        // Guardar el código para usarlo después del login
        if (gameCode) {
            GameState.pendingGameCode = gameCode;
        }
    }
}

function checkGameCodeFromURL() {
    // Esta función ya no es necesaria, se maneja en checkLogin
}

function showLoginModal() {
    const loginModal = document.getElementById('login-modal');
    loginModal.setAttribute('aria-hidden', 'false');
    loginModal.style.display = 'flex';
    document.getElementById('main-container').style.display = 'none';
}

function showMainInterface() {
    const loginModal = document.getElementById('login-modal');
    loginModal.setAttribute('aria-hidden', 'true');
    loginModal.style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
    document.getElementById('logged-user-name').textContent = GameState.playerName;
    initializeGame();
}

function handleLogin() {
    const nameInput = document.getElementById('login-name-input');
    const playerName = nameInput.value.trim();
    
    if (!playerName) {
        showMessage('Por favor ingresa tu nombre');
        return;
    }
    
    GameState.playerName = playerName;
    GameState.loggedIn = true;
    localStorage.setItem('playerName', playerName);
    showMainInterface();
    
    // Si hay un código pendiente o en la URL, unirse automáticamente
    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = GameState.pendingGameCode || urlParams.get('code');
    if (gameCode) {
        setTimeout(() => {
            joinGameByCode(gameCode);
        }, 1000);
        GameState.pendingGameCode = null;
    }
}

function handleLogout() {
    GameState.loggedIn = false;
    GameState.playerName = null;
    localStorage.removeItem('playerName');
    if (GameState.ws) {
        GameState.ws.close();
    }
    showLoginModal();
    // Limpiar URL
    window.history.replaceState({}, document.title, window.location.pathname);
}

function initializeGame() {
    const rowsInput = document.getElementById('rows-input');
    GameState.numRows = parseInt(rowsInput.value) || 7;
    resetGame();
    renderBoard();
    updateUI();
}

function resetGame() {
    GameState.rows = Array.from({ length: GameState.numRows }, (_, i) => i + 1);
    GameState.originalRows = [...GameState.rows]; // Guardar estado original
    GameState.playerTurn = 1;
    GameState.lastTouchedRowIndex = null;
    GameState.moveHistory = [];
    GameState.selectedRowIndex = null;
    GameState.selectedCount = 0;
}

// ============================================
// WEBSOCKET
// ============================================

function connectWebSocket() {
    if (GameState.ws && GameState.ws.readyState === WebSocket.OPEN) {
        return;
    }

    try {
        GameState.ws = new WebSocket(WS_URL);
        
        GameState.ws.onopen = () => {
            console.log('Conectado al servidor');
            GameState.connected = true;
            updateConnectionStatus('Conectado', 'success');
        };
        
        GameState.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Mensaje recibido:', data.type, data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error al parsear mensaje:', error, event.data);
            }
        };
        
        GameState.ws.onerror = (error) => {
            console.error('Error WebSocket:', error);
            updateConnectionStatus('Error de conexión', 'error');
            GameState.connected = false;
        };
        
        GameState.ws.onclose = () => {
            console.log('Desconectado del servidor');
            GameState.connected = false;
            updateConnectionStatus('Desconectado', 'error');
            
            // Intentar reconectar después de 3 segundos
            if (GameState.mode === 'multiplayer') {
                setTimeout(() => {
                    if (GameState.mode === 'multiplayer') {
                        connectWebSocket();
                    }
                }, 3000);
            }
        };
    } catch (error) {
        console.error('Error al conectar:', error);
        showMessage('No se pudo conectar al servidor. Verifica que el servidor esté corriendo.');
        updateConnectionStatus('Error', 'error');
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'connected':
            GameState.playerId = data.playerId;
            // No mostrar ranking automáticamente al conectar, solo cuando se solicite
            break;
            
        case 'gameCreated':
            GameState.gameId = data.gameId;
            GameState.gameCode = data.gameCode;
            GameState.playerNumber = data.playerNumber;
            console.log('Juego creado - Player Number:', data.playerNumber, 'Code:', data.gameCode);
            if (data.gameState) {
                // Inicializar filas originales
                GameState.originalRows = Array.from({ length: data.gameState.numRows }, (_, i) => i + 1);
                updateGameStateFromServer(data.gameState);
                renderBoard();
                updateUI();
            }
            showGameIdModal(data.gameCode, data.gameId);
            break;
            
        case 'gameStarted':
            console.log('Juego iniciado - Estado recibido:', data.gameState);
            // Inicializar filas originales si no están inicializadas
            if (GameState.originalRows.length === 0) {
                GameState.originalRows = Array.from({ length: data.gameState.numRows }, (_, i) => i + 1);
            }
            updateGameStateFromServer(data.gameState);
            renderBoard();
            updateUI();
            showMessage('¡El juego ha comenzado!');
            hideMultiplayerModal();
            break;
            
        case 'moveMade':
            updateGameStateFromServer(data.gameState);
            renderBoard();
            updateUI();
            if (data.gameOver) {
                setTimeout(() => {
                    showGameOverModal(data.winner, GameState.playerNumber);
                    // Mostrar ranking automáticamente al terminar
                    if (GameState.mode === 'multiplayer') {
                        setTimeout(() => {
                            handleViewRankings();
                        }, 1000);
                    }
                }, 500);
            }
            break;
            
        case 'error':
            showMessage(data.message || 'Error del servidor');
            break;
            
        case 'opponentDisconnected':
            showMessage('Tu oponente se desconectó');
            break;
            
        case 'rankings':
            displayRankings(data.rankings);
            break;
    }
}

function updateGameStateFromServer(serverState) {
    // Si es la primera vez o se reinició, guardar el estado original
    if (GameState.originalRows.length === 0 || GameState.originalRows.length !== serverState.numRows) {
        GameState.originalRows = Array.from({ length: serverState.numRows }, (_, i) => i + 1);
    }
    
    GameState.rows = [...serverState.rows];
    GameState.playerTurn = serverState.currentTurn;
    GameState.lastTouchedRowIndex = serverState.lastTouchedRowIndex;
    GameState.moveHistory = [...serverState.moveHistory];
    GameState.numRows = serverState.numRows;
    GameState.playerNumber = serverState.yourPlayerNumber;
    GameState.player1Name = serverState.player1?.name || 'Esperando...';
    GameState.player2Name = serverState.player2?.name || 'Esperando...';
    GameState.selectedRowIndex = null;
    GameState.selectedCount = 0;
    
    console.log('Estado actualizado:', {
        playerNumber: GameState.playerNumber,
        player1Name: GameState.player1Name,
        player2Name: GameState.player2Name,
        currentTurn: GameState.playerTurn
    });
}

function sendWebSocketMessage(data) {
    if (GameState.ws && GameState.ws.readyState === WebSocket.OPEN) {
        try {
            const message = JSON.stringify(data);
            console.log('Enviando mensaje:', data.type, data);
            GameState.ws.send(message);
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            showMessage('Error al enviar mensaje al servidor');
        }
    } else {
        console.warn('WebSocket no está conectado. Estado:', GameState.ws?.readyState);
        showMessage('No hay conexión con el servidor. Intentando reconectar...');
        if (GameState.mode === 'multiplayer') {
            connectWebSocket();
        }
    }
}

function updateConnectionStatus(status, type) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = `connection-status ${type}`;
    }
}

// ============================================
// RENDERIZADO
// ============================================

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    GameState.rows.forEach((count, rowIndex) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.setAttribute('role', 'row');
        row.setAttribute('aria-label', `Fila ${rowIndex + 1} con ${count} canicas`);
        
        if (GameState.selectedRowIndex === rowIndex) {
            row.classList.add('active');
        }
        
        // El candado solo aparece cuando la fila está bloqueada (oponente la tocó)
        const isBlocked = GameState.lastTouchedRowIndex === rowIndex;
        if (isBlocked) {
            row.classList.add('blocked');
            row.setAttribute('aria-label', `Fila ${rowIndex + 1} bloqueada (no puedes vaciar)`);
        }
        
        // Obtener el número original de canicas en esta fila
        const originalCount = GameState.originalRows[rowIndex] || count;
        const removedCount = originalCount - count;
        
        // Renderizar todas las canicas originales
        for (let i = 0; i < originalCount; i++) {
            const ball = document.createElement('div');
            const isRemoved = i >= count; // Las canicas eliminadas están después de 'count'
            
            if (isRemoved) {
                // Bolita eliminada - mostrar en negro
                ball.className = 'ball removed-ball';
                ball.setAttribute('aria-label', `Bolita ${i + 1} eliminada de la fila ${rowIndex + 1}`);
            } else {
                // Bolita activa
                ball.className = 'ball';
                ball.setAttribute('role', 'gridcell');
                ball.setAttribute('tabindex', '0');
                ball.setAttribute('aria-label', `Bolita ${i + 1} de la fila ${rowIndex + 1}`);
                ball.dataset.rowIndex = rowIndex;
                ball.dataset.ballIndex = i;
                
                // Agregar clase de bloqueado si la fila está bloqueada (solo canicas activas)
                if (isBlocked) {
                    ball.classList.add('blocked-ball');
                }
                
                if (i < GameState.selectedCount && GameState.selectedRowIndex === rowIndex) {
                    ball.classList.add('selected');
                }
                
                // Solo permitir interacción si es modo local o es tu turno
                const canInteract = GameState.mode === 'local' || 
                    (GameState.mode === 'multiplayer' && GameState.playerTurn === GameState.playerNumber);
                
                if (canInteract) {
                    ball.addEventListener('click', () => handleBallClick(rowIndex, i));
                    ball.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleBallClick(rowIndex, i);
                        }
                    });
                } else {
                    ball.style.cursor = 'not-allowed';
                    ball.style.opacity = '0.7';
                }
            }
            
            row.appendChild(ball);
        }
        
        board.appendChild(row);
    });
}

function updateUI() {
    // Actualizar información de jugadores
    const playersInfo = document.getElementById('players-info');
    if (GameState.mode === 'multiplayer') {
        playersInfo.style.display = 'flex';
        
        // Actualizar nombres
        document.getElementById('player1-name').textContent = GameState.player1Name || 'Esperando...';
        document.getElementById('player2-name').textContent = GameState.player2Name || 'Esperando...';
        
        // Marcar cuál eres tú
        const player1Card = document.getElementById('player1-card');
        const player2Card = document.getElementById('player2-card');
        const player1Status = document.getElementById('player1-status');
        const player2Status = document.getElementById('player2-status');
        
        if (GameState.playerNumber === 1) {
            player1Card.classList.add('you');
            player1Card.classList.remove('opponent');
            player2Card.classList.add('opponent');
            player2Card.classList.remove('you');
            player1Status.textContent = 'TÚ';
            player2Status.textContent = '';
        } else if (GameState.playerNumber === 2) {
            player2Card.classList.add('you');
            player2Card.classList.remove('opponent');
            player1Card.classList.add('opponent');
            player1Card.classList.remove('you');
            player2Status.textContent = 'TÚ';
            player1Status.textContent = '';
        }
        
        // Marcar quién tiene el turno
        player1Card.classList.remove('active-turn');
        player2Card.classList.remove('active-turn');
        if (GameState.playerTurn === 1) {
            player1Card.classList.add('active-turn');
        } else if (GameState.playerTurn === 2) {
            player2Card.classList.add('active-turn');
        }
    } else {
        playersInfo.style.display = 'none';
    }
    
    // Actualizar turno
    const turnText = document.getElementById('turn-text');
    if (GameState.mode === 'multiplayer') {
        const currentPlayerName = GameState.playerTurn === 1 
            ? GameState.player1Name 
            : GameState.player2Name;
        const isMyTurn = GameState.playerTurn === GameState.playerNumber;
        turnText.textContent = isMyTurn 
            ? `🎯 Tu turno - ${currentPlayerName}` 
            : `⏳ Turno de ${currentPlayerName}`;
        turnText.style.color = isMyTurn ? 'var(--secondary-color)' : 'var(--warning-color)';
        turnText.style.fontWeight = '700';
    } else {
        turnText.textContent = `Turno: Jugador ${GameState.playerTurn}`;
        turnText.style.color = 'var(--primary-color)';
    }
    
    // Actualizar total de canicas
    const totalBalls = GameState.rows.reduce((sum, count) => sum + count, 0);
    const totalBallsElement = document.getElementById('total-balls');
    totalBallsElement.textContent = `Canicas restantes: ${totalBalls}`;
    
    // Actualizar fila bloqueada
    const blockedRowElement = document.getElementById('blocked-row');
    if (GameState.lastTouchedRowIndex !== null) {
        blockedRowElement.textContent = `Fila ${GameState.lastTouchedRowIndex + 1} bloqueada (no vaciar)`;
        blockedRowElement.style.display = 'block';
    } else {
        blockedRowElement.style.display = 'none';
    }
    
    // Actualizar cantidad seleccionada
    const quantityDisplay = document.getElementById('quantity-display');
    quantityDisplay.textContent = GameState.selectedCount;
    
    // Actualizar botones
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const hasSelection = GameState.selectedRowIndex !== null && GameState.selectedCount > 0;
    const canMove = GameState.mode === 'local' || 
        (GameState.mode === 'multiplayer' && GameState.playerTurn === GameState.playerNumber);
    
    confirmBtn.disabled = !hasSelection || !canMove;
    cancelBtn.disabled = !hasSelection;
    
    // Actualizar historial
    updateHistory();
}

function updateHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    if (GameState.moveHistory.length === 0) {
        historyList.innerHTML = '<p style="color: #999; font-style: italic;">No hay jugadas aún</p>';
        return;
    }
    
    GameState.moveHistory.slice().reverse().forEach((move, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        let playerName;
        if (GameState.mode === 'multiplayer') {
            playerName = move.player === 1 ? GameState.player1Name : GameState.player2Name;
        } else {
            playerName = `Jugador ${move.player}`;
        }
        
        item.textContent = `${playerName}: Quitó ${move.count} canica${move.count > 1 ? 's' : ''} de la fila ${move.rowIndex + 1}`;
        historyList.appendChild(item);
    });
}

// ============================================
// INTERACCIÓN
// ============================================

function handleBallClick(rowIndex, ballIndex) {
    if (GameState.mode === 'multiplayer' && GameState.playerTurn !== GameState.playerNumber) {
        return;
    }
    
    if (GameState.selectedRowIndex === null) {
        GameState.selectedRowIndex = rowIndex;
        GameState.selectedCount = 1;
    } else if (GameState.selectedRowIndex === rowIndex) {
        const maxCount = GameState.rows[rowIndex];
        const newCount = ballIndex + 1;
        if (newCount <= maxCount) {
            GameState.selectedCount = newCount;
        }
    } else {
        GameState.selectedRowIndex = rowIndex;
        GameState.selectedCount = 1;
    }
    
    renderBoard();
    updateUI();
}

function handleConfirm() {
    if (GameState.selectedRowIndex === null || GameState.selectedCount === 0) {
        showMessage('Selecciona al menos una canica para quitar');
        return;
    }
    
    if (GameState.mode === 'multiplayer' && GameState.playerTurn !== GameState.playerNumber) {
        showMessage('No es tu turno');
        return;
    }
    
    const isValid = validateMove(GameState.selectedRowIndex, GameState.selectedCount);
    if (!isValid.valid) {
        showMessage(isValid.reason);
        return;
    }
    
    if (GameState.mode === 'multiplayer') {
        sendWebSocketMessage({
            type: 'makeMove',
            gameId: GameState.gameId,
            rowIndex: GameState.selectedRowIndex,
            removeCount: GameState.selectedCount
        });
        // Limpiar selección inmediatamente
        GameState.selectedRowIndex = null;
        GameState.selectedCount = 0;
        renderBoard();
        updateUI();
    } else {
        makeMove(GameState.selectedRowIndex, GameState.selectedCount);
    }
}

function handleCancel() {
    GameState.selectedRowIndex = null;
    GameState.selectedCount = 0;
    renderBoard();
    updateUI();
}

function handleIncrease() {
    if (GameState.selectedRowIndex === null) {
        showMessage('Primero selecciona una fila');
        return;
    }
    
    const maxCount = GameState.rows[GameState.selectedRowIndex];
    if (GameState.selectedCount < maxCount) {
        GameState.selectedCount++;
        renderBoard();
        updateUI();
    }
}

function handleDecrease() {
    if (GameState.selectedRowIndex === null) {
        return;
    }
    
    if (GameState.selectedCount > 1) {
        GameState.selectedCount--;
        renderBoard();
        updateUI();
    }
}

function handleReset() {
    const rowsInput = document.getElementById('rows-input');
    const newRows = parseInt(rowsInput.value) || 7;
    
    if (newRows < MIN_ROWS || newRows > MAX_ROWS) {
        showMessage(`El número de filas debe estar entre ${MIN_ROWS} y ${MAX_ROWS}`);
        rowsInput.value = GameState.numRows;
        return;
    }
    
    GameState.numRows = newRows;
    resetGame();
    renderBoard();
    updateUI();
    hideGameOverModal();
}

// ============================================
// LÓGICA DEL JUEGO
// ============================================

function validateMove(rowIndex, removeCount) {
    if (rowIndex < 0 || rowIndex >= GameState.rows.length) {
        return { valid: false, reason: 'Fila inválida' };
    }
    
    if (removeCount < 1) {
        return { valid: false, reason: 'Debes quitar al menos 1 canica' };
    }
    
    if (removeCount > GameState.rows[rowIndex]) {
        return { valid: false, reason: 'No hay suficientes canicas en esa fila' };
    }
    
    // Excepción de fin de juego: si es literalmente la última canica del tablero,
    // sí puede tomarse aunque la fila esté bloqueada.
    const totalBalls = GameState.rows.reduce((sum, count) => sum + count, 0);
    const isLastBall = totalBalls === 1 && GameState.rows[rowIndex] === 1 && removeCount === 1;
    
    if (GameState.lastTouchedRowIndex === rowIndex && !isLastBall) {
        const remainingAfterMove = GameState.rows[rowIndex] - removeCount;
        if (remainingAfterMove === 0) {
            return { 
                valid: false, 
                reason: `No puedes vaciar la fila ${rowIndex + 1} porque el rival la tocó en el turno anterior. Debes dejar al menos 1 canica.` 
            };
        }
    }
    
    return { valid: true };
}

function makeMove(rowIndex, removeCount) {
    // Animate balls before updating state
    const board = document.getElementById('board');
    if (board && board.children[rowIndex]) {
        const rowEl = board.children[rowIndex];
        const currentCount = GameState.rows[rowIndex];
        // The last `removeCount` balls in the row are the ones being taken
        const ballsToRemove = Array.from(rowEl.children).slice(currentCount - removeCount, currentCount);
        ballsToRemove.forEach(ball => ball.classList.add('removing'));
    }

    // Short delay so animation starts before DOM changes
    setTimeout(() => {
        GameState.rows[rowIndex] -= removeCount;

        GameState.moveHistory.push({
            player: GameState.playerTurn,
            rowIndex: rowIndex,
            count: removeCount
        });

        const totalBalls = GameState.rows.reduce((sum, count) => sum + count, 0);

        if (totalBalls === 0) {
            endGame(GameState.playerTurn, true);
            return;
        }

        GameState.lastTouchedRowIndex = rowIndex;
        GameState.playerTurn = GameState.playerTurn === 1 ? 2 : 1;
        GameState.selectedRowIndex = null;
        GameState.selectedCount = 0;

        renderBoard();
        updateUI();

        // Flash the board subtly on turn change
        const boardEl = document.getElementById('board');
        if (boardEl) {
            boardEl.classList.remove('flash-turn');
            void boardEl.offsetWidth; // force reflow to restart animation
            boardEl.classList.add('flash-turn');
        }
    }, 60);
}

function endGame(losingPlayer, isMisere) {
    const winningPlayer = losingPlayer === 1 ? 2 : 1;
    showGameOverModal(winningPlayer, losingPlayer);
}

function showGameOverModal(winner, yourPlayerNumber) {
    const modal = document.getElementById('game-over-modal');
    const modalMessage = document.getElementById('modal-message');
    
    let message;
    let title = 'Fin del Juego';
    
    if (GameState.mode === 'multiplayer') {
        const winnerName = winner === 1 ? GameState.player1Name : GameState.player2Name;
        const loserName = winner === 1 ? GameState.player2Name : GameState.player1Name;
        
        if (winner === yourPlayerNumber) {
            title = '¡Ganaste! 🏆';
            message = `¡Felicitaciones! ${loserName} tomó la última canica. Has ganado la partida.`;
        } else {
            title = 'Perdiste 😔';
            message = `Lo siento, tomaste la última canica. ${winnerName} ha ganado la partida.`;
        }
    } else {
        title = 'Fin del Juego';
        const loser = winner === 1 ? 2 : 1;
        message = `¡Jugador ${loser} tomó la última canica! Jugador ${winner} gana.`;
    }
    
    document.getElementById('modal-title').textContent = title;
    modalMessage.textContent = message;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
}

function hideGameOverModal() {
    const modal = document.getElementById('game-over-modal');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
}

function showMessage(message) {
    const messageArea = document.getElementById('message-area');
    messageArea.textContent = message;
    messageArea.classList.add('show');
    
    setTimeout(() => {
        messageArea.classList.remove('show');
    }, 3000);
}

// ============================================
// MULTIJUGADOR UI
// ============================================

function toggleMode() {
    if (GameState.mode === 'local') {
        GameState.mode = 'multiplayer';
        document.getElementById('mode-toggle-btn').textContent = 'Modo Multijugador';
        document.getElementById('multiplayer-section').style.display = 'block';
        connectWebSocket();
    } else {
        GameState.mode = 'local';
        document.getElementById('mode-toggle-btn').textContent = 'Modo Local';
        document.getElementById('multiplayer-section').style.display = 'none';
        document.getElementById('rankings-section').style.display = 'none';
        if (GameState.ws) {
            GameState.ws.close();
        }
        resetGame();
        renderBoard();
        updateUI();
    }
}

function showCreateGameForm() {
    document.getElementById('create-game-form').style.display = 'block';
    document.getElementById('game-id-display').style.display = 'none';
    showMultiplayerModal();
}

function joinGameByCode(gameCode) {
    if (!GameState.loggedIn) {
        showMessage('Debes iniciar sesión primero');
        return;
    }
    
    // Asegurar que estamos en modo multijugador
    if (GameState.mode !== 'multiplayer') {
        GameState.mode = 'multiplayer';
        document.getElementById('mode-toggle-btn').textContent = 'Modo Multijugador';
        document.getElementById('multiplayer-section').style.display = 'block';
    }
    
    if (!GameState.connected) {
        connectWebSocket();
        // Esperar a que se conecte
        const checkConnection = setInterval(() => {
            if (GameState.ws && GameState.ws.readyState === WebSocket.OPEN) {
                clearInterval(checkConnection);
                sendWebSocketMessage({
                    type: 'joinGame',
                    gameCode: gameCode,
                    playerName: GameState.playerName
                });
                showMessage('Uniéndose a la partida...');
            }
        }, 100);
        
        // Timeout después de 5 segundos
        setTimeout(() => {
            clearInterval(checkConnection);
            if (!GameState.connected) {
                showMessage('No se pudo conectar al servidor');
            }
        }, 5000);
    } else {
        sendWebSocketMessage({
            type: 'joinGame',
            gameCode: gameCode,
            playerName: GameState.playerName
        });
        showMessage('Uniéndose a la partida...');
    }
}

function showGameIdModal(gameCode, gameId) {
    document.getElementById('create-game-form').style.display = 'none';
    document.getElementById('game-id-display').style.display = 'block';
    
    // Generar URL compartible
    const gameUrl = `${window.location.origin}${window.location.pathname}?code=${gameCode}`;
    document.getElementById('game-url-input').value = gameUrl;
    document.getElementById('game-code-text').textContent = gameCode;
    
    GameState.gameCode = gameCode;
    showMultiplayerModal();
}

function showMultiplayerModal() {
    const modal = document.getElementById('multiplayer-modal');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
}

function hideMultiplayerModal() {
    const modal = document.getElementById('multiplayer-modal');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
}

function handleCreateGame() {
    if (!GameState.loggedIn) {
        showMessage('Debes iniciar sesión primero');
        return;
    }
    
    const numRows = parseInt(document.getElementById('rows-input').value) || 7;
    sendWebSocketMessage({
        type: 'createGame',
        playerName: GameState.playerName,
        numRows: numRows
    });
}

function handleJoinGame() {
    // Esta función ya no se usa, se une automáticamente por código
}

function copyGameUrl() {
    const gameUrlInput = document.getElementById('game-url-input');
    gameUrlInput.select();
    gameUrlInput.setSelectionRange(0, 99999); // Para móviles
    navigator.clipboard.writeText(gameUrlInput.value).then(() => {
        showMessage('URL copiada al portapapeles');
    });
}

function copyGameCode() {
    const gameCodeText = document.getElementById('game-code-text').textContent;
    navigator.clipboard.writeText(gameCodeText).then(() => {
        showMessage('Código copiado al portapapeles');
    });
}

function displayRankings(rankings) {
    const rankingsSection = document.getElementById('rankings-section');
    const rankingsList = document.getElementById('rankings-list');
    
    if (!rankingsSection || !rankingsList) {
        console.error('Elementos de ranking no encontrados');
        return;
    }
    
    if (!rankings || rankings.length === 0) {
        rankingsList.innerHTML = '<p style="color: #999; font-style: italic; padding: 1rem;">No hay rankings aún. ¡Juega partidas para aparecer aquí!</p>';
        rankingsSection.style.display = 'block';
        return;
    }
    
    rankingsList.innerHTML = '';
    
    // Crear tabla de ranking
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '1rem';
    
    // Encabezado
    const header = document.createElement('thead');
    header.innerHTML = `
        <tr style="background: var(--primary-color); color: white;">
            <th style="padding: 0.75rem; text-align: left;">#</th>
            <th style="padding: 0.75rem; text-align: left;">Jugador</th>
            <th style="padding: 0.75rem; text-align: center;">Victorias</th>
            <th style="padding: 0.75rem; text-align: center;">Derrotas</th>
            <th style="padding: 0.75rem; text-align: center;">Partidas</th>
            <th style="padding: 0.75rem; text-align: center;">Win Rate</th>
        </tr>
    `;
    table.appendChild(header);
    
    // Cuerpo
    const tbody = document.createElement('tbody');
    rankings.forEach((player, index) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';
        if (index % 2 === 0) {
            row.style.background = 'var(--bg-color)';
        }
        
        // Resaltar si es el jugador actual
        if (player.name === GameState.playerName) {
            row.style.background = 'rgba(80, 200, 120, 0.2)';
            row.style.fontWeight = '600';
        }
        
        row.innerHTML = `
            <td style="padding: 0.75rem; font-weight: 700; color: var(--primary-color);">${index + 1}</td>
            <td style="padding: 0.75rem;">${player.name}</td>
            <td style="padding: 0.75rem; text-align: center; color: var(--secondary-color); font-weight: 600;">${player.wins}</td>
            <td style="padding: 0.75rem; text-align: center; color: var(--danger-color);">${player.losses}</td>
            <td style="padding: 0.75rem; text-align: center;">${player.games}</td>
            <td style="padding: 0.75rem; text-align: center; font-weight: 600;">${player.winRate}%</td>
        `;
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    rankingsList.appendChild(table);
    rankingsSection.style.display = 'block';
    
    // Scroll suave al ranking
    rankingsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function handleViewRankings() {
    if (GameState.mode === 'multiplayer') {
        if (GameState.ws && GameState.ws.readyState === WebSocket.OPEN) {
            sendWebSocketMessage({ type: 'getRankings' });
        } else {
            showMessage('Conecta al servidor primero');
        }
    } else {
        showMessage('El ranking solo está disponible en modo multijugador');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    document.getElementById('confirm-btn').addEventListener('click', handleConfirm);
    document.getElementById('cancel-btn').addEventListener('click', handleCancel);
    document.getElementById('increase-btn').addEventListener('click', handleIncrease);
    document.getElementById('decrease-btn').addEventListener('click', handleDecrease);
    document.getElementById('reset-btn').addEventListener('click', handleReset);
    document.getElementById('modal-restart-btn').addEventListener('click', () => {
        hideGameOverModal();
        handleReset();
    });
    
    // Login
    document.getElementById('login-submit-btn').addEventListener('click', handleLogin);
    document.getElementById('login-name-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Multijugador
    document.getElementById('mode-toggle-btn').addEventListener('click', toggleMode);
    document.getElementById('create-game-btn').addEventListener('click', showCreateGameForm);
    document.getElementById('view-rankings-btn').addEventListener('click', handleViewRankings);
    document.getElementById('create-game-submit-btn').addEventListener('click', handleCreateGame);
    document.getElementById('copy-game-url-btn').addEventListener('click', copyGameUrl);
    document.getElementById('copy-game-code-btn').addEventListener('click', copyGameCode);
    document.getElementById('close-multiplayer-modal-btn').addEventListener('click', hideMultiplayerModal);
    
    document.getElementById('rows-input').addEventListener('change', () => {
        // No hacer nada hasta que se presione reiniciar
    });
    
    // Navegación por teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !document.getElementById('confirm-btn').disabled) {
            handleConfirm();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    });
}

// ============================================
// PWA - SERVICE WORKER
// ============================================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrado:', registration.scope);
                })
                .catch(error => {
                    console.log('Error al registrar Service Worker:', error);
                });
        });
    }
}

// ============================================
// PWA - INSTALACIÓN
// ============================================

let deferredPrompt;

function setupPWAInstall() {
    const installBtn = document.getElementById('install-btn');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'block';
    });
    
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
            return;
        }
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('Usuario aceptó instalar la PWA');
        } else {
            console.log('Usuario rechazó instalar la PWA');
        }
        
        deferredPrompt = null;
        installBtn.style.display = 'none';
    });
    
    window.addEventListener('appinstalled', () => {
        console.log('PWA instalada');
        deferredPrompt = null;
        installBtn.style.display = 'none';
    });
}

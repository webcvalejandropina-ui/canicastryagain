const WebSocket = require('ws');
const WS_URL = process.env.WS_URL || 'ws://localhost:3100';

async function test() {
    const p1 = new WebSocket(WS_URL);
    await new Promise((res, rej) => { p1.on('open', res); p1.on('error', e => rej(e)); });
    const p2 = new WebSocket(WS_URL);
    await new Promise((res, rej) => { p2.on('open', res); p2.on('error', e => rej(e)); });

    const msg1 = await new Promise((res, rej) => {
        p1.once('message', d => res(JSON.parse(d)));
        setTimeout(() => rej(new Error('timeout p1 connected')), 3000);
    });
    console.log('P1 connected msg:', msg1.type);

    const msg2 = await new Promise((res, rej) => {
        p2.once('message', d => res(JSON.parse(d)));
        setTimeout(() => rej(new Error('timeout p2 connected')), 3000);
    });
    console.log('P2 connected msg:', msg2.type);

    p1.send(JSON.stringify({ type: 'createGame', playerName: 'Alice', numRows: 7 }));
    console.log('P1 createGame sent');

    const cMsg = await new Promise((res, rej) => {
        p1.once('message', d => res(JSON.parse(d)));
        setTimeout(() => rej(new Error('timeout createGame response')), 3000);
    });
    console.log('createGame response:', cMsg.type, cMsg.gameCode || '', 'playerNum:', cMsg.playerNumber || '');

    const gameCode = cMsg.gameCode;

    p2.send(JSON.stringify({ type: 'joinGame', gameCode: gameCode, playerName: 'Bob' }));
    console.log('P2 joinGame sent');

    const [start1, start2] = await Promise.all([
        new Promise((res, rej) => {
            p1.once('message', d => res(JSON.parse(d)));
            setTimeout(() => rej(new Error('timeout gameStarted p1')), 5000);
        }),
        new Promise((res, rej) => {
            p2.once('message', d => res(JSON.parse(d)));
            setTimeout(() => rej(new Error('timeout gameStarted p2')), 5000);
        })
    ]);
    console.log('gameStarted P1:', start1.type, 'status:', start1.gameState?.status);
    console.log('gameStarted P2:', start2.type, 'status:', start2.gameState?.status);
    console.log('✅ WS protocol working correctly');
    process.exit(0);
}

test().catch(e => {
    console.error('❌ WS TEST FAILED:', e.message);
    process.exit(1);
});

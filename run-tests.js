const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = process.env.TEST_PORT || '3100';
const WS_URL = `ws://localhost:${TEST_PORT}`;
const ROOT = __dirname;

const testFiles = [
    'test-game.js',
    'test-blocked.js',
    'test-complete-game.js'
];

function waitForServerReady(serverProcess, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Timeout esperando que el servidor inicie'));
        }, timeoutMs);

        serverProcess.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            process.stdout.write(text);
            if (text.includes('Servidor HTTP corriendo')) {
                clearTimeout(timer);
                resolve();
            }
        });

        serverProcess.stderr.on('data', (chunk) => {
            process.stderr.write(chunk.toString());
        });

        serverProcess.on('exit', (code) => {
            clearTimeout(timer);
            reject(new Error(`El servidor terminó inesperadamente (code ${code})`));
        });
    });
}

function runSingleTest(file) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(ROOT, file)], {
            cwd: ROOT,
            env: { ...process.env, WS_URL },
            stdio: 'inherit'
        });

        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Fallo ${file} con code ${code}`));
            }
        });
    });
}

async function main() {
    const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
        cwd: ROOT,
        env: { ...process.env, PORT: TEST_PORT },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    const shutdown = () => {
        if (!server.killed) {
            server.kill('SIGTERM');
        }
    };

    process.on('SIGINT', () => {
        shutdown();
        process.exit(1);
    });
    process.on('SIGTERM', () => {
        shutdown();
        process.exit(1);
    });

    try {
        await waitForServerReady(server);
        for (const file of testFiles) {
            console.log(`\n▶ Ejecutando ${file} con ${WS_URL}`);
            await runSingleTest(file);
        }
        console.log('\n✅ Todas las pruebas pasaron');
        shutdown();
    } catch (error) {
        console.error(`\n❌ ${error.message}`);
        shutdown();
        process.exit(1);
    }
}

main();

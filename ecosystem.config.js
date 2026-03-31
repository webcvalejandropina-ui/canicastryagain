/**
 * PM2 Ecosystem Configuration
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 logs canicas-try-again
 */
module.exports = {
  apps: [
    {
      name: 'canicas-try-again',
      script: 'server.js',
      cwd: '/home/openclaw_vps/.openclaw/workspace/proyectos/juego-bolitas',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        SQLITE_PATH: '/home/openclaw_vps/.openclaw/workspace/proyectos/juego-bolitas/data/game.db'
      },
      error_file: '/home/openclaw_vps/.openclaw/workspace/logs/canicas-error.log',
      out_file: '/home/openclaw_vps/.openclaw/workspace/logs/canicas-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 4000
    }
  ]
};

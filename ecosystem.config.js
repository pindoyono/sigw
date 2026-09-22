module.exports = {
  apps: [{
    name: 'sigw-production',
    script: 'bun',
    args: 'run start',
    cwd: '/var/www/laravel-app/guruwali/app',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    error_file: '/var/log/pm2/sigw-error.log',
    out_file: '/var/log/pm2/sigw-out.log',
    log_file: '/var/log/pm2/sigw-combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
  }],
};

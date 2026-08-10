/**
 * PM2 process manager config — for VPS deployment.
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [{
    name: 'ecommerce-store',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};

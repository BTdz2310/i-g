module.exports = {
  apps: [
    {
      name: 'insurance-gateway',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      node_args: '--max-old-space-size=512',
      env_file: '.env',
      env_production: {
        NODE_ENV: 'production',
      },
      // restart nếu RAM vượt 400MB
      max_memory_restart: '400M',
      // log
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // graceful shutdown — đợi NestJS drain connections
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};

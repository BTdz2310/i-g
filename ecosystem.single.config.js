module.exports = {
  apps: [
    {
      name: 'insurance-gateway',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=512',
      env_file: '.env',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '400M',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};

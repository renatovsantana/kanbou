module.exports = {
  apps: [
    {
      name: "kanbou",
      script: "dist/index.cjs",
      cwd: "/var/www/kanbou",
      env: {
        NODE_ENV: "production",
        PORT: 5001,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/kanbou/error.log",
      out_file: "/var/log/kanbou/output.log",
      merge_logs: true,
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};

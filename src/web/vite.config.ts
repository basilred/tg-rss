import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      '.ngrok-free.app',
      'localhost',
    ],
    proxy: {
      '/api': 'http://localhost:3000',
      '/bot': 'http://localhost:3000',
    },
  },
});

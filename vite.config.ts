import { resolve } from 'path'

import { defineConfig, Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    AccessLogPlugin()
  ],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    sourcemap: true
  },
})


function AccessLogPlugin(): Plugin {
  return {
    name: 'vite-plugin-access-log',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const now = new Date();
        const timestamp = now.toISOString().replace('T', ' ').split('.')[0];
        const method = req.method || 'UNKNOWN';
        const url = req.url || '';

        console.log(`[Access Log] ${timestamp}  ${method}  ${url}`);

        next();
      });
    },
  };
}
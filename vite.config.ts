import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    plugins: [react()],
    base: isProd ? '/arthur/kline/' : '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    // define: {
    //   __BASE_URL__: JSON.stringify(isProd ? '/arthur_kline/' : '/')
    // }
  }
})
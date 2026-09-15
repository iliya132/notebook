import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        // Keep the browser-facing host so localhost and 127.0.0.1 are both
        // treated as same-origin requests by Spring's CORS protection.
        changeOrigin: false,
      },
    },
  },
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.{ts,tsx}'], setupFiles: './src/test/setup.ts' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', 'react-hook-form', '@hookform/resolvers', 'zod'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-sanitize'],
        },
      },
    },
  },
})

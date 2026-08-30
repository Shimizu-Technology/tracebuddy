import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const buildId = Date.now().toString(36)

// https://vite.dev/config/
export default defineConfig({
  define: {
    __TRACEBUDDY_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    {
      name: 'tracebuddy-service-worker-build-id',
      closeBundle() {
        const serviceWorkerPath = resolve('dist/sw.js')
        const serviceWorker = readFileSync(serviceWorkerPath, 'utf8')
        writeFileSync(serviceWorkerPath, serviceWorker.replaceAll('__TRACEBUDDY_BUILD_ID__', buildId))
      },
    },
  ],
})

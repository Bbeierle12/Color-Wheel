import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    // A machine-wide NODE_ENV=production would make Vitest load React's
    // production build, which has no act(); component tests then throw
    // "React.act is not a function". Pin the test environment explicitly.
    env: { NODE_ENV: 'test' },
  },
})

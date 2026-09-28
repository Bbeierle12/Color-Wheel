import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vercel sets VERCEL_GIT_COMMIT_SHA at build time; error reports carry the
// short form so a stack trace can be matched to the exact build.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? '').slice(0, 7) || 'dev'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_COMMIT__: JSON.stringify(commit),
  },
  build: {
    // Emit source maps without linking them from the bundle: browsers never
    // fetch them, but `npm run logs` can, to turn minified frames in error
    // reports back into source lines.
    sourcemap: 'hidden',
  },
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

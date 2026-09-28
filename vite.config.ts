import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vercel sets VERCEL_GIT_COMMIT_SHA at build time; error reports carry the
// short form so a stack trace can be matched to the exact build.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? '').slice(0, 7) || 'dev'

// Vercel answers 403 for any deployed *.map file, so the hidden source maps
// are emitted as *.map.json instead; `npm run logs` knows to look there.
function renameSourceMaps(): Plugin {
  return {
    name: 'rename-source-maps',
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (!name.endsWith('.map')) continue
        const asset = bundle[name]
        const renamed = `${name}.json`
        asset.fileName = renamed
        bundle[renamed] = asset
        delete bundle[name]
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), renameSourceMaps()],
  define: {
    __APP_COMMIT__: JSON.stringify(commit),
  },
  build: {
    // Emit source maps without linking them from the bundle: browsers never
    // fetch them, but `npm run logs` can (as *.map.json, see above), to turn
    // minified frames in error reports back into source lines.
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

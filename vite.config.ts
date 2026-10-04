import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const commit = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ??
  execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim()

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_SHA__: JSON.stringify(commit.slice(0, 7)),
  },
})

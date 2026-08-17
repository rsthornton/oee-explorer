import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' makes asset URLs relative, so the same build works at a domain
// root, under a GitHub Pages subpath (/oee-explorer/), or from file://.
export default defineConfig({
  plugins: [react()],
  base: './',
})

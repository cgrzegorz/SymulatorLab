import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Ścieżki względne – aplikacja działa zarówno lokalnie, jak i pod /SymulatorLab/ na GitHub Pages
  base: './',
})

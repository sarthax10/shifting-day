import { defineConfig } from 'vite';

// Relative paths, so the built game runs from any folder: GitHub Pages, itch.io or a plain zip.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1800 } });

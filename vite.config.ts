import { defineConfig } from 'vite';
// Relativer Pfad: läuft unter GitHub Pages (/combo-studio/) und eigener Domain gleichermaßen.
export default defineConfig({ base: './', build: { target: 'es2022' } });

import { defineConfig } from 'vite';
// Relativer Pfad: läuft unter eigener Domain und unter /combo-studio/ gleichermaßen.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input: { index: 'index.html', about: 'about.html', impressum: 'impressum.html', datenschutz: 'datenschutz.html' } },
  },
});

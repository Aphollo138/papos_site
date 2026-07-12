import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          rooms: path.resolve(__dirname, 'pages/rooms.html'),
          chat: path.resolve(__dirname, 'pages/chat.html'),
          profile: path.resolve(__dirname, 'pages/profile.html'),
          privacy: path.resolve(__dirname, 'pages/privacy.html'),
          terms: path.resolve(__dirname, 'pages/terms.html'),
          blogIndex: path.resolve(__dirname, 'blog/index.html'),
          blogCategoria: path.resolve(__dirname, 'blog/categoria.html'),
          blogArtigo: path.resolve(__dirname, 'blog/artigo.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const klipyKey =
    env.VITE_KLIPY_API_KEY ||
    env.KLIPY_API_KEY ||
    process.env.VITE_KLIPY_API_KEY ||
    process.env.KLIPY_API_KEY ||
    process.env.KLIPY_APP_KEY ||
    '';
  const giphyKey =
    env.VITE_GIPHY_API_KEY ||
    env.GIPHY_API_KEY ||
    process.env.VITE_GIPHY_API_KEY ||
    process.env.GIPHY_API_KEY ||
    '';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_KLIPY_API_KEY': JSON.stringify(klipyKey),
      'import.meta.env.VITE_GIPHY_API_KEY': JSON.stringify(giphyKey)
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
          about: path.resolve(__dirname, 'pages/about.html'),
          contact: path.resolve(__dirname, 'pages/contact.html'),
          rules: path.resolve(__dirname, 'pages/rules.html'),
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

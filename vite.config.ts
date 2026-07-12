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
        },
      },
    },
    server: {
      
      hmr: process.env.DISABLE_HMR !== 'true',
   
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// base '/admin/': the deployed server serves the dashboard under /admin (the public app owns /).
export default defineConfig({ base: '/admin/', plugins: [react(), tailwindcss()], server: { port: 5173 }, preview: { port: 5173 } });

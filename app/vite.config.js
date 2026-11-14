import { defineConfig } from 'vite';
// Port 5174 so the admin dashboard can keep 5173.
export default defineConfig({ server: { port: 5174, host: true }, preview: { port: 5174 }, build: { target: 'es2020' } });

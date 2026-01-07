import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // This shims 'process.env' for the browser so @google/genai doesn't crash
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY)
    }
  },
  server: {
    port: 3000
  }
});
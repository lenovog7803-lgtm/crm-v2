import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind нужен только графикам Bklit (src/bklit): классы ищутся лишь там, без сброса стилей CRM — см. src/bklit/bklit.css
  plugins: [react(), tailwindcss()],
  resolve: {
    // код Bklit импортирует свои утилиты как "@/lib/utils"
    alias: { '@': fileURLToPath(new URL('./src/bklit', import.meta.url)) },
  },
})

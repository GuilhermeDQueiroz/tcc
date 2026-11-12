import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import {demoAssetsPlugin} from './scripts/demo-assets.mjs'
export default defineConfig(({mode})=>({ plugins: [vue(), tailwindcss(), demoAssetsPlugin(mode)], server: { host: '127.0.0.1', port: 5173, strictPort: true, watch: { ignored: ['**/.local/**','**/banco/**','**/tests/**','**/etl/**','**/scripts/**'] }, ...(mode==='demo'?{}:{proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT || 3003}` }}) } }))

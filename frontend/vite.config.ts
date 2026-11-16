import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', 'COURSE_API_')
  return {
    plugins: [vue()],
    server: {proxy: {'/api': env.COURSE_API_ORIGIN || 'http://127.0.0.1:8080'}}
  }
})

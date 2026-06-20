import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    target: 'es2022',
    lib: {
      entry: {
        'keymap': resolve(__dirname, 'src/index.ts')
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: [],
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
})

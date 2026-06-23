import { defineConfig } from 'vite'
import { resolve } from 'path'
import { minify } from 'terser'

// Vite intentionally skips whitespace minification for `es`-format lib builds
// (it preserves `/*#__PURE__*/` annotations for downstream tree-shaking), so
// `build.minify` / `build.terserOptions` are effectively ignored here. This lib
// has a single export, so there is nothing to tree-shake away — we run terser
// ourselves as a renderChunk plugin to get fully minified, comment-free output.
const terserMinify = () => ({
  name: 'terser-minify',
  // `order: 'post'` so this runs AFTER Vite's esbuild target-lowering pass,
  // which would otherwise re-pretty-print (re-expand) our minified output.
  renderChunk: {
    order: 'post' as const,
    async handler(code: string) {
      const { code: minified, map } = await minify(code, {
        module: true,
        sourceMap: true,
        compress: { passes: 2 },
        mangle: { toplevel: true },
        format: { comments: false },
      })
      // Rollup chains this map back through the earlier passes to the TS source.
      return minified ? { code: minified, map: (map as string) ?? null } : null
    },
  },
})

export default defineConfig({
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        'keymap': resolve(__dirname, 'src/index.ts')
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: [],
      plugins: [terserMinify()],
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
})

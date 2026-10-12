import { defineConfig } from 'vite';

// Served from davidgiang.com/lineage/, so assets must resolve under that path.
// The source files use the global React (classic JSX) and share state via window,
// so we skip the React plugin and compile JSX to React.createElement.
export default defineConfig({
  base: '/lineage/',
  esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' },
  build: { target: 'esnext' }, // main.js uses top-level await
});

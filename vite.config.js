import { defineConfig } from 'vite';

// The source files use the global React (classic JSX) and share state via window,
// so we skip the React plugin and compile JSX to React.createElement.
export default defineConfig({
  esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' },
});

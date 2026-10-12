// Entry point. The ported design files rely on global React and on each other via
// window.*, so expose React first and load the files in dependency order.
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

window.React = React;
window.ReactDOM = ReactDOM;
Object.assign(window, {
  useState: React.useState, useEffect: React.useEffect, useMemo: React.useMemo,
  useRef: React.useRef, useCallback: React.useCallback, useLayoutEffect: React.useLayoutEffect,
});

await import('./icons.jsx');
await import('./store.jsx');
await import('./kinship.jsx');
await import('./layout.jsx');
await import('./exporter.jsx');
await import('./tweaks-panel.jsx');
await import('./Connections.jsx');
await import('./Bubble.jsx');
await import('./Canvas.jsx');
await import('./Minimap.jsx');
await import('./ContextMenu.jsx');
await import('./DetailPanel.jsx');
await import('./Toolbar.jsx');
await import('./Onboarding.jsx');
await import('./App.jsx');

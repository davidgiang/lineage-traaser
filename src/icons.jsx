// Small icon set — simple line glyphs, hand-drawn-ish via stroke caps.

function Icon({ name, size = 16, stroke = 1.5, color = 'currentColor' }) {
  const props = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (name) {
    case 'plus':
      return (<svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
    case 'search':
      return (<svg {...props}><circle cx="11" cy="11" r="6.5" /><line x1="20" y1="20" x2="16" y2="16" /></svg>);
    case 'close':
      return (<svg {...props}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>);
    case 'trash':
      return (<svg {...props}><polyline points="4 7 20 7" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>);
    case 'tree':
      return (<svg {...props}><circle cx="12" cy="5" r="2" /><circle cx="6" cy="14" r="2" /><circle cx="18" cy="14" r="2" /><circle cx="9" cy="20" r="1.6" /><circle cx="15" cy="20" r="1.6" /><path d="M12 7v3M12 10c0 1.5-3 2-6 2M12 10c0 1.5 3 2 6 2M6 16v1c0 1 1 2 3 2M18 16v1c0 1-1 2-3 2" /></svg>);
    case 'fit':
      return (<svg {...props}><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></svg>);
    case 'recenter':
      return (<svg {...props}><circle cx="12" cy="12" r="3" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /></svg>);
    case 'photo':
      return (<svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="1.5" /><path d="M21 17l-5-5-9 8" /></svg>);
    case 'menu-dot':
      return (<svg {...props}><circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></svg>);
    case 'pencil':
      return (<svg {...props}><path d="M14 4l6 6L8 22H2v-6z" /></svg>);
    case 'link':
      return (<svg {...props}><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1-1" /></svg>);
    case 'home':
      return (<svg {...props}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" /></svg>);
    case 'leaf':
      return (<svg {...props}><path d="M5 19c0-8 7-14 15-14 0 8-6 14-14 14a8 8 0 0 1-1 0zM5 19l8-8" /></svg>);
    case 'download':
      return (<svg {...props}><path d="M12 4v11M8 11l4 4 4-4M5 19h14" /></svg>);
    case 'upload':
      return (<svg {...props}><path d="M12 16V5M8 9l4-4 4 4M5 19h14" /></svg>);
    default:
      return null;
  }
}

window.Icon = Icon;

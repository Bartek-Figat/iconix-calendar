// Ready-made looks. Each preset sets --ixc-* tokens for light and dark mode (theme: 'light' | 'dark' | 'auto').
// Pass a name (`preset: 'ocean'`) or your own object with the same shape.
export const PRESETS = {
  zinc: {
    label: 'Zinc', light: { accent: '#2563eb' }, dark: { accent: '#60a5fa' },
  },
  ocean: {
    label: 'Ocean', radius: 12,
    light: { accent: '#0284c7', 'bg-soft': '#f3f9fd', 'bg-muted': '#e6f2fa', border: '#d9e8f3', 'border-strong': '#c4dbec', off: '#eef6fbb3' },
    dark: { accent: '#38bdf8', bg: '#06121c', 'bg-soft': '#0a1a27', 'bg-muted': '#102536', border: '#1a3347', 'border-strong': '#24445c', off: '#0a1a2799', fg: '#e6f1f8', 'fg-soft': '#c3d6e4', muted: '#86a0b4' },
  },
  forest: {
    label: 'Forest', radius: 8,
    light: { accent: '#15803d', 'bg-soft': '#f5faf6', 'bg-muted': '#e8f3eb', border: '#d9e9dd', 'border-strong': '#c2dcc8', off: '#f0f7f2b3' },
    dark: { accent: '#4ade80', bg: '#07110b', 'bg-soft': '#0b1810', 'bg-muted': '#112318', border: '#1b3524', 'border-strong': '#264a33', off: '#0b181099', fg: '#e8f5ec', 'fg-soft': '#c5dccc', muted: '#8aa894' },
  },
  sunset: {
    label: 'Sunset', radius: 14,
    light: { accent: '#ea580c', 'bg-soft': '#fffaf5', 'bg-muted': '#fff0e3', border: '#f7e2cf', 'border-strong': '#efcfb2', off: '#fff4eab3' },
    dark: { accent: '#fb923c', bg: '#140b06', 'bg-soft': '#1c110a', 'bg-muted': '#28180e', border: '#3a2416', 'border-strong': '#52331e', off: '#1c110a99', fg: '#fbefe6', 'fg-soft': '#e6d0c0', muted: '#b39280' },
  },
  grape: {
    label: 'Grape', radius: 16,
    light: { accent: '#7c3aed', 'bg-soft': '#fbf9ff', 'bg-muted': '#f2ecfe', border: '#e7defb', 'border-strong': '#d6c8f6', off: '#f6f1ffb3' },
    dark: { accent: '#a78bfa', bg: '#0c0815', 'bg-soft': '#130d1f', 'bg-muted': '#1c142e', border: '#2c2145', 'border-strong': '#3d2e5e', off: '#130d1f99', fg: '#f1ecfb', 'fg-soft': '#d4cae9', muted: '#9d90b8' },
  },
  rose: {
    label: 'Rose', radius: 14,
    vars: { 'ev-radius': '999px' },
    light: { accent: '#e11d48', 'bg-soft': '#fff8f9', 'bg-muted': '#ffe9ee', border: '#fbdbe2', 'border-strong': '#f5c2ce', off: '#fff1f4b3' },
    dark: { accent: '#fb7185', bg: '#14070a', 'bg-soft': '#1d0c10', 'bg-muted': '#2a1118', border: '#401b25', 'border-strong': '#5a2635', off: '#1d0c1099', fg: '#fbecef', 'fg-soft': '#e6c9d0', muted: '#b38d97' },
  },
  nord: {
    label: 'Nord', radius: 6,
    light: { accent: '#5e81ac', bg: '#fbfcfd', 'bg-soft': '#eceff4', 'bg-muted': '#e5e9f0', border: '#d8dee9', 'border-strong': '#c3cad8', fg: '#2e3440', 'fg-soft': '#3b4252', muted: '#6b7487', off: '#e5e9f080' },
    dark: { accent: '#88c0d0', bg: '#2e3440', 'bg-soft': '#3b4252', 'bg-muted': '#434c5e', border: '#4c566a', 'border-strong': '#5b667d', fg: '#eceff4', 'fg-soft': '#e5e9f0', muted: '#a3abbb', off: '#3b425280' },
  },
  paper: {
    label: 'Paper', radius: 4, font: 'ui-serif, "Iowan Old Style", Georgia, serif',
    light: { accent: '#b45309', bg: '#fffdf8', 'bg-soft': '#faf6ee', 'bg-muted': '#f2ece0', border: '#e8e0cf', 'border-strong': '#d9cdb5', fg: '#292524', 'fg-soft': '#44403c', muted: '#857a6b', off: '#f5f0e5b3' },
    dark: { accent: '#f59e0b', bg: '#1a1714', 'bg-soft': '#211d19', 'bg-muted': '#2b2620', border: '#3a332b', 'border-strong': '#4d443a', fg: '#f5efe6', 'fg-soft': '#ddd3c4', muted: '#a8998a', off: '#211d1999' },
  },
  mono: {
    label: 'Mono', radius: 2, font: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    light: { accent: '#18181b', border: '#d4d4d8', 'border-strong': '#a1a1aa' },
    dark: { accent: '#fafafa', border: '#3f3f46', 'border-strong': '#52525b' },
  },
  brutal: {
    label: 'Brutal', radius: 0,
    vars: { shadow: '6px 6px 0 #09090b' },
    light: { accent: '#facc15', bg: '#fffef5', 'bg-soft': '#fffbe0', 'bg-muted': '#fef3a7', border: '#09090b', 'border-strong': '#09090b', fg: '#09090b', muted: '#3f3f46', off: '#fef9c399' },
    dark: { accent: '#facc15', bg: '#0b0b0b', 'bg-soft': '#141414', 'bg-muted': '#262105', border: '#fafafa', 'border-strong': '#fafafa', fg: '#fafafa', muted: '#d4d4d8', off: '#26210599', shadow: '6px 6px 0 #facc15' },
  },
};

export const EVENT_STYLES = ['soft', 'solid', 'outline', 'stripe', 'pill', 'glass', 'gradient', 'minimal'];

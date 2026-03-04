import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // GRZLY design tokens — CSS variable–driven so both themes work
        // including opacity utilities like bg-hot/10, bg-accent/8, etc.
        bg:           'rgb(var(--bg) / <alpha-value>)',
        surface:      'rgb(var(--surface) / <alpha-value>)',
        'surface-2':  'rgb(var(--surface-2) / <alpha-value>)',
        border:       'rgb(var(--border) / <alpha-value>)',
        'border-hl':  'rgb(var(--border-hl) / <alpha-value>)',
        text:         'rgb(var(--text) / <alpha-value>)',
        'text-dim':   'rgb(var(--text-dim) / <alpha-value>)',
        muted:        'rgb(var(--muted) / <alpha-value>)',
        accent:       'rgb(var(--accent) / <alpha-value>)',
        'accent-dim': 'rgb(var(--accent-dim) / <alpha-value>)',
        hot:          'rgb(var(--hot) / <alpha-value>)',
        swayze:       'rgb(var(--swayze) / <alpha-value>)',
        correct:      'rgb(var(--correct) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
        xl: '14px',
      },
    },
  },
  plugins: [],
}

export default config

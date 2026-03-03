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
        // GRZLY design tokens — matches the HTML prototypes
        bg: '#0a0a0a',
        surface: '#111111',
        'surface-2': '#181818',
        border: '#2a2a2a',
        'border-hl': '#3d3d3d',
        text: '#e8e8e8',
        'text-dim': '#888888',
        muted: '#888888',
        accent: '#c8ff00',
        'accent-dim': '#8ab300',
        hot: '#ff3c3c',
        swayze: '#ff9500',
        correct: '#00e676',
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

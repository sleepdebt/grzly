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
        'surface-2': '#161616',
        border: '#1e1e1e',
        text: '#e8e8e8',
        muted: '#666666',
        accent: '#c8ff00',    // lime — conviction, CTAs, positive signal
        hot: '#ff3b30',       // red — hot drops, incorrect outcomes
        swayze: '#ff9500',    // orange — extended drops
        correct: '#34c759',   // green — correct outcomes
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

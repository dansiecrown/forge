import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        canvas: 'hsl(var(--canvas))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          2: 'hsl(var(--surface-2))',
        },
        border: 'hsl(var(--border))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        brand: 'hsl(var(--brand))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          solid: 'hsl(var(--danger-solid))',
        },
        focus: 'hsl(var(--focus))',
      },
      borderRadius: {
        control: '10px',
        card: '16px',
        modal: '20px',
      },
      boxShadow: {
        subtle:
          '0 1px 2px hsl(var(--shadow-color) / 0.06), 0 12px 28px -16px hsl(var(--shadow-color) / 0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

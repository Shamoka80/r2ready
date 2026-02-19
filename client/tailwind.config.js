import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        // Mobile-first breakpoints
        'mobile': {'max': '767px'},
        'tablet': {'min': '768px', 'max': '1023px'},
        'desktop': {'min': '1024px'},
      },
      colors: {
        // Futuristic Nightfall Theme
        primary: {
          DEFAULT: "#00BFFF", // Neon Blue
          light: "#33CCFF",
          dark: "#0099CC",
          foreground: "#121212",
        },
        secondary: {
          DEFAULT: "#FFFFFF", // White
          light: "#FFFFFF",
          dark: "#F5F5F5",
          foreground: "#121212",
        },
        accent: {
          DEFAULT: "#FFA500", // Electric Orange
          light: "#FFB732",
          dark: "#CC7700",
          foreground: "#121212",
        },
        background: {
          DEFAULT: "#121212", // Charcoal Black
          secondary: "#151515",
          tertiary: "#1A1A1A",
        },
        foreground: {
          DEFAULT: "#F5F5F5", // Brighter Off-White
          muted: "#E0E0E0", // Much lighter grey for better contrast
          secondary: "#EAEAEA",
          readable: "#1A1A1A", // Dark text for light backgrounds
          "muted-readable": "#4A4A4A", // Dark muted for light backgrounds
        },
        glass: {
          DEFAULT: "rgba(255, 255, 255, 0.1)",
          light: "rgba(255, 255, 255, 0.15)",
          dark: "rgba(255, 255, 255, 0.05)",
          border: "rgba(255, 255, 255, 0.2)",
        },
        status: {
          success: "#FFFFFF",
          warning: "#B8860B", // Dark goldenrod - much more readable than yellow
          error: "#DC267F",
        },
        text: {
          "on-light": "#1A1A1A",
          "on-dark": "#F5F5F5",
          "muted-light": "#4A4A4A",
          "muted-dark": "#E0E0E0",
          "warning-readable": "#B8860B",
          "info-readable": "#2563EB",
        },
        // Legacy support
        neutral: {
          light: "#1A1A1A",
          DEFAULT: "#404040",
          dark: "#2C2C2C",
          text: "#EAEAEA",
        },
        utility: {
          white: "#FFFFFF",
          error: "#DC267F",
          success: "#FFFFFF",
          warning: "#FFA500",
          // Added 'jade' to match the intent of changing green to pumpkin orange
          'jade': '#dc4405', 
          'sunglow': '#FFCC33',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Orbitron', 'ui-sans-serif', 'system-ui'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas'],
      },
      backdropBlur: {
        xs: '2px',
        '4xl': '72px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        'glass-hover': '0 16px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        'neon-blue': '0 0 20px rgba(0, 191, 255, 0.6)',
        'neon-green': '0 0 20px rgba(255, 255, 255, 0.6)',
        'neon-orange': '0 0 20px rgba(255, 165, 0, 0.6)',
        '3d': '0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      },
      animation: {
        'holographic': 'holographic 4s ease infinite',
        'loading-pulse': 'loading-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glass-shine': 'glass-shine 2s ease-in-out infinite',
      },
      keyframes: {
        holographic: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'loading-pulse': {
          '0%, 100%': { 
            opacity: '0.5',
            boxShadow: '0 0 20px rgba(0, 191, 255, 0.3)'
          },
          '50%': { 
            opacity: '1',
            boxShadow: '0 0 40px rgba(0, 191, 255, 0.6)'
          },
        },
        'glass-shine': {
          '0%': { transform: 'translateX(-100%) skewX(-15deg)' },
          '100%': { transform: 'translateX(200%) skewX(-15deg)' },
        },
      },
      borderRadius: {
        'glass': '1rem',
        '3xl': '1.5rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'touch': '44px',
        'button': '48px',
        'input': '48px',
      },
      fontSize: {
        'mobile-base': ['16px', '24px'],
        'mobile-lg': ['18px', '28px'],
        'mobile-xl': ['20px', '32px'],
      },
    },
  },
  plugins: [],
};


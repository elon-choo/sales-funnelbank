import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                // Premium Brand Colors
                'deep-space': '#030014',
                'midnight': '#0A0A1B',
                'brand-purple': {
                    50: '#F5F3FF',
                    100: '#EDE9FE',
                    200: '#DDD6FE',
                    300: '#C4B5FD',
                    400: '#A78BFA',
                    500: '#8B5CF6',
                    600: '#7C3AED',
                    700: '#6D28D9',
                    800: '#5B21B6',
                    900: '#4C1D95',
                },
                'brand-pink': {
                    400: '#F472B6',
                    500: '#EC4899',
                    600: '#DB2777',
                },
                'brand-cyan': {
                    400: '#22D3EE',
                    500: '#06B6D4',
                }
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            animation: {
                'float-slow': 'float-slow 8s ease-in-out infinite',
                'float-delayed': 'float-delayed 10s ease-in-out infinite',
                'pulse-slow': 'pulse-slow 4s ease-in-out infinite',
                'shimmer': 'shimmer 3s ease-in-out infinite',
                'gradient-shift': 'gradient-shift 15s ease infinite',
                'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
                'fade-in-down': 'fade-in-down 0.6s ease-out forwards',
                'scale-in': 'scale-in 0.5s ease-out forwards',
                'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
            },
            keyframes: {
                'float-slow': {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '50%': { transform: 'translateY(-20px) rotate(5deg)' },
                },
                'float-delayed': {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '50%': { transform: 'translateY(-15px) rotate(-3deg)' },
                },
                'pulse-slow': {
                    '0%, 100%': { opacity: '0.4' },
                    '50%': { opacity: '0.8' },
                },
                'shimmer': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
                'gradient-shift': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in-down': {
                    '0%': { opacity: '0', transform: 'translateY(-30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.9)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'glow-pulse': {
                    '0%, 100%': { boxShadow: '0 0 40px -10px rgba(124, 58, 237, 0.5)' },
                    '50%': { boxShadow: '0 0 60px -10px rgba(124, 58, 237, 0.8)' },
                },
            },
            boxShadow: {
                'glow-purple': '0 0 40px -10px rgba(124, 58, 237, 0.7)',
                'glow-purple-lg': '0 0 60px -10px rgba(124, 58, 237, 0.9)',
                'glow-pink': '0 0 40px -10px rgba(219, 39, 119, 0.7)',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'mesh-gradient': 'radial-gradient(at 40% 20%, rgba(124,58,237,0.2) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(219,39,119,0.2) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(6,182,212,0.2) 0px, transparent 50%)',
            },
        }
    },
    plugins: [
        require("tailwindcss-animate"),
        require("tailwind-scrollbar"),
    ],
};
export default config;

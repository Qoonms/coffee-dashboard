import type { Config } from 'tailwindcss'

const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    'bg-green-100', 'text-green-700', 'border-green-200',
    'bg-red-100', 'text-red-600', 'border-red-200',
    'bg-yellow-100', 'text-yellow-700', 'border-yellow-200',
    'bg-blue-100', 'text-blue-600', 'border-blue-200',
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
export default config

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        jira: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          primary: '#0052cc',
          hover: '#0747a6',
          success: '#36b37e',
          warning: '#ffab00',
          danger: '#ff5630',
          muted: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
};

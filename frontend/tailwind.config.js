/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cbct-primary': '#2563eb',
        'cbct-secondary': '#7c3aed',
        'cbct-accent': '#06b6d4',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

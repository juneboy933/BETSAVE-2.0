/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2937",
        paper: "#f8f5ef",
        brand: "#234064",
        accent: "#8b6a3e"
      }
    }
  },
  plugins: []
};

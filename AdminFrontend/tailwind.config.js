/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2937",
        paper: "#f8f5ef",
        brand: "#223c5f",
        accent: "#6a4d2f"
      }
    }
  },
  plugins: []
};

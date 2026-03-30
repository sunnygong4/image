import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "Cascadia Mono",
          "Consolas",
          "Lucida Console",
          "Courier New",
          "monospace",
        ],
      },
      colors: {
        ink: "#16181f",
        paper: "#efe9df",
        ember: "#b76a39",
        pine: "#244447",
        dusk: "#5a6471",
      },
      boxShadow: {
        soft: "0 24px 70px rgba(15, 24, 37, 0.14)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.65), transparent 25%), radial-gradient(circle at 80% 0%, rgba(183,106,57,0.2), transparent 25%), radial-gradient(circle at 50% 80%, rgba(36,68,71,0.18), transparent 28%)",
      },
    },
  },
  plugins: [],
};

export default config;


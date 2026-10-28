import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#FBF7EE",
          deep: "#F3ECDC",
        },
        ink: {
          DEFAULT: "#1F3524",
          soft: "#4A5D4E",
          faint: "#7C8B7E",
        },
        forest: {
          DEFAULT: "#2F7D4F",
          deep: "#256B41",
          mist: "#E4EFE6",
        },
        tangerine: {
          DEFAULT: "#F08C2E",
          soft: "#FCE8D2",
        },
        butter: {
          DEFAULT: "#FFD666",
          soft: "#FFF3D1",
        },
        berry: {
          DEFAULT: "#D64550",
          soft: "#FBE3E5",
        },
        sky: {
          DEFAULT: "#6FA8C9",
          soft: "#E3EFF6",
        },
      },
      fontFamily: {
        display: [
          '"LXGW WenKai"',
          '"Kaiti SC"',
          '"STKaiti"',
          '"KaiTi"',
          '"楷体"',
          "Georgia",
          "serif",
        ],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      boxShadow: {
        sticker: "4px 4px 0 0 #1F3524",
        "sticker-sm": "2px 2px 0 0 #1F3524",
        "sticker-lg": "6px 6px 0 0 #1F3524",
        "sticker-ink-soft": "3px 3px 0 0 rgba(31, 53, 36, 0.35)",
      },
      borderRadius: {
        sticker: "1.1rem",
        "sticker-lg": "1.4rem",
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "none" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "70%": { transform: "scale(1.03)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pop-in": "pop-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        wiggle: "wiggle 0.4s ease-in-out infinite",
        floaty: "floaty 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

export default config

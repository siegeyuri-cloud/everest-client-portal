import type { Config } from "tailwindcss";

/**
 * Everest Collective — Client Portal
 * Design tokens for Tailwind. Drop this into your Next.js project root.
 *
 * FONT FAMILIES (supply the font files yourself, see globals.css):
 *   display   → Arkibal Display Bold   (slab serif — headlines, wordmark energy)
 *   condensed → Korolev Compressed      (eyebrows, labels, tags — UPPERCASE, tracked wide)
 *   body      → Montserrat              (all running text + UI)
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ---- Core surfaces (never stark white / pure black) ----
        snow: "#F0EEEC",        // Summit Snow — page background
        paper: "#FFFFFF",       // Snow White — cards
        storm: "#2D3132",       // Stormcloud — dark surfaces / sidebar
        granite: "#000000",     // Black Granite — login + footer
        ink: "#3C4142",         // body text

        // ---- Brand accents ----
        teal: {
          DEFAULT: "#6CCAD0",   // Glacial Lake (primary mark)
          deep: "#4FB4BB",
          75: "#93D5DA",
          50: "#B7E2E5",
          25: "#D9EFF0",
        },
        gold: {
          DEFAULT: "#FBAD18",   // Basecamp Tent (high-impact CTA / eyebrow)
          deep: "#E39A00",
          75: "#FEC059",
          50: "#FFD38D",
          25: "#FFE7C2",
        },

        // ---- Neutral (Black Granite ramp) ----
        slate: {
          75: "#636466",        // muted text
          50: "#939598",        // faint text
          25: "#C7C8CA",        // light hairline / empty checkbox
        },
        ondark: "#F0EEEC",           // text on dark
        "ondark-muted": "#A9AEAF",   // muted text on dark
        "ondark-line": "rgba(240,238,236,0.16)", // hairline on dark

        // ---- Utility surfaces ----
        sunken: "#E7E4E0",      // sunken track (progress bar bg)
        mist: "#EDEAE6",        // neutral badge bg / row hover
        rowhover: "#FBFAF9",    // list row hover
        parchment: "#ECE9E5",   // internal-notes panel

        // ---- Borders ----
        line: {
          subtle: "#DDD9D4",
          DEFAULT: "#CBC6C0",
        },

        // ---- Inline error (login) ----
        error: {
          bg: "#FBEAE8",
          line: "#E5B3AC",
          ink: "#8C2F26",
          dot: "#B3453A",
        },
      },

      fontFamily: {
        display: ['"Arkibal Display"', '"Roboto Slab"', "Georgia", "serif"],
        condensed: ['"Korolev Compressed"', '"Oswald"', '"Arial Narrow"', "sans-serif"],
        body: ['"Montserrat"', "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },

      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "8px",
        xl: "14px",
      },

      borderWidth: {
        hair: "1px",
        regular: "1.5px",
        thick: "3px",
      },

      boxShadow: {
        xs: "0 1px 2px rgba(45,49,50,0.06)",
        sm: "0 2px 8px rgba(45,49,50,0.08)",
        md: "0 10px 24px rgba(45,49,50,0.10)",
        lg: "0 22px 48px rgba(45,49,50,0.14)",
        lift: "0 14px 32px rgba(45,49,50,0.14)",   // card hover
        image: "0 12px 40px rgba(45,49,50,0.18)",  // framed photo
        login: "0 24px 60px rgba(0,0,0,0.5)",      // login card on black
        modal: "0 32px 80px rgba(0,0,0,0.5)",      // review-document modal
        focus: "0 0 0 3px rgba(108,202,208,0.45)", // teal focus ring
      },

      letterSpacing: {
        eyebrow: "0.18em",
        label: "0.12em",
        wide: "0.14em",
        display: "-0.01em",
      },

      transitionTimingFunction: {
        // "climb" — the expedition easing used across the whole portal
        climb: "cubic-bezier(0.16,1,0.3,1)",
      },

      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },

      animation: {
        // durations tuned per surface: nav/cards 460ms, screens 520ms
        "fade-up": "fade-up 460ms cubic-bezier(0.16,1,0.3,1) both",
        "fade-up-slow": "fade-up 520ms cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};

export default config;

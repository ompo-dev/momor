/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./premium/src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Zed "One" palette, kept under the `linear` key so every existing
        // `bg-linear-*` / `text-linear-*` utility instantly adopts the new look.
        // Usage example: bg-linear-canvas text-linear-ink border-linear-hairline
        //
        // One Dark ladder: canvas #282c33 · panel #2f343e · hover #363c46
        //   · elevated #3b414d · selected #454a56 · border #464b57 / #363c46
        //   · text #dce0e5 / #a9afbc / #878a98 · accent #74ade8
        linear: {
          canvas: "#282c33",
          surface: {
            1: "#2f343e",
            2: "#363c46",
            3: "#3b414d",
            4: "#454a56",
          },
          hairline: "#363c46",
          "hairline-strong": "#464b57",
          "hairline-tertiary": "#3b414d",
          ink: "#dce0e5",
          "ink-muted": "#a9afbc",
          "ink-subtle": "#878a98",
          "ink-tertiary": "#6a6f7b",
          primary: "#74ade8",
          "primary-hover": "#8bbcee",
          "primary-focus": "#5b9bde",
          success: "#a1c181",
          overlay: "#000000",
        },
        // Explicit `zed-*` alias for new code (same values as `linear-*`).
        zed: {
          canvas: "#282c33",
          panel: "#2f343e",
          hover: "#363c46",
          elevated: "#3b414d",
          selected: "#454a56",
          border: "#464b57",
          "border-variant": "#363c46",
          "border-focused": "#47679e",
          ink: "#dce0e5",
          "ink-muted": "#a9afbc",
          "ink-placeholder": "#878a98",
          accent: "#74ade8",
          "accent-hover": "#8bbcee",
          success: "#a1c181",
          warning: "#dec184",
          error: "#d07277",
          modified: "#dec184",
        },

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Legacy semantic tokens (bridge during migration) */
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          elevated: "var(--bg-elevated)",
          input: "var(--bg-input)",
          sidebar: "var(--bg-sidebar)",
          main: "var(--bg-main)",
          card: "var(--bg-card)",
          component: "var(--bg-component)",
          "toggle-switch": "var(--bg-toggle-switch)",
          "item-surface": "var(--bg-item-surface)",
          "item-active": "var(--bg-item-active)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        button: {
          primary: {
            bg: "var(--btn-primary-bg)",
            hover: "var(--btn-primary-hover)",
            "disabled-bg": "var(--btn-primary-disabled-bg)",
            "disabled-border": "var(--btn-primary-disabled-border)",
            "disabled-text": "var(--btn-primary-disabled-text)",
            "shadow-color": "var(--btn-primary-shadow-color)",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Linear radius scale
        "linear-xs": "4px",
        "linear-sm": "6px",
        "linear-md": "8px",
        "linear-lg": "12px",
        "linear-xl": "16px",
      },
      spacing: {
        // Linear spacing tokens (4px base)
        "linear-xxs": "4px",
        "linear-xs": "8px",
        "linear-sm": "12px",
        "linear-md": "16px",
        "linear-lg": "24px",
        "linear-xl": "32px",
        "linear-xxl": "48px",
        "linear-section": "96px",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        celeb: ["CelebMF", "sans-serif"],
        "celeb-light": ["CelebMFLight", "sans-serif"],
      },
      letterSpacing: {
        // Linear-ish tracking. Use sparingly (display/headlines).
        "linear-body": "-0.05em",
        "linear-tight": "-0.03em",
        "linear-display": "-0.04em",
      },
      transitionTimingFunction: {
        "apple-ease": "cubic-bezier(0.25, 1, 0.5, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        sculpted: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        textGradientWave: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        in: {
          "0%": { transform: "translateY(100%)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        out: {
          "0%": { transform: "translateY(0)", opacity: 1 },
          "100%": { transform: "translateY(100%)", opacity: 0 },
        },
        pulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: 0, transform: "scale(0.95)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        in: "in 0.2s ease-out",
        out: "out 0.2s ease-in",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
        "text-gradient-wave": "textGradientWave 2s infinite ease-in-out",
        "fade-in-up": "fadeInUp 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

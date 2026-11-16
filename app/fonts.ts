import localFont from "next/font/local";

// Self-hosted variable fonts (SIL OFL, from Fontsource) loaded through next/font: no render-blocking request to Google,
// no layout shift. Devanagari faces are used automatically for Hindi text through the CSS font stack.
export const playfair = localFont({
  src: [
    { path: "./fonts/playfair-normal.woff2", style: "normal", weight: "400 900" },
    { path: "./fonts/playfair-italic.woff2", style: "italic", weight: "400 900" },
  ],
  variable: "--font-playfair",
  display: "swap",
});

export const inter = localFont({
  src: [{ path: "./fonts/inter.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-inter",
  display: "swap",
});

export const notoSansDeva = localFont({
  src: [{ path: "./fonts/noto-sans-devanagari.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-deva-sans",
  display: "swap",
  preload: false,
});

export const notoSerifDeva = localFont({
  src: [{ path: "./fonts/noto-serif-devanagari.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-deva-serif",
  display: "swap",
  preload: false,
});

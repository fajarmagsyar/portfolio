import type { Metadata, Viewport } from "next";
import { Archivo, Caveat, DotGothic16, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

const body = Zen_Kaku_Gothic_New({
  variable: "--font-body",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const screen = DotGothic16({
  variable: "--font-screen",
  weight: "400",
  subsets: ["latin"],
});

// The name in the corner of the room: a heavy grotesque, set at its widest.
const display = Archivo({
  variable: "--font-display",
  axes: ["wdth"],
  subsets: ["latin"],
});

const hand = Caveat({
  variable: "--font-hand",
  weight: ["500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fajar Magsyar — Software Engineer",
  description:
    "Portofolio Fajar Magsyar, full stack programmer di Surabaya. Sebuah kamar 3D berisi TV tabung, kaset, CD, dan gitar.",
};

export const viewport: Viewport = {
  themeColor: "#15100c",
};

// Runs before first paint: if this device will get the 3D room, hide the static
// markup so it does not flash before the room mounts. Mirrors canRunRoom() in Home.tsx.
const preflight = `(function(){try{var p=new URLSearchParams(location.search);var f=p.get('room')==='1';var ok=innerWidth>=860&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!!document.createElement('canvas').getContext('webgl2');if(location.pathname==='/'&&(f||ok))document.documentElement.classList.add('will-room');}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${body.variable} ${screen.variable} ${hand.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preflight }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

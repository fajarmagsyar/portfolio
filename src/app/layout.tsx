import type { Metadata, Viewport } from "next";
import { Archivo, Caveat, Permanent_Marker, Cedarville_Cursive, DotGothic16, EB_Garamond, UnifrakturCook, Zen_Kaku_Gothic_New } from "next/font/google";
import { BASE_PATH } from "@/asset";
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

// Joined-up handwriting, as written with a pen: for the line on the cover of the photo album.
const script = Cedarville_Cursive({
  variable: "--font-script",
  weight: "400",
  subsets: ["latin"],
});

// Felt-tip on masking tape: for the workplace names on the cassettes.
const marker = Permanent_Marker({
  variable: "--font-marker",
  weight: "400",
  subsets: ["latin"],
});

// For the diploma on the desk: an old-style blackletter for the name of the university, and a book serif for the rest.
const black = UnifrakturCook({
  variable: "--font-black",
  weight: "700",
  subsets: ["latin"],
});

const serif = EB_Garamond({
  variable: "--font-serif",
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
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before first paint: if this device will get the 3D room, hide the static
// markup so it does not flash before the room mounts. Mirrors canRunRoom() in Home.tsx.
const preflight = `(function(){try{var p=new URLSearchParams(location.search);var r=p.get('room');var f=r==='1';var ok=r!=='0'&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!!document.createElement('canvas').getContext('webgl2');if((location.pathname==='/'||location.pathname==='${BASE_PATH}'||location.pathname==='${BASE_PATH}/')&&(f||ok))document.documentElement.classList.add('will-room');}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${body.variable} ${screen.variable} ${hand.variable} ${display.variable} ${script.variable} ${marker.variable} ${black.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preflight }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { L10n } from "./data";

export type Credit = {
  title: string;
  author: string;
  licence: "CC BY 4.0" | "CC BY-NC 4.0" | "CC0 1.0" | "OFL 1.1" | "See model page" | "Sketchfab Standard";
  url: string;
  /** what was changed, as CC BY asks to be stated */
  changes?: L10n;
};

const LICENCE_URL: Record<Credit["licence"], string> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-NC 4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
  "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "OFL 1.1": "https://openfontlicense.org/",
  "Sketchfab Standard": "https://sketchfab.com/licenses",
  // not offered under an open licence: the terms are the ones on the author's page
  "See model page": "https://sketchfab.com/3d-models/canonet-ql17-iii-0c8938f8d9874785b0d059af605449d5",
};
export const licenceUrl = (l: Credit["licence"]) => LICENCE_URL[l];

const placed: L10n = { id: "Tekstur diperkecil; diskalakan dan ditempatkan.", en: "Textures downscaled; scaled and placed." };

export const credits: Credit[] = [
  {
    title: "Fender Telecaster 1952",
    author: "Kanade_Tatibana",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/fender-telecaster-1952-d13911e0fcd54e14b65834b9145ccdb3",
    changes: placed,
  },
  {
    title: "Marshall Guitar Amp",
    author: "D3",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/marshall-guitar-amp-cd52e1b5299a40968f44c209899b4597",
    changes: placed,
  },
  {
    title: "Wooden guitar stand | Guitar rack asset",
    author: "Hineline",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/wooden-guitar-stand-guitar-rack-asset-64e5fe719d5c4379b1f4436b5d6aabed",
    changes: placed,
  },
  {
    title: "Sony Discman D-121 Final",
    author: "Jacques C. Valentin",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/sony-discman-d-121-final-142cd0af58a2445f9d42c266cffee72f",
    changes: placed,
  },
  {
    title: "Audio Cassettes (Low Poly)",
    author: "Mobius1",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/audio-cassettes-low-poly-72f334ea017840209f53998c8c2792b9",
    changes: {
      id: "Tekstur diperkecil; tiap kaset dipisah dan diberi selotip kertas bertuliskan nama tempat kerja.",
      en: "Textures downscaled; each cassette separated and given strips of masking tape with a workplace name.",
    },
  },
  {
    title: "Old Keyboard",
    author: "T4iri",
    licence: "CC BY-NC 4.0",
    url: "https://sketchfab.com/3d-models/old-keyboard-8911c0a1bc214921842f9ed4a0f51aea",
    changes: {
      id: "Tekstur diperkecil; diskalakan dan ditempatkan; tiap tombol ikut turun saat tombol aslinya ditekan.",
      en: "Textures downscaled; scaled and placed; each key goes down when the real one is pressed.",
    },
  },
  {
    title: "Canonet QL17 III",
    author: "forpinik",
    licence: "See model page",
    url: "https://sketchfab.com/3d-models/canonet-ql17-iii-0c8938f8d9874785b0d059af605449d5",
    changes: {
      id: "Hanya varian perak yang dipakai; tekstur diperkecil; diskalakan dan ditempatkan.",
      en: "Only the silver variant is used; textures downscaled; scaled and placed.",
    },
  },
  {
    title: "Saturn Desk Lamp",
    author: "MooseMannequin",
    licence: "Sketchfab Standard",
    url: "https://sketchfab.com/3d-models/saturn-desk-lamp-861fc2fffbb84622ad5127a806b975ae",
    changes: {
      id: "Diperkecil; bola lampu dibuat menyala hangat; ditempatkan.",
      en: "Scaled down; the globe made to glow a warm amber; placed.",
    },
  },
  {
    title: "Television 01, Gaming Console, Gamepad, Desk Lamp Arm 01, Painted Wooden Table, Potted Plant 02, Hanging Picture Frame 01 & 02, Wooden Bookshelf Worn, Book Encyclopedia Set 01, Boombox, Mid Century Lounge Chair, Side Table 01, Vintage Wooden Drawer 01, Wall Clock, Potted Plant 04, Ceramic Vase 03, Vintage Oil Lamp, Wood Floor, White Plaster 02",
    author: "Poly Haven",
    licence: "CC0 1.0",
    url: "https://polyhaven.com",
  },
  {
    title: "Roguelike/RPG pack, Roguelike Indoor pack, Roguelike Characters pack",
    author: "Kenney",
    licence: "CC0 1.0",
    url: "https://kenney.nl",
  },
  {
    title: "Zen Kaku Gothic New, DotGothic16, Caveat",
    author: "Google Fonts",
    licence: "OFL 1.1",
    url: "https://fonts.google.com",
  },
];

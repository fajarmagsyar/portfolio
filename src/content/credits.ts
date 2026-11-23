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
    title: "Telecaster",
    author: "aledororo",
    licence: "CC BY-NC 4.0",
    url: "https://sketchfab.com/3d-models/telecaster-88e1bcf87b4f4acea088644216bf4130",
    changes: placed,
  },
  {
    title: "CD with Jewel Case BULLY",
    author: "YE YE",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/cd-with-jewel-case-bully-185a15c745b4447d90998a67c2a9dd59",
    changes: {
      id: "Hanya wadahnya yang dipakai, tanpa cakram dan sampulnya; kedua bagiannya dipisah agar tutupnya bisa dibuka; dibuat bening; diskalakan.",
      en: "Only the case is used, without its disc and cover; its two halves separated so the lid can open; made clear; scaled.",
    },
  },
  {
    title: "Trading Card Pack",
    author: "goonmize1",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/trading-card-pack-26d1a87e47814d0ea3a710d169e3a671",
    changes: {
      id: "Hanya bentuk dan kerut foilnya yang dipakai; gambar cetaknya diganti dengan yang dibuat untuk situs ini; dibelah di garis potong.",
      en: "Only its shape and the crinkle of its foil are used; its printed artwork is replaced by one made for this site; split along the cut line.",
    },
  },
  {
    title: "Dining table wood with black metal",
    author: "Mr.N0b0dy",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/dining-table-wood-with-black-metal-5b09e402ce8b4fd1a22e2b8672f1b2ff",
    changes: { id: "Tekstur diperkecil; diputar dan sedikit direntangkan seukuran meja.", en: "Textures downscaled; turned and stretched slightly to the size of the desk." },
  },
  {
    title: "Old Book",
    author: "Mike Rowley",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/old-book-84145cf4a3984ff59867f8abfe9138ad",
    changes: { id: "Sampulnya dipakai sebagai jilid album foto: papan depan dipisah agar bisa dibuka, dipipihkan, tulisannya diganti.", en: "Its covers are used as the binding of the photo album: the front board separated so it can open, pressed flatter, its lettering replaced." },
  },
  {
    title: "RPG Dice Set",
    author: "ghosted",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/rpg-dice-set-2498c370c56842f89fa3d7096c72ed56",
    changes: { id: "Hanya satu set (oranye) dari tujuh yang dipakai; tekstur diperkecil; diskalakan dan ditempatkan.", en: "Only one set (the orange one) of the seven is used; textures downscaled; scaled and placed." },
  },
  {
    title: "Window",
    author: "adventurer",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/window-e7a957f3585a4ced8aeb23e9525f0b87",
    changes: { id: "Bingkai luar dan dua daun jendela dipakai, daun di bagian atas dibuang; tekstur diperkecil; diskalakan sesuai lubang dinding.", en: "The outer frame and the two sashes are used, the leaf over the top left out; textures downscaled; scaled to the wall opening." },
  },
  {
    title: "Simple PC Mouse",
    author: "SugarSatea",
    licence: "Sketchfab Standard",
    url: "https://sketchfab.com/3d-models/simple-pc-mouse-4a8fcd93c882402cab7d2d6458855ac5",
    changes: { id: "Diperkecil dan ditempatkan; bergerak mengikuti mouse pengunjung.", en: "Scaled down and placed; it moves with the visitor's mouse." },
  },
  {
    title: "Coffee Cup",
    author: "jeffbas",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/coffee-cup-ce14e184dce0440ebf21246ae876fca6",
    changes: { id: "Dibuat menerima cahaya ruangan; diskalakan dan ditempatkan.", en: "Made to take the room's light; scaled and placed." },
  },
  {
    title: "Helmet Redbull - Max Verstappen",
    author: "Maubian",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/helmet-redbull-max-verstappen-87eee96938ae415281a8aa8233eefba8",
    changes: { id: "Tekstur diperkecil ke 1024 px (WebP), dikompres; diskalakan dan ditempatkan di ambang jendela.", en: "Textures downscaled to 1024 px (WebP), compressed; scaled and placed on the window sill." },
  },
  {
    title: "Trash Can",
    author: "Yury Misiyuk",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/trash-can-0ad3407cd8104ba58f71885c0e58ca9a",
    changes: { id: "Tekstur diperkecil ke 1024 px (JPEG); diskalakan dan ditempatkan di lantai di ujung kanan meja.", en: "Textures downscaled to 1024 px (JPEG); scaled and placed on the floor at the right-hand end of the desk." },
  },
  {
    title: "Lamp - WIP",
    author: "KeenanBabcock",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/lamp-wip-8170cf1409924abc9c3fc8becccdd36e",
    changes: { id: "Tekstur diperkecil ke 1024 px (JPEG); diskalakan ke tinggi lampu berdiri dan ditempatkan di lantai di sisi kanan meja; kap diberi pendar hangat.", en: "Textures downscaled to 1024 px (JPEG); scaled to the height of a standing lamp and placed on the floor at the right of the desk; the shade given a warm glow." },
  },
  {
    title: "Nintendo DS Lite",
    author: "Cianon",
    licence: "CC BY 4.0",
    url: "https://sketchfab.com/3d-models/nintendo-ds-lite-ca529eb7208746e89b7a28fd2246659d",
    changes: { id: "Tekstur diperkecil ke 1024 px (WebP), dikompres; diskalakan dan ditempatkan di ambang jendela.", en: "Textures downscaled to 1024 px (WebP), compressed; scaled and placed on the window sill." },
  },
  ...(
    [
      ["Mercury", "mercury-32347fa4ec1a4987b71f461a401d91c4"],
      ["Venus", "venus-d497ce25553447f3b7b679110c85cfa1"],
      ["Earth", "earth-41fc80d85dfd480281f21b74b2de2faa"],
      ["Mars", "mars-9c7bbc64d8c74acfa9ec344c0fc10e1a"],
      ["Jupiter", "jupiter-d252c96ae3de48d7968b1206522ba9f5"],
    ] as const
  ).map(
    ([title, slug]): Credit => ({
      title,
      author: "Akshat",
      licence: "CC BY 4.0",
      url: `https://sketchfab.com/3d-models/${slug}`,
      changes: { id: "Hanya tekstur permukaannya yang dipakai, diperkecil, pada bola lampu.", en: "Only its surface texture is used, downscaled, on the globe of the lamp." },
    }),
  ),
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
      id: "Tekstur diperkecil; tiap kaset dipisah dan diberi label cetak berisi tahun dan nama tempat kerja.",
      en: "Textures downscaled; each cassette separated and given a printed label with the years and the workplace.",
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
      id: "Diperkecil; bola lampu diganti bola planet yang menyala; ditempatkan.",
      en: "Scaled down; the globe replaced by a glowing planet; placed.",
    },
  },
  {
    title: "Television 01, Gaming Console, Gamepad, Desk Lamp Arm 01, Potted Plant 02, Hanging Picture Frame 01 & 02, Wooden Bookshelf Worn, Book Encyclopedia Set 01, Boombox, Mid Century Lounge Chair, Side Table 01, Vintage Wooden Drawer 01, Wall Clock, Potted Plant 04, Ceramic Vase 03, Vintage Oil Lamp, Wood Floor, White Plaster 02",
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
    title: "Zen Kaku Gothic New, DotGothic16, Caveat, Permanent Marker, UnifrakturCook, EB Garamond",
    author: "Google Fonts",
    licence: "OFL 1.1",
    url: "https://fonts.google.com",
  },
];

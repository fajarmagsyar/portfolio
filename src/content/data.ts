// Single source of truth for everything the site says about Fajar.
// Every fact here comes from CV 2026 (EN). Do not add numbers or names that are not in the CV.

export type Lang = "id" | "en";
export type L10n = Record<Lang, string>;

export const profile = {
  name: "Fajar Magsyar",
  firstName: "Fajar",
  role: "Software Engineer",
  since: 2018,
  hello: {
    id: "Halo, saya Fajar.",
    en: "Hi, I'm Fajar.",
  } satisfies L10n,
  intro: {
    id: "Full stack programmer di Surabaya. Mulai dari bikin game mobile, sempat jadi typesetter manga, sekarang membangun aplikasi web dari database sampai tampilan.",
    en: "Full stack programmer in Surabaya. Started out making mobile games, spent a few years typesetting manga, and now build web apps from the database up to the pixels.",
  } satisfies L10n,
  about: {
    id: [
      "Saya bekerja secara profesional sejak 2018, dengan pengalaman di PHP, JavaScript, C#, MySQL, PostgreSQL, Laravel, React, Flutter, Next.js, dan lainnya.",
      "Saya pernah mengerjakan aplikasi web, full-stack, dan mobile, dan juga punya pengalaman di desain grafis serta video editing.",
      "Saya nyaman bekerja dalam tim dan menyelesaikan proyek dengan tenggat yang ketat.",
    ],
    en: [
      "I've been working professionally since 2018, with experience across PHP, JavaScript, C#, MySQL, PostgreSQL, Laravel, React, Flutter, Next.js, and more.",
      "I've worked on web, full-stack, and mobile applications, and I also have experience in graphic design and video editing.",
      "I'm comfortable working as part of a team and delivering projects within tight deadlines.",
    ],
  } satisfies Record<Lang, string[]>,
  likes: {
    id: "Di luar kerja, saya suka ngulik hal-hal kecil dan bikin project personal.",
    en: "Outside work, I like tinkering with small ideas and building personal projects.",
  } satisfies L10n,
};

export type Job = {
  id: string;
  company: string;
  place: L10n;
  from: number;
  to: number | null; // null = present
  title: string;
  body: L10n;
  tech: string[];
  /** this workplace's logo, shown on the pamphlet that unfolds from its cassette: a path under /public, e.g. "/logos/prahu-hub.png". Without one the pamphlet shows the company's initials. */
  logo?: string;
  /** cassette shell + label colours */
  tape: { shell: string; label: string; ink: string };
};

export const jobs: Job[] = [
  {
    id: "prahu-hub",
    company: "Prahu-Hub",
    logo: "/logos/prahu-hub.png",
    place: { id: "Surabaya", en: "Surabaya" },
    from: 2025,
    to: null,
    title: "Full Stack Programmer",
    body: {
      id: "Mengembangkan dan merawat aplikasi web dengan SilverStripe, Express.js untuk API dan sisi server, serta Next.js untuk frontend yang responsif dan ramah SEO.",
      en: "Developing and maintaining web applications using SilverStripe, Express.js for APIs and server-side development, and Next.js to build responsive, SEO-friendly frontends.",
    },
    tech: ["SilverStripe", "Express.js", "Next.js"],
    tape: { shell: "#2a2622", label: "#f1e3c2", ink: "#b3341f" },
  },
  {
    id: "morning-glory",
    company: "Morning Glory Enterprise",
    logo: "/logos/mge.png",
    place: { id: "Surabaya", en: "Surabaya" },
    from: 2023,
    to: 2025,
    title: "Full Stack Programmer",
    body: {
      id: "Full stack web developer di sebuah software house, memakai SilverStripe 5, Next.js, Express.js, dan Vue.js. Bekerja dekat dengan tim untuk proyek bertenggat ketat, dan ikut di proses UI/UX dengan membuat wireframe dan prototipe di Figma.",
      en: "Full stack web developer at a software house, using SilverStripe 5, Next.js, Express.js, and Vue.js. Worked closely with the team on projects under tight deadlines, and contributed to the UI/UX process by creating wireframes and prototypes in Figma.",
    },
    tech: ["SilverStripe 5", "Next.js", "Express.js", "Vue.js", "Figma"],
    tape: { shell: "#d9d2c3", label: "#f6efe0", ink: "#1f5d6b" },
  },
  {
    id: "kominfo",
    company: "Dinas KOMINFO",
    logo: "/logos/diskominfo.png",
    place: { id: "Kota Kupang", en: "Kupang City" },
    from: 2021,
    to: 2023,
    title: "Programmer Specialist",
    body: {
      id: "Mengembangkan dan merawat aplikasi full-stack dan mobile untuk instansi pemerintah, sambil mengerjakan desain grafis dan produksi video. Berkontribusi pada 11 aplikasi dan website, dari desain sampai implementasi, bersama berbagai tim.",
      en: "Developed and maintained full-stack and mobile applications for government institutions, while also working on graphic design and video production. Contributed to 11 applications and websites, handling projects from design through implementation, working closely with different teams.",
    },
    tech: ["Full-stack", "Mobile", "Graphic design", "Video"],
    tape: { shell: "#3b4a3f", label: "#efe6cf", ink: "#2f4a35" },
  },
  {
    id: "amimaru",
    company: "Amimaru, Ltd.",
    logo: "/logos/amimaru.png",
    place: { id: "Remote, freelance", en: "Remote, freelance" },
    from: 2018,
    to: 2021,
    title: "Typesetter Editor",
    body: {
      id: "Bekerja untuk perusahaan lokalisasi manga asal Finlandia, di lingkungan kerja berbahasa Inggris. Sebagai typesetter, saya mengedit dan menata manga terjemahan dengan Adobe Photoshop dan Adobe InDesign.",
      en: "Worked for a Finland-based manga localization company, in an English-speaking environment. As a typesetter, I edited and formatted translated manga using Adobe Photoshop and Adobe InDesign.",
    },
    tech: ["Adobe Photoshop", "Adobe InDesign"],
    tape: { shell: "#7a2f2a", label: "#f4ead6", ink: "#222222" },
  },
  {
    id: "solite",
    company: "Solite Kids Studio",
    logo: "/logos/solite-kids.png",
    place: { id: "Bangkalan", en: "Bangkalan" },
    from: 2016,
    to: 2016,
    title: "Intern Mobile Game Developer",
    body: {
      id: "Saat magang, saya merancang dan mengembangkan game mobile dengan C# dan game engine Cocos2d-x.",
      en: "During my internship, I designed and developed mobile games using C# and the Cocos2d-x game engine.",
    },
    tech: ["C#", "Cocos2d-x"],
    tape: { shell: "#c9a13a", label: "#fbf3df", ink: "#5a3413" },
  },
];

export function jobYears(job: Job, lang: Lang): string {
  if (job.to === null) return `${job.from} – ${lang === "id" ? "sekarang" : "now"}`;
  if (job.to === job.from) return `${job.from}`;
  return `${job.from} – ${job.to}`;
}

export type Project = {
  id: string;
  /** null = empty prototype slot, to be filled in by Fajar */
  name: string | null;
  year: string | null;
  body: L10n | null;
  tech: string[];
  url: string | null;
  disc: string; // disc / sleeve colour
  /** screenshots for the leaflet inside the CD case: paths under /public, e.g. "/projects/toko-1.jpg". Up to two are shown. */
  shots?: string[];
  /** press that covered it, shown as "Diliput oleh" / "Covered by" */
  coverage?: { name: string; url: string }[];
};

// PROTOTYPE: these four slots are intentionally empty. Replace with real projects.
export const projects: Project[] = [
  {
    id: "karyadan",
    name: "Portofolio",
    year: "2026",
    body: {
      id: "Portofolio ini sendiri: sebuah kamar 3D interaktif di malam hari, lengkap dengan TV, gitar, kaset, CD, dan kamera yang bisa dijelajahi.",
      en: "This portfolio itself: an interactive 3D room at night, with a TV, guitar, cassettes, CDs and a camera you can explore.",
    },
    tech: ["Next.js", "React Three Fiber", "Three.js", "TypeScript"],
    url: "https://github.com/fajarmagsyar/karyadan",
    disc: "#c7532f",
    shots: ["/projects/portofolio-1.jpg"],
  },
  {
    id: "sihebat",
    name: "SIHEBAT",
    year: "2022",
    body: {
      id: "Sistem Hemat Bahan Bakar untuk kendaraan dinas Pemerintah Kota Kupang, dibuat bersama Dinas KOMINFO. Kupon BBM manual diganti barcode yang dipindai di SPBU dengan batas isi bulanan, supaya BBM tepat sasaran dan anggaran lebih efisien.",
      en: "Sistem Hemat Bahan Bakar (fuel-saving system) for Kupang City Government's official vehicles, built with Dinas KOMINFO. Manual fuel coupons were replaced by a barcode scanned at the fuel station, with a monthly fill limit, so fuel reaches its intended use and the budget is spent more efficiently.",
    },
    tech: ["Full-stack", "Barcode", "Dinas KOMINFO Kota Kupang"],
    url: null,
    disc: "#2f6f73",
    shots: ["/projects/portofolio-2.jpg"],
    coverage: [
      { name: "FKK News", url: "https://www.fkknews.com/sihebat-aplikasi-yang-mudahkan-kegiatan-operasional-dan-digunakan-untuk-efisiensi-anggaran-bagi-pemerintah-kota-kupang/" },
      { name: "Liputan6", url: "https://www.liputan6.com/news/read/5048109/evaluasi-smart-city-kupang-dari-sihebat-hingga-dapat-banyak-penghargaan" },
      { name: "ANTARA Kupang", url: "https://kupang.antaranews.com/berita/94289/wali-kota-kupang-program-smart-city-berdampak-positif" },
    ],
  },
  { id: "slot-3", name: null, year: null, body: null, tech: [], url: null, disc: "#d2a23c" },
  { id: "slot-4", name: null, year: null, body: null, tech: [], url: null, disc: "#5b4a7a" },
];

export const education = {
  degree: { id: "Sarjana Komputer (S.Kom)", en: "Bachelor's Degree (S.Kom)" } satisfies L10n,
  school: "Universitas Uyelindo",
  years: "2017 – 2021",
  gpa: "3.78",
};

export const certifications = [
  { year: 2022, title: "Backend Developer", issuer: "Digitalent Kementrian KOMINFO" },
  { year: 2022, title: "Backend Developer", issuer: "Dicoding" },
  { year: 2021, title: "Javascript Developer", issuer: "Dicoding" },
  { year: 2021, title: "Master Mobile Developer", issuer: "Skill Academy" },
  { year: 2017, title: "Software Technician", issuer: "Badan Nasional Sertifikasi Profesi" },
];

export const skills = [
  "PHP",
  "Javascript",
  "Typescript",
  "C#",
  "HTML",
  "CSS",
  "NodeJS",
  "NextJS",
  "VueJS",
  "Silverstripe",
  "Laravel",
  "AI Orchestration",
  "CI/CD",
  "Docker",
];

/** What each skill actually is, shown when a skill tile is opened on the lite page. */
export const skillNotes: Record<string, L10n> = {
  PHP: {
    id: "Bahasa server-side untuk web: logika di balik halaman, API, dan panel admin.",
    en: "A server-side language for the web: the logic behind pages, APIs and admin panels.",
  },
  Javascript: {
    id: "Bahasa browser: membuat halaman interaktif, dan lewat Node juga jalan di server.",
    en: "The language of the browser: makes pages interactive, and through Node runs on servers too.",
  },
  Typescript: {
    id: "JavaScript dengan tipe data, supaya kesalahan ketahuan sebelum kode dijalankan.",
    en: "JavaScript with types, so mistakes are caught before the code ever runs.",
  },
  "C#": {
    id: "Bahasa .NET dari Microsoft, dipakai untuk aplikasi desktop, backend, dan game Unity.",
    en: "Microsoft's .NET language, used for desktop apps, back ends and Unity games.",
  },
  HTML: {
    id: "Kerangka setiap halaman web: menyusun judul, teks, gambar, dan form dengan struktur yang benar.",
    en: "The skeleton of every web page: headings, text, images and forms in a meaningful structure.",
  },
  CSS: {
    id: "Bahasa tampilan web: layout, warna, tipografi, dan animasi yang responsif di semua layar.",
    en: "The look of the web: layout, colour, type and motion that adapt to every screen.",
  },
  NodeJS: {
    id: "JavaScript di server: membangun API, layanan real-time, dan alat bantu build.",
    en: "JavaScript on the server: APIs, real-time services and build tooling.",
  },
  NextJS: {
    id: "Framework React untuk situs dan aplikasi yang cepat dan ramah SEO, dirender di server maupun browser.",
    en: "A React framework for fast, SEO-friendly sites and apps, rendered on the server and in the browser.",
  },
  VueJS: {
    id: "Framework JavaScript yang ringan untuk antarmuka yang reaktif dan berbasis komponen.",
    en: "A lightweight JavaScript framework for reactive, component-based interfaces.",
  },
  Silverstripe: {
    id: "CMS dan framework PHP untuk situs yang kontennya dikelola sendiri oleh klien.",
    en: "A PHP CMS and framework for websites whose content the client manages themselves.",
  },
  Laravel: {
    id: "Framework PHP untuk aplikasi web lengkap: routing, database, autentikasi, dan antrean tugas.",
    en: "A PHP framework for full web applications: routing, databases, authentication and queues.",
  },
  "AI Orchestration": {
    id: "Merangkai model AI, tools, dan data menjadi alur kerja yang bisa diandalkan di aplikasi nyata.",
    en: "Wiring AI models, tools and data into dependable workflows inside real applications.",
  },
  "CI/CD": {
    id: "Otomatisasi tes dan deploy: setiap perubahan dicek lalu dirilis tanpa langkah manual.",
    en: "Automated testing and deployment: every change is checked, then shipped without manual steps.",
  },
  Docker: {
    id: "Membungkus aplikasi beserta lingkungannya dalam container, jadi jalan sama di mana pun.",
    en: "Packages an app with its environment in a container, so it runs the same everywhere.",
  },
};

export const links = {
  email: "fajar.magsyar@gmail.com",
  github: { label: "fajarmagsyar", url: "https://github.com/fajarmagsyar" },
  linkedin: { label: "in/fajarmagsyar", url: "https://www.linkedin.com/in/fajarmagsyar" },
  steam: { label: "dawnefx", url: "https://steamcommunity.com/id/dawnefx/" },
  /**
   * PLACEHOLDER: paste the Spotify playlist link here, e.g.
   * "https://open.spotify.com/playlist/xxxxxxxxxxxxxxxxxxxxxx"
   * While this is null the players show a "playlist not set" state.
   */
  spotifyPlaylistUrl: null as string | null,
};

/** Turns a normal Spotify share link into its embeddable form. */
export function spotifyEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`;
}

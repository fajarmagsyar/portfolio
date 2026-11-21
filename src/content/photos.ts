import type { L10n } from "./data";

export type Photo = {
  /** A path under /public (e.g. "/photos/pasar-malam.jpg") or a full image URL. Leave null for an empty slot. */
  src: string | null;
  caption?: L10n;
};

/** One of my photos on Unsplash, served from their image CDN at a size that suits the album. */
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=80`;

// The photo album on the desk: my Unsplash collection "My Tabliss Wallpaper"
// (https://unsplash.com/collections/kbPh2cREvyk/my-tabliss-wallpaper), in its order.
// Captions are the descriptions the photos carry on Unsplash; add or edit them freely.
// To add a photo, append an entry: either an Unsplash photo id, or a file put in public/photos/.
// Each page holds two photos, landscape or portrait; the album grows pages as needed.
export const photos: Photo[] = [
  { src: unsplash("1783770182917-f19a3277c68a"), caption: { id: "Kucing belang duduk di meja, di samping keyboard", en: "Tabby cat sitting on a desk with a keyboard" } },
  { src: unsplash("1759889137486-33ba7b190f28") },
  { src: unsplash("1759889137464-e6f0d22c30c1") },
  { src: unsplash("1759889137478-b56760e9a362") },
  { src: unsplash("1759889137451-662339999b50") },
  { src: unsplash("1759889138173-ed466cb5a9e7") },
  { src: unsplash("1759889137242-517502831e92") },
  { src: unsplash("1759889137573-6fe7af1093ec") },
  { src: unsplash("1745380709312-2b3d657796af"), caption: { id: "Pengemudi memegang setir, menatap ke depan", en: "A driver holds a steering wheel and watches ahead" } },
  { src: unsplash("1745380709325-154b42a15061"), caption: { id: "Pegunungan yang sebagian tertutup awan", en: "Mountains partially obscured by clouds" } },
  { src: unsplash("1745380709297-136a13ef15ae") },
  { src: unsplash("1731905012304-dfe3fe4adc95"), caption: { id: "Kapal besar di atas perairan luas", en: "A large boat on a large body of water" } },
  { src: unsplash("1718011098570-aa43cb98f16e"), caption: { id: "Tenda di tengah hutan pada malam hari", en: "A tent in the middle of a forest at night" } },
  { src: unsplash("1718011408284-e0974ddb91f9"), caption: { id: "Dua tenda di tengah hutan", en: "A couple of tents in the middle of a forest" } },
  { src: unsplash("1718011385694-365a9ac95de0") },
  { src: unsplash("1718011411453-1d46a2629298"), caption: { id: "Langit malam penuh bintang di antara pepohonan", en: "The night sky filled with stars and trees" } },
  { src: unsplash("1718011161146-a0e675b88294") },
  { src: unsplash("1718011083242-0802e0b0d666") },
  { src: unsplash("1718011138680-5e11815511a4") },
  { src: unsplash("1718011076527-64c7cd115cce"), caption: { id: "Bermain skateboard di jalan setapak hutan", en: "Riding a skateboard down a path in a forest" } },
];

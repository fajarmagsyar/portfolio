export type Track = {
  /** Path under /public, e.g. "/music/01-airbag.mp3" */
  src: string;
  title?: string;
};

// What the Discman on the desk plays. Put the MP3s in public/music/ and list them here in
// playing order. With nothing listed, the Discman's display reads "no disc".
export const tracks: Track[] = [
  { src: "/music/lucky.mp3", title: "Radiohead - Lucky" },
];

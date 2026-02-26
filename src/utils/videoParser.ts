export function parseVideoUrl(src: string): { type: "youtube" | "vimeo" | "native"; embedUrl: string } {
  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = src.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
  );
  if (ytMatch) {
    return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // Vimeo: vimeo.com/ID
  const vimeoMatch = src.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { type: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  return { type: "native", embedUrl: src };
}

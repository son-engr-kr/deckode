import type { VideoElement as VideoElementType } from "@/types/deck";

interface Props {
  element: VideoElementType;
}

function parseVideoUrl(src: string): { type: "youtube" | "vimeo" | "native"; embedUrl: string } {
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

export function VideoElementRenderer({ element }: Props) {
  const style = element.style ?? {};
  const { type, embedUrl } = parseVideoUrl(element.src);

  const commonStyle: React.CSSProperties = {
    width: element.size.w,
    height: element.size.h,
    objectFit: (style.objectFit ?? "contain") as React.CSSProperties["objectFit"],
    borderRadius: style.borderRadius ?? 0,
  };

  if (type === "youtube" || type === "vimeo") {
    const params = new URLSearchParams();
    if (element.autoplay) params.set("autoplay", "1");
    if (element.loop) params.set("loop", "1");
    if (element.muted) params.set("mute", "1");
    const paramStr = params.toString();
    const url = paramStr ? `${embedUrl}?${paramStr}` : embedUrl;

    return (
      <iframe
        src={url}
        style={{ ...commonStyle, border: "none" }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video
      src={embedUrl}
      autoPlay={element.autoplay}
      loop={element.loop}
      muted={element.muted}
      controls={element.controls}
      style={commonStyle}
    />
  );
}

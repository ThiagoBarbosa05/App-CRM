export function getYouTubeEmbedUrl(url: string): string {
  const videoIdMatch = url.match(/[?&]v=([^&]+)/);
  if (!videoIdMatch) return "";
  return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
}

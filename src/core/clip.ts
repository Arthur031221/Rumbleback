/**
 * Containers to try for a recorded clip, best for sharing first. MP4 with H.264 opens in the Photos app, in iMessage
 * and in every social app, while WebM does not on an iPhone, so a browser that records both gets MP4.
 */
const CLIP_FORMATS = [
  { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
  { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
] as const;

export interface ClipFormat {
  mime: string;
  ext: 'mp4' | 'webm';
}

/** The first format the browser's recorder accepts, or null when it records none of them. */
export function pickClipFormat(isSupported: (mime: string) => boolean): ClipFormat | null {
  return CLIP_FORMATS.find((f) => isSupported(f.mime)) ?? null;
}

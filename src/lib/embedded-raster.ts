const MAX_BYTES = 200 * 1024;
const MAX_PIXELS = 8_000_000;
const RASTER_URL = /^data:image\/(png|jpeg|gif|webp|bmp);base64,/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const JPEG_FRAME = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(bytes: DataView, size: number): [number, number] | undefined {
  if (bytes.getUint16(0) !== 0xffd8 || bytes.getUint16(size - 2) !== 0xffd9) return;
  for (let i = 2; i + 3 < size;) {
    if (bytes.getUint8(i++) !== 0xff) return;
    while (i < size && bytes.getUint8(i) === 0xff) i++;
    if (i + 2 >= size) return;
    const marker = bytes.getUint8(i++);
    if (marker === 0xda || marker === 0xd9) return;
    const segmentSize = bytes.getUint16(i);
    if (segmentSize < 2 || i + segmentSize > size) return;
    if (JPEG_FRAME.has(marker) && segmentSize >= 8) {
      return [bytes.getUint16(i + 5), bytes.getUint16(i + 3)];
    }
    i += segmentSize;
  }
}

function rasterSize(type: string, bytes: DataView, size: number): [number, number] | undefined {
  if (size < 26) return;
  if (type === 'png' && bytes.getUint32(0) === 0x89504e47 && bytes.getUint32(4) === 0x0d0a1a0a
    && bytes.getUint32(8) === 13 && bytes.getUint32(12) === 0x49484452) {
    return [bytes.getUint32(16), bytes.getUint32(20)];
  }
  if (type === 'gif' && bytes.getUint32(0) === 0x47494638
    && [0x3761, 0x3961].includes(bytes.getUint16(4))) {
    return [bytes.getUint16(6, true), bytes.getUint16(8, true)];
  }
  if (type === 'bmp' && bytes.getUint16(0) === 0x424d) {
    const header = bytes.getUint32(14, true);
    if (header === 12) return [bytes.getUint16(18, true), bytes.getUint16(20, true)];
    if (header >= 40 && header <= size - 14) return [bytes.getInt32(18, true), Math.abs(bytes.getInt32(22, true))];
  }
  if (type === 'jpeg') return jpegSize(bytes, size);
  if (type === 'webp' && size >= 30 && bytes.getUint32(0) === 0x52494646 && bytes.getUint32(8) === 0x57454250) {
    const tag = bytes.getUint32(12);
    if (tag === 0x56503858) {
      return [1 + (bytes.getUint32(24, true) & 0xffffff), 1 + (bytes.getUint32(26, true) >>> 8)];
    }
    if (tag === 0x5650384c && bytes.getUint8(20) === 0x2f) {
      const dimensions = bytes.getUint32(21, true);
      return [1 + (dimensions & 0x3fff), 1 + ((dimensions >>> 14) & 0x3fff)];
    }
    if (tag === 0x56503820 && bytes.getUint8(23) === 0x9d && bytes.getUint16(24) === 0x012a) {
      return [bytes.getUint16(26, true) & 0x3fff, bytes.getUint16(28, true) & 0x3fff];
    }
  }
}

export function isSmallEmbeddedRaster(url: string): boolean {
  // Reject unbounded input before scanning or decoding the payload.
  if (url.length > 32 + Math.ceil(MAX_BYTES / 3) * 4) return false;
  const match = RASTER_URL.exec(url);
  if (!match) return false;
  const payload = url.slice(match[0].length);
  if (!payload.length || payload.length % 4 !== 0 || !BASE64.test(payload)) return false;
  try {
    const binary = atob(payload);
    if (binary.length > MAX_BYTES) return false;
    const bytes = new DataView(Uint8Array.from(binary, c => c.charCodeAt(0)).buffer);
    const size = rasterSize(match[1].toLowerCase(), bytes, binary.length);
    return !!size && size[0] > 0 && size[1] > 0 && size[0] * size[1] <= MAX_PIXELS;
  } catch {
    return false;
  }
}

import zlib from "zlib";

/**
 * Minimal PNG encoder.
 *
 * The PDF workspace carries the figures of an imported PDF into the editable
 * document, and a browser `<img>` needs a real image format - the raw bitmaps
 * that pdfjs hands back are not one. Node has no canvas here and no image
 * library is installed, so the small part of PNG that is actually needed is
 * implemented directly: 8-bit RGBA, one IDAT, filter type 0 (None) per scanline.
 *
 * That is a complete, valid PNG for every case we produce. What is deliberately
 * left out - palettes, interlacing, 16-bit samples, per-scanline filter
 * heuristics - would only buy a smaller file, never a correct one.
 */

// pdfjs ImageKind values (server/node_modules/pdfjs-dist/src/shared/util.js).
// Duplicated as plain numbers so this module never has to load pdfjs itself.
export const IMAGE_KIND = {
  GRAYSCALE_1BPP: 1,
  RGB_24BPP: 2,
  RGBA_32BPP: 3,
};

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Encode RGBA bytes as a PNG.
 *
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array|Uint8ClampedArray} rgba  width*height*4 bytes
 * @returns {Buffer}
 */
export const encodeRgbaPng = (width, height, rgba) => {
  const stride = width * 4;
  // Each scanline is prefixed with its filter byte, which is 0 here.
  const raw = Buffer.alloc((stride + 1) * height);
  const source = Buffer.from(rgba.buffer ?? rgba, rgba.byteOffset ?? 0, stride * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    source.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

/**
 * Turn a pdfjs image bitmap into PNG bytes.
 *
 * Only the three kinds pdfjs can hand back unpainted are handled. pdfjs's
 * conversion for 1bpp is mirrored exactly (bit set = white, row stride is
 * `ceil(width / 8)`), because a mask decoded with the opposite polarity would
 * silently turn a scanned figure into a black rectangle.
 *
 * @returns {Buffer|null} null when the kind is not decodable here
 */
export const pngFromPdfjsImage = (image) => {
  if (!image?.width || !image?.height || !image?.data) return null;

  const { width, height, kind } = image;
  const data = image.data;

  if (kind === IMAGE_KIND.RGBA_32BPP) {
    return encodeRgbaPng(width, height, data);
  }

  if (kind === IMAGE_KIND.RGB_24BPP) {
    const rgba = new Uint8Array(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      rgba[pixel * 4] = data[pixel * 3];
      rgba[pixel * 4 + 1] = data[pixel * 3 + 1];
      rgba[pixel * 4 + 2] = data[pixel * 3 + 2];
      rgba[pixel * 4 + 3] = 255;
    }
    return encodeRgbaPng(width, height, rgba);
  }

  if (kind === IMAGE_KIND.GRAYSCALE_1BPP) {
    const rgba = new Uint8Array(width * height * 4);
    const rowStride = (width >> 3) + (width & 7 ? 1 : 0);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = data[y * rowStride + (x >> 3)] ?? 0xff;
        const white = byte & (1 << (7 - (x & 7)));
        const value = white ? 255 : 0;
        const offset = (y * width + x) * 4;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
        rgba[offset + 3] = 255;
      }
    }
    return encodeRgbaPng(width, height, rgba);
  }

  return null;
};

export default { encodeRgbaPng, pngFromPdfjsImage, IMAGE_KIND };

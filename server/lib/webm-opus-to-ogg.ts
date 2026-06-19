/**
 * Remux WebM/Opus → OGG/Opus without re-encoding.
 * Chrome MediaRecorder produces audio/webm;codecs=opus which WhatsApp rejects.
 * WhatsApp accepts audio/ogg. Both containers carry identical Opus bitstreams.
 */

// ── OGG CRC-32 (polynomial 0x04c11db7) ───────────────────────────────────────

const OGG_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000) ? (((r << 1) >>> 0) ^ 0x04c11db7) : ((r << 1) >>> 0);
    }
    t[i] = r;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let crc = 0;
  for (let i = 0; i < buf.length; i++) {
    crc = (((crc << 8) >>> 0) ^ OGG_CRC_TABLE[((crc >>> 24) ^ buf[i]) & 0xff]) >>> 0;
  }
  return crc;
}

// ── EBML parser ───────────────────────────────────────────────────────────────

const EBML_UNKNOWN = -1;

function readElemId(buf: Buffer, p: number): [id: number, w: number] {
  const b = buf[p];
  let w = 1;
  while (w <= 4 && !(b & (0x80 >> (w - 1)))) w++;
  let id = b;
  for (let i = 1; i < w; i++) id = ((id << 8) >>> 0) | buf[p + i];
  return [id, w];
}

function readVSize(buf: Buffer, p: number): [size: number, w: number] {
  const b = buf[p];
  let w = 1;
  while (w <= 8 && !(b & (0x80 >> (w - 1)))) w++;
  const markerBit = 0x80 >> (w - 1);
  let v = b & (markerBit - 1);
  let allOnes = v === (markerBit - 1);
  for (let i = 1; i < w; i++) {
    const x = buf[p + i];
    v = (v << 8) | x;
    if (x !== 0xff) allOnes = false;
  }
  return [allOnes ? EBML_UNKNOWN : v, w];
}

interface El { id: number; dataStart: number; end: number }

function parseChildren(buf: Buffer, from: number, to: number): El[] {
  const result: El[] = [];
  let p = from;
  while (p + 2 <= to) {
    const [id, idW] = readElemId(buf, p);
    if (p + idW >= to) break;
    const [size, szW] = readVSize(buf, p + idW);
    const dataStart = p + idW + szW;
    const end = size === EBML_UNKNOWN ? to : Math.min(dataStart + size, to);
    result.push({ id, dataStart, end });
    p = end;
  }
  return result;
}

// ── Known EBML/WebM element IDs ───────────────────────────────────────────────

const ID = {
  SEGMENT:     0x18538067,
  TRACKS:      0x1654AE6B,
  TRACK_ENTRY: 0xAE,
  TRACK_TYPE:  0x83, // audio = 2
  CODEC_PRIV:  0x63A2,
  CLUSTER:     0x1F43B675,
  TIMESTAMP:   0xE7,
  SIMPLEBLOCK: 0xA3,
  BLOCKGROUP:  0xA0,
  BLOCK:       0xA1,
} as const;

// ── OGG page writer ───────────────────────────────────────────────────────────

// Write a 64-bit LE int as two 32-bit halves (avoids BigInt requirement)
function writeInt64LE(buf: Buffer, offset: number, lo: number, hi: number) {
  buf.writeUInt32LE(lo >>> 0, offset);
  buf.writeUInt32LE(hi >>> 0, offset + 4);
}

function writeOggPage(
  serial: number,
  seqNum: number,
  headerType: number,
  granuleLo: number,
  granuleHi: number,
  packets: Buffer[],
): Buffer {
  const segTable: number[] = [];
  for (let pi = 0; pi < packets.length; pi++) {
    let rem = packets[pi].length;
    while (rem >= 255) { segTable.push(255); rem -= 255; }
    segTable.push(rem);
  }
  let dataLen = 0;
  for (let pi = 0; pi < packets.length; pi++) dataLen += packets[pi].length;

  const page = Buffer.alloc(27 + segTable.length + dataLen, 0);
  page.write("OggS", 0, "ascii");
  page[4] = 0; // stream structure version
  page[5] = headerType;
  writeInt64LE(page, 6, granuleLo, granuleHi);
  page.writeUInt32LE(serial, 14);
  page.writeUInt32LE(seqNum, 18);
  // bytes 22-25: checksum (filled after)
  page[26] = segTable.length;
  for (let i = 0; i < segTable.length; i++) page[27 + i] = segTable[i];

  let off = 27 + segTable.length;
  for (let pi = 0; pi < packets.length; pi++) {
    packets[pi].copy(page, off);
    off += packets[pi].length;
  }

  page.writeUInt32LE(crc32(page), 22);
  return page;
}

// ── Main conversion ───────────────────────────────────────────────────────────

interface AudioPacket { data: Buffer; ms: number }

function extractPackets(buf: Buffer): { opusHead: Buffer; packets: AudioPacket[] } {
  const top = parseChildren(buf, 0, buf.length);
  const segEl = top.find(e => e.id === ID.SEGMENT);
  if (!segEl) throw new Error("WebM→OGG: no Segment element found");

  const segChildren = parseChildren(buf, segEl.dataStart, segEl.end);

  // Extract OpusHead from Tracks
  let opusHead: Buffer | null = null;
  const tracksEl = segChildren.find(e => e.id === ID.TRACKS);
  if (tracksEl) {
    for (const te of parseChildren(buf, tracksEl.dataStart, tracksEl.end)) {
      if (te.id !== ID.TRACK_ENTRY) continue;
      const fields = parseChildren(buf, te.dataStart, te.end);
      const typeEl = fields.find(f => f.id === ID.TRACK_TYPE);
      if (!typeEl || buf[typeEl.dataStart] !== 2) continue; // not audio track
      const cpEl = fields.find(f => f.id === ID.CODEC_PRIV);
      if (cpEl) opusHead = buf.subarray(cpEl.dataStart, cpEl.end);
    }
  }
  if (!opusHead) throw new Error("WebM→OGG: no Opus CodecPrivate (OpusHead) found");

  // Extract audio packets from Clusters
  const packets: AudioPacket[] = [];
  let clusterMs = 0;

  function extractBlock(blockStart: number, blockEnd: number, clMs: number) {
    let p = blockStart;
    const [, tnW] = readVSize(buf, p);
    p += tnW;
    const relMs = buf.readInt16BE(p);
    p += 2;
    const flags = buf[p++];
    const lacing = (flags >> 1) & 0x3;
    // No lacing (0) is the common case for Chrome MediaRecorder audio
    if (lacing === 0) {
      packets.push({ data: buf.subarray(p, blockEnd), ms: clMs + relMs });
    }
  }

  for (const cl of segChildren) {
    if (cl.id !== ID.CLUSTER) continue;
    for (const ce of parseChildren(buf, cl.dataStart, cl.end)) {
      if (ce.id === ID.TIMESTAMP) {
        let ts = 0;
        for (let i = ce.dataStart; i < ce.end; i++) ts = ts * 256 + buf[i];
        clusterMs = ts;
      } else if (ce.id === ID.SIMPLEBLOCK) {
        extractBlock(ce.dataStart, ce.end, clusterMs);
      } else if (ce.id === ID.BLOCKGROUP) {
        for (const bg of parseChildren(buf, ce.dataStart, ce.end)) {
          if (bg.id === ID.BLOCK) extractBlock(bg.dataStart, bg.end, clusterMs);
        }
      }
    }
  }

  if (packets.length === 0) throw new Error("WebM→OGG: no audio packets found");
  return { opusHead, packets };
}

export function remuxWebmOpusToOgg(input: Buffer): Buffer {
  const { opusHead, packets } = extractPackets(input);

  const SERIAL = 0x4F505553; // 'OPUS'
  let seq = 0;
  const pages: Buffer[] = [];

  // Page 1 — ID header (BOS, headerType=0x02)
  pages.push(writeOggPage(SERIAL, seq++, 0x02, 0, 0, [opusHead]));

  // Page 2 — Comment header (OpusTags)
  const vendor = Buffer.from("webm-opus-remux");
  const tags = Buffer.alloc(8 + 4 + vendor.length + 4);
  tags.write("OpusTags", 0, "ascii");
  tags.writeUInt32LE(vendor.length, 8);
  vendor.copy(tags, 12);
  tags.writeUInt32LE(0, 12 + vendor.length); // 0 user comments
  pages.push(writeOggPage(SERIAL, seq++, 0x00, 0, 0, [tags]));

  // Pages 3+ — audio data
  const SR = 48000;
  for (let i = 0; i < packets.length; i++) {
    const { data, ms } = packets[i];
    // Granule = sample count at 48kHz; fits in 32-bit for recordings < ~24h
    const granule = Math.round(ms * SR / 1000);
    const isLast = i === packets.length - 1;
    // EOS flag (0x04) on last page
    pages.push(writeOggPage(SERIAL, seq++, isLast ? 0x04 : 0x00, granule, 0, [data]));
  }

  return Buffer.concat(pages);
}

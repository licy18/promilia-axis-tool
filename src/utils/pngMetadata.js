const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const PNG_CHUNK_HEADER_SIZE = 8;
const PNG_CHUNK_CRC_SIZE = 4;
const PNG_CHUNK_OVERHEAD = PNG_CHUNK_HEADER_SIZE + PNG_CHUNK_CRC_SIZE;

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

export async function addPngTextMetadata(source, key, value) {
  const pngBytes = await toUint8Array(source);
  const chunks = parsePngChunks(pngBytes);
  const iend = chunks.find(chunk => chunk.type === 'IEND');
  if (!iend) {
    throw new Error('Invalid PNG: IEND chunk not found');
  }

  const textChunk = createPngTextChunk(key, value);
  const output = new Uint8Array(pngBytes.length + textChunk.length);
  output.set(pngBytes.subarray(0, iend.offset), 0);
  output.set(textChunk, iend.offset);
  output.set(pngBytes.subarray(iend.offset), iend.offset + textChunk.length);
  return new Blob([output], { type: 'image/png' });
}

export async function readPngTextMetadata(source, key) {
  const pngBytes = await toUint8Array(source);
  const normalizedKey = validatePngTextKey(key);
  const chunks = parsePngChunks(pngBytes);

  for (const chunk of chunks) {
    if (chunk.type !== 'tEXt') {
      continue;
    }
    const separatorIndex = chunk.data.indexOf(0);
    if (separatorIndex <= 0) {
      continue;
    }
    const chunkKey = decodeLatin1(chunk.data.subarray(0, separatorIndex));
    if (chunkKey === normalizedKey) {
      return decodeLatin1(chunk.data.subarray(separatorIndex + 1));
    }
  }
  return null;
}

export async function isPngSource(source) {
  try {
    const bytes = await toUint8Array(source);
    return hasPngSignature(bytes);
  } catch {
    return false;
  }
}

function parsePngChunks(bytes) {
  if (!hasPngSignature(bytes)) {
    throw new Error('Invalid PNG signature');
  }

  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  let foundIend = false;
  while (offset < bytes.length) {
    if (offset + PNG_CHUNK_OVERHEAD > bytes.length) {
      throw new Error('Invalid PNG: truncated chunk header');
    }
    const length = readUint32(bytes, offset);
    const dataOffset = offset + PNG_CHUNK_HEADER_SIZE;
    const crcOffset = dataOffset + length;
    const nextOffset = crcOffset + PNG_CHUNK_CRC_SIZE;
    if (nextOffset > bytes.length) {
      throw new Error('Invalid PNG: truncated chunk data');
    }

    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = decodeLatin1(typeBytes);
    const data = bytes.subarray(dataOffset, crcOffset);
    const expectedCrc = readUint32(bytes, crcOffset);
    const actualCrc = crc32(concatBytes(typeBytes, data));
    if (expectedCrc !== actualCrc) {
      throw new Error(`Invalid PNG: CRC mismatch in ${type}`);
    }

    chunks.push({ offset, length, type, data });
    offset = nextOffset;
    if (type === 'IEND') {
      foundIend = true;
      break;
    }
  }

  if (!foundIend || offset !== bytes.length) {
    throw new Error('Invalid PNG: malformed IEND');
  }
  return chunks;
}

function createPngTextChunk(key, value) {
  const keyBytes = encodeLatin1(validatePngTextKey(key));
  const valueBytes = encodeLatin1(String(value ?? ''));
  const typeBytes = encodeLatin1('tEXt');
  const data = new Uint8Array(keyBytes.length + 1 + valueBytes.length);
  data.set(keyBytes, 0);
  data[keyBytes.length] = 0;
  data.set(valueBytes, keyBytes.length + 1);

  const chunk = new Uint8Array(data.length + PNG_CHUNK_OVERHEAD);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, PNG_CHUNK_HEADER_SIZE);
  writeUint32(
    chunk,
    PNG_CHUNK_HEADER_SIZE + data.length,
    crc32(concatBytes(typeBytes, data))
  );
  return chunk;
}

function validatePngTextKey(key) {
  const normalized = String(key ?? '').trim();
  if (!normalized || normalized.length > 79 || normalized.includes('\0')) {
    throw new Error('Invalid PNG text key');
  }
  encodeLatin1(normalized);
  return normalized;
}

function encodeLatin1(value) {
  const text = String(value ?? '');
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 255) {
      throw new Error('PNG tEXt metadata must use Latin-1 characters');
    }
    bytes[index] = code;
  }
  return bytes;
}

function decodeLatin1(bytes) {
  let value = '';
  for (let index = 0; index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function hasPngSignature(bytes) {
  return (
    bytes.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  );
}

async function toUint8Array(source) {
  if (source instanceof Uint8Array) {
    return source;
  }
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }
  if (source?.arrayBuffer) {
    return new Uint8Array(await source.arrayBuffer());
  }
  throw new TypeError('PNG source must be a Blob, ArrayBuffer, or Uint8Array');
}

function concatBytes(...parts) {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0)
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readUint32(bytes, offset) {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).getUint32(offset, false);
}

function writeUint32(bytes, offset, value) {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(
    offset,
    value >>> 0,
    false
  );
}

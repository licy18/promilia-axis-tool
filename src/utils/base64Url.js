export function encodeBase64Url(text) {
  return encodeBase64(text)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

export function decodeBase64Url(code) {
  const base64 = String(code ?? '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const paddingLength = (4 - (base64.length % 4)) % 4;
  return decodeBase64(base64.padEnd(base64.length + paddingLength, '='));
}

function encodeBase64(text) {
  const buffer = globalThis.Buffer;
  if (typeof buffer?.from === 'function') {
    return buffer.from(text, 'utf8').toString('base64');
  }

  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(index, index + chunkSize)
      );
    }
    return btoa(binary);
  }

  throw new Error('Base64 encoding is not available.');
}

function decodeBase64(base64) {
  const buffer = globalThis.Buffer;
  if (typeof buffer?.from === 'function') {
    return buffer.from(base64, 'base64').toString('utf8');
  }

  if (typeof TextDecoder !== 'undefined' && typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  }

  throw new Error('Base64 decoding is not available.');
}

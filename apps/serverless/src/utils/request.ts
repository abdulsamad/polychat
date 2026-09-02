export type JsonBodyResult =
  | { success: true; body: unknown }
  | { success: false; status: 400 | 413 };

const isContentLengthTooLarge = (request: Request, maxBytes: number) => {
  const contentLength = request.headers.get('Content-Length');
  if (!contentLength) return false;

  const length = Number(contentLength);
  return Number.isFinite(length) && length > maxBytes;
};

export const readJsonBody = async (request: Request, maxBytes: number): Promise<JsonBodyResult> => {
  if (isContentLengthTooLarge(request, maxBytes)) {
    return { success: false, status: 413 };
  }

  if (!request.body) return { success: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { success: false, status: 413 };
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { success: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { success: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
};

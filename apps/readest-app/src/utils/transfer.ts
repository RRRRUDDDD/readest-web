export const enum UploadFileError {
  Unauthorized = 'Unauthorized access',
  DownloadFailed = 'File download failed',
}

export interface ProgressPayload {
  progress: number;
  total: number;
  transferSpeed: number;
}

export type ProgressHandler = (progress: ProgressPayload) => void;

export const webUpload = (
  file: File,
  uploadUrl: string,
  onProgress?: ProgressHandler,
  signal?: AbortSignal,
) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    const abort = () => xhr.abort();
    signal?.addEventListener('abort', abort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress({
          progress: event.loaded,
          total: event.total,
          transferSpeed: event.loaded / ((Date.now() - startTime) / 1000),
        });
      }
    };

    xhr.onload = () => {
      signal?.removeEventListener('abort', abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      signal?.removeEventListener('abort', abort);
      reject(new Error('Upload failed'));
    };

    xhr.onabort = () => {
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    xhr.send(file);
  });
};

export const webDownload = async (
  downloadUrl: string,
  onProgress?: ProgressHandler,
  headers?: Record<string, string>,
  signal?: AbortSignal,
) => {
  const response = await fetch(downloadUrl, {
    method: 'GET',
    headers: headers ? headers : undefined,
    signal,
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(UploadFileError.Unauthorized);
    }
    throw new Error(UploadFileError.DownloadFailed);
  }

  const responseHeaders = Object.fromEntries(response.headers.entries());
  const contentLength =
    response.headers.get('Content-Length') || response.headers.get('X-Content-Length');
  if (!contentLength && onProgress)
    throw new Error('Cannot track progress: Content-Length missing');

  const totalSize = parseInt(contentLength || '0', 10);
  let receivedSize = 0;
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];

  const startTime = Date.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedSize += value.length;

    if (onProgress) {
      onProgress({
        progress: receivedSize,
        total: totalSize,
        transferSpeed: receivedSize / ((Date.now() - startTime) / 1000),
      });
    }
  }

  return { headers: responseHeaders, blob: new Blob(chunks as BlobPart[]) };
};

export const tauriDownload = async (
  _downloadUrl: string,
  _filePath: string,
  _onProgress?: ProgressHandler,
): Promise<void> => {
  throw new Error('Native file download is not available in the web build');
};

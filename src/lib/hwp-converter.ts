import type { HwpImportOptions, HwpExportOptions } from '@/types/hwp';

// ---------- Worker-based file parsing ----------

export async function parseHwpFile(
  file: File,
  options?: Partial<HwpImportOptions>
): Promise<{ content: string; warnings: string[] }> {
  const buffer = await file.arrayBuffer();

  const defaultOptions: HwpImportOptions = {
    preserveStyles: true,
    convertTables: true,
    extractImages: false,
    imageFormat: 'base64',
    ...options,
  };

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/hwp-parser.worker.ts', import.meta.url)
    );

    let lastProgress = 0;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;

      switch (msg.type) {
        case 'progress':
          lastProgress = msg.percent;
          break;
        case 'complete':
          worker.terminate();
          resolve({
            content: msg.content || '',
            warnings: msg.warnings || [],
          });
          break;
        case 'error':
          worker.terminate();
          reject(new Error(msg.error || '파싱 중 오류가 발생했습니다.'));
          break;
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'Worker 오류가 발생했습니다.'));
    };

    worker.postMessage({
      type: 'parse',
      file: buffer,
      options: defaultOptions,
    });
  });
}

// ---------- Worker-based file generation ----------

export async function generateHwpFile(
  markdown: string,
  options?: Partial<HwpExportOptions>
): Promise<Blob> {
  const defaultOptions: HwpExportOptions = {
    paperSize: 'A4',
    orientation: 'portrait',
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 20,
    marginRight: 20,
    fontSize: 10,
    fontFamily: '맑은 고딕',
    lineHeight: 1.6,
    ...options,
  };

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/hwp-generator.worker.ts', import.meta.url)
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;

      switch (msg.type) {
        case 'progress':
          break;
        case 'complete':
          worker.terminate();
          resolve(new Blob([msg.buffer], { type: 'application/hwp+zip' }));
          break;
        case 'error':
          worker.terminate();
          reject(new Error(msg.error || '생성 중 오류가 발생했습니다.'));
          break;
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'Worker 오류가 발생했습니다.'));
    };

    worker.postMessage({
      type: 'generate',
      markdown,
      options: defaultOptions,
    });
  });
}

// ---------- Utility: parse with progress callback ----------

export function parseHwpFileWithProgress(
  file: File,
  onProgress: (percent: number, message: string) => void,
  options?: Partial<HwpImportOptions>
): Promise<{ content: string; warnings: string[] }> {
  const buffer = file.arrayBuffer();

  const defaultOptions: HwpImportOptions = {
    preserveStyles: true,
    convertTables: true,
    extractImages: false,
    imageFormat: 'base64',
    ...options,
  };

  return buffer.then(
    (buf) =>
      new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL('../workers/hwp-parser.worker.ts', import.meta.url)
        );

        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;

          switch (msg.type) {
            case 'progress':
              onProgress(msg.percent, msg.message);
              break;
            case 'complete':
              worker.terminate();
              resolve({
                content: msg.content || '',
                warnings: msg.warnings || [],
              });
              break;
            case 'error':
              worker.terminate();
              reject(new Error(msg.error || '파싱 중 오류가 발생했습니다.'));
              break;
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(err.message || 'Worker 오류가 발생했습니다.'));
        };

        worker.postMessage({
          type: 'parse',
          file: buf,
          options: defaultOptions,
        });
      })
  );
}

export function generateHwpFileWithProgress(
  markdown: string,
  onProgress: (percent: number, message: string) => void,
  options?: Partial<HwpExportOptions>
): Promise<Blob> {
  const defaultOptions: HwpExportOptions = {
    paperSize: 'A4',
    orientation: 'portrait',
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 20,
    marginRight: 20,
    fontSize: 10,
    fontFamily: '맑은 고딕',
    lineHeight: 1.6,
    ...options,
  };

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/hwp-generator.worker.ts', import.meta.url)
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;

      switch (msg.type) {
        case 'progress':
          onProgress(msg.percent, msg.message);
          break;
        case 'complete':
          worker.terminate();
          resolve(new Blob([msg.buffer], { type: 'application/hwp+zip' }));
          break;
        case 'error':
          worker.terminate();
          reject(new Error(msg.error || '생성 중 오류가 발생했습니다.'));
          break;
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'Worker 오류가 발생했습니다.'));
    };

    worker.postMessage({
      type: 'generate',
      markdown,
      options: defaultOptions,
    });
  });
}

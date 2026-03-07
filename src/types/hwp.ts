export interface HwpParserMessage {
  type: 'parse';
  id: string;
  buffer: ArrayBuffer;
  options?: HwpImportOptions;
}

export interface HwpParserResponse {
  type: 'parse-result';
  id: string;
  success: boolean;
  markdown?: string;
  error?: string;
  metadata?: HwpDocumentMetadata;
}

export interface HwpGenerateMessage {
  type: 'generate';
  id: string;
  markdown: string;
  options?: HwpExportOptions;
}

export interface HwpGenerateResponse {
  type: 'generate-result';
  id: string;
  success: boolean;
  buffer?: ArrayBuffer;
  error?: string;
}

export interface HwpImportOptions {
  preserveStyles: boolean;
  convertTables: boolean;
  extractImages: boolean;
  imageFormat: 'base64' | 'blob';
}

export interface HwpExportOptions {
  paperSize: 'A4' | 'Letter' | 'B5';
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
}

export interface HwpDocumentMetadata {
  title: string;
  author: string;
  date: string;
  pageCount: number;
  charCount: number;
}

export type HwpWorkerMessage = HwpParserMessage | HwpGenerateMessage;
export type HwpWorkerResponse = HwpParserResponse | HwpGenerateResponse;

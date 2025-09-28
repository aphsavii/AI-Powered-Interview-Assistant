import * as pdfjsLib from 'pdfjs-dist/build/pdf';
// Create a dedicated module worker so pdf.js doesn't attempt network fetch (avoids 404/fake worker)
// pdfjs-dist 4.x ships an ESM worker entry: pdf.worker.mjs
let workerPortInitialized = false;
try {
  const anyPdf: any = pdfjsLib;
  if (anyPdf.GlobalWorkerOptions && !anyPdf.GlobalWorkerOptions.workerPort) {
    const worker = new Worker(new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url), { type: 'module' });
    anyPdf.GlobalWorkerOptions.workerPort = worker;
    workerPortInitialized = true;
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('Failed to initialize pdf.js module worker', e);
}
import mammoth from 'mammoth';

// Configure worker only once
// Fallback: if module worker failed, attempt legacy workerSrc URL assignment
try {
  const anyPdf: any = pdfjsLib;
  if (!workerPortInitialized && anyPdf.GlobalWorkerOptions && !anyPdf.GlobalWorkerOptions.workerSrc) {
    const url = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
    anyPdf.GlobalWorkerOptions.workerSrc = url; // may still fetch as script if browser supports module workers differently
  }
} catch (e) {
  console.warn('Fallback workerSrc assignment failed', e);
}

export interface ExtractedInfo { name?: string; email?: string; phone?: string; rawText: string; }

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phoneRegex = /(\+?\d[\d\s\-()]{7,}\d)/;
const nameRegex = /([A-Z][a-z]+\s+[A-Z][a-z]+)/; // simplistic

export const extractEntities = (text: string): Omit<ExtractedInfo, 'rawText'> => {
  const email = text.match(emailRegex)?.[0];
  const phone = text.match(phoneRegex)?.[0];
  const name = text.match(nameRegex)?.[0];
  return { email, phone, name };
};

export async function parsePdf(file: File): Promise<ExtractedInfo> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ') + '\n';
  }
  return { rawText: fullText, ...extractEntities(fullText) };
}

export async function parseDocx(file: File): Promise<ExtractedInfo> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const raw = result.value;
  return { rawText: raw, ...extractEntities(raw) };
}

export async function parseResume(file: File): Promise<ExtractedInfo> {
  if (file.name.toLowerCase().endsWith('.pdf')) return parsePdf(file);
  if (file.name.toLowerCase().endsWith('.docx')) return parseDocx(file);
  throw new Error('Unsupported file type');
}

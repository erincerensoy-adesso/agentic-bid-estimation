/** Server-side RFP text extraction (spec 5.1). Nothing is written to disk. */
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export const RFP_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export interface RfpDocument {
  fileName: string;
  /** Text with page markers (PDF) so the LLM can cite a location. */
  text: string;
}

export class RfpError extends Error {}

export async function extractRfpText(fileName: string, data: Uint8Array): Promise<RfpDocument> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: false });
    return {
      fileName,
      text: text.map((t, i) => `[Page ${i + 1}]\n${t}`).join("\n\n"),
    };
  }
  if (lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return { fileName, text: value };
  }
  throw new RfpError(`${fileName}: only PDF and DOCX files are accepted.`);
}

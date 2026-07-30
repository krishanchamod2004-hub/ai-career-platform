import { BadRequestException, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

const logger = new Logger('ResumePdfParser');

/** Resumes over this length are almost certainly a parsing artifact, not a real CV. */
export const MAX_RESUME_TEXT_CHARS = 20_000;

/**
 * Extracts plain text from an uploaded PDF buffer.
 *
 * Runs at upload time, once — the AI ATS scorer only ever sees the extracted
 * text afterward, never the binary, so a corrupt or password-protected PDF
 * fails loudly here instead of surfacing as a confusing AI-provider error later.
 */
export async function extractResumeText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.replace(/\r/g, '').trim();

    if (text.length === 0) {
      throw new BadRequestException(
        'Could not extract any text from this PDF. It may be a scanned image without a text layer.',
      );
    }

    return text.length > MAX_RESUME_TEXT_CHARS
      ? text.slice(0, MAX_RESUME_TEXT_CHARS)
      : text;
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    logger.warn(`PDF text extraction failed: ${(error as Error).message}`);
    throw new BadRequestException(
      'This file could not be read as a PDF. Password-protected and corrupted files are not supported.',
    );
  } finally {
    // Frees the underlying pdf.js document; leaking these adds up under load.
    await parser.destroy();
  }
}

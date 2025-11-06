import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

/**
 * Helper functions for creating test files programmatically
 */

/**
 * Create a test PDF file
 */
export function createTestPDF(filename: string, content: string = 'Test PDF Content'): string {
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length ${content.length + 30}
>>
stream
BT
/F1 12 Tf
100 700 Td
(${content}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${300 + content.length}
%%EOF`;

  const tempDir = join(process.cwd(), 'tests', 'temp');
  mkdirSync(tempDir, { recursive: true });
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, pdfContent);
  return filePath;
}

/**
 * Create a test DOCX file (minimal valid structure)
 */
export async function createTestDOCX(filename: string, content: string = 'Test DOCX Content'): Promise<string> {
  // Use the 'docx' library to create a valid DOCX file
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun(content)
          ]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  
  const tempDir = join(process.cwd(), 'tests', 'temp');
  mkdirSync(tempDir, { recursive: true });
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Create a test image file (PNG)
 */
export function createTestImage(filename: string): string {
  // Minimal 1x1 transparent PNG
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // 8-bit RGBA
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, // compressed data
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, // CRC
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
    0x42, 0x60, 0x82
  ]);

  const tempDir = join(process.cwd(), 'tests', 'temp');
  mkdirSync(tempDir, { recursive: true });
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, pngData);
  return filePath;
}

/**
 * Create a test text file
 */
export function createTestTextFile(filename: string, content: string = 'Test text file content'): string {
  const tempDir = join(process.cwd(), 'tests', 'temp');
  mkdirSync(tempDir, { recursive: true });
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, content);
  return filePath;
}

/**
 * Create a test CSV file
 */
export function createTestCSV(filename: string, rows: string[][] = [['Column1', 'Column2'], ['Value1', 'Value2']]): string {
  const csvContent = rows.map(row => row.join(',')).join('\n');
  const tempDir = join(process.cwd(), 'tests', 'temp');
  mkdirSync(tempDir, { recursive: true });
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, csvContent);
  return filePath;
}

/**
 * Create an invalid file type for testing validation
 */
export function createInvalidFile(filename: string): string {
  const content = 'This is an invalid file type for testing';
  const tempDir = join(process.cwd(), 'tests', 'temp');
  mkdirSync(tempDir, { recursive: true });
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, content);
  return filePath;
}

/**
 * Create a large file for testing size limits
 */
export function createLargeFile(filename: string, sizeInMB: number = 10): string {
  const oneMB = 1024 * 1024;
  const content = 'X'.repeat(sizeInMB * oneMB);
  const tempDir = join(process.cwd(), 'tests', 'temp');
  mkdirSync(tempDir, { recursive: true });
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, content);
  return filePath;
}

/**
 * PDF Processing Utility
 * Handles PDF text extraction with character limits
 */

export interface PDFProcessingResult {
  success: boolean;
  text?: string;
  error?: string;
  characterCount?: number;
  pageCount?: number;
}

/**
 * Extract text from a PDF file
 * @param file The PDF file to process
 * @param maxCharacters Maximum allowed characters (default: 25000)
 * @returns Promise with processing result
 */
export async function extractTextFromPDF(
  file: File, 
  maxCharacters: number = 25000
): Promise<PDFProcessingResult> {
  try {
    // Check file type
    if (file.type !== 'application/pdf') {
      return {
        success: false,
        error: 'File is not a PDF'
      };
    }

    // Check file size (rough estimate: 1MB = ~1000 pages)
    const maxFileSize = 50 * 1024 * 1024; // 50MB limit
    if (file.size > maxFileSize) {
      return {
        success: false,
        error: 'PDF file is too large (max 50MB)'
      };
    }

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Import pdf-parse dynamically to avoid issues with Node.js modules in browser
    const { PDFParse } = await import('pdf-parse');
    
    // Set up the worker for browser environment
    PDFParse.setWorker('/pdf.worker.min.js');
    
    // Create PDFParse instance with the array buffer
    const pdfParser = new PDFParse({ data: arrayBuffer });
    
    // Extract text from the PDF
    const textResult = await pdfParser.getText();
    const text = textResult.text.trim();
    const characterCount = text.length;
    const pageCount = textResult.pages.length;
    
    // Clean up the parser
    await pdfParser.destroy();
    
    // Check character limit
    if (characterCount > maxCharacters) {
      return {
        success: false,
        error: `PDF text is too long (${characterCount.toLocaleString()} characters). Maximum allowed: ${maxCharacters.toLocaleString()} characters.`,
        characterCount,
        pageCount
      };
    }
    
    return {
      success: true,
      text,
      characterCount,
      pageCount
    };
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    return {
      success: false,
      error: `Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Format PDF processing result for display
 * @param result The processing result
 * @returns Formatted string for UI display
 */
export function formatPDFResult(result: PDFProcessingResult): string {
  if (!result.success) {
    return `❌ ${result.error}`;
  }
  
  const pageInfo = result.pageCount ? ` (${result.pageCount} pages)` : '';
  const charInfo = result.characterCount ? ` (${result.characterCount.toLocaleString()} characters)` : '';
  
  return `✅ PDF processed successfully${pageInfo}${charInfo}`;
}

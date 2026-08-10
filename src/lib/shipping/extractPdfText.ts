import { PDFParse } from 'pdf-parse'

// Solo PDF trae texto real incrustado para poder leerlo — una imagen
// (PNG/JPG) requeriría OCR, que no está implementado a propósito (ver
// carrierDetection.ts: mejor no detectar nada que inventar mal). Un PDF
// corrupto o protegido con contraseña simplemente no matchea nada río abajo.
export async function extractPdfText(bytes: Buffer): Promise<string | null> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(bytes) })
    const result = await parser.getText()
    await parser.destroy()
    return result.text
  } catch {
    return null
  }
}

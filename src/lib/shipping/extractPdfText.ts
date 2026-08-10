// Solo PDF trae texto real incrustado para poder leerlo — una imagen
// (PNG/JPG) requeriría OCR, que no está implementado a propósito (ver
// carrierDetection.ts: mejor no detectar nada que inventar mal). Un PDF
// corrupto o protegido con contraseña simplemente no matchea nada río abajo.
//
// Import dinámico (no en el top del archivo) y try/catch envolviendo TODO,
// incluido el import: en Vercel, algunas librerías basadas en pdf.js pueden
// fallar al inicializar (ej. cargar su WebAssembly) de forma distinta a
// como corren en local — si eso pasa, esto lo atrapa igual y cae a "no
// detectado" en vez de tirar la ruta entera abajo con un 500.
export async function extractPdfText(bytes: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(bytes), useWasm: false })
    const result = await parser.getText()
    await parser.destroy()
    return result.text
  } catch {
    return null
  }
}

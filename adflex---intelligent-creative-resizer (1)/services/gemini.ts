
import { GoogleGenAI } from "@google/genai";
import { AdFormat } from "../types";

const getClosestAspectRatio = (w: number, h: number): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.1) return "1:1";
  if (Math.abs(ratio - (9 / 16)) < 0.1) return "9:16";
  if (Math.abs(ratio - (16 / 9)) < 0.1) return "16:9";
  if (Math.abs(ratio - (3 / 4)) < 0.1) return "3:4";
  if (Math.abs(ratio - (4 / 3)) < 0.1) return "4:3";
  return ratio > 1.2 ? "16:9" : ratio < 0.8 ? "9:16" : "1:1";
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const adaptImageToFormat = async (
  originalBase64: string,
  format: AdFormat,
  manualInstruction?: string,
  retryCount = 0
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const mimeTypeMatch = originalBase64.match(/^data:(.*);base64,/);
  let mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
  
  if (mimeType.includes('postscript') || mimeType.includes('octet-stream')) {
    mimeType = 'application/pdf';
  }
  
  const base64Data = originalBase64.split(',')[1];
  const targetRatio = getClosestAspectRatio(format.width, format.height);
  
  const prompt = `ACTÚA COMO: Director de Arte Senior y Experto en Layout Responsivo.
  
  TAREA: RECOMPONER el diseño maestro para el formato ${format.width}x${format.height}px (${targetRatio}).
  
  INSTRUCCIONES CRÍTICAS:
  1. RECOMPOSICIÓN DINÁMICA: No estires el lienzo. Debes MOVER, REUBICAR y ESCALAR los elementos clave (Logo, Títulos, Imagen de Producto y Botón) para que se vean perfectos en el nuevo tamaño.
  2. DISTRIBUCIÓN:
     - En formatos VERTICALES (${format.width}x${format.height}): Crea una jerarquía vertical (Logo arriba, contenido central, CTA abajo). Centra los textos.
     - En formatos HORIZONTALES: Distribuye los elementos para crear balance lateral.
  3. ESCALA INTELIGENTE: Escala los elementos para ocupar el espacio de forma armoniosa, pero NUNCA los deformes ni alteres su aspect ratio original.
  4. FONDO: Extiende el fondo original de forma que cubra toda la superficie de ${format.width}x${format.height} de manera natural.
  5. EXPORTACIÓN: El resultado debe ser una imagen PNG nítida, profesional y exportada a 72 DPI.
  ${manualInstruction ? `6. AJUSTE ADICIONAL: ${manualInstruction}` : ''}
  
  SALIDA: Devuelve ÚNICAMENTE la imagen resultante en formato PNG.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: targetRatio
        }
      }
    });

    if (!response.candidates?.[0]) throw new Error("La IA no generó una respuesta válida.");

    const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }
    
    throw new Error("La respuesta de la IA no contiene una imagen procesable.");
  } catch (error: any) {
    if ((error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) && retryCount < 2) {
      console.warn(`Límite de cuota (429). Reintentando en ${4000 * (retryCount + 1)}ms...`);
      await delay(4000 * (retryCount + 1));
      return adaptImageToFormat(originalBase64, format, manualInstruction, retryCount + 1);
    }
    
    if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Límite de cuota excedido. Por favor, genera las piezas de una en una o espera un momento.");
    }
    
    throw new Error(error.message || "Error inesperado en el motor de diseño.");
  }
};

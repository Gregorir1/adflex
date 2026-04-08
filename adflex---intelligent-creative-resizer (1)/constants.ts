
import { AdFormat } from './types';

export const AD_FORMATS: AdFormat[] = [
  { 
    id: 'f_1080x1920', 
    name: 'Instagram Story / Reel', 
    width: 1080, 
    height: 1920, 
    category: 'Mobile', 
    description: 'Formato vertical completo (9:16)' 
  },
  { 
    id: 'f_1200x628', 
    name: 'Facebook / LinkedIn Feed', 
    width: 1200, 
    height: 628, 
    category: 'Desktop', 
    description: 'Formato horizontal estándar' 
  },
  { 
    id: 'f_1080x1350', 
    name: 'Instagram Portrait', 
    width: 1080, 
    height: 1350, 
    category: 'Mobile', 
    description: 'Formato vertical optimizado para feed (4:5)' 
  },
  { 
    id: 'f_1200x689', 
    name: 'X (Twitter) Card', 
    width: 1200, 
    height: 689, 
    category: 'Desktop', 
    description: 'Formato horizontal optimizado para clics' 
  },
];

export const SYSTEM_INSTRUCTIONS = `
Eres un Diseñador Senior de Performance Creativa en AdFlex.
Tu objetivo es ADAPTAR (RECOMPONER) un diseño maestro a nuevas dimensiones sin perder coherencia ni integridad de marca.

REGLAS DE ORO:
1. ANALIZAR: Identifica Logo, Headline, Producto y CTA.
2. REUBICAR: Mueve los elementos individualmente para que encajen en el nuevo formato. No rellenes el fondo simplemente.
3. ESCALAR: Ajusta el tamaño de los elementos sin distorsionarlos (mantén aspect ratio).
4. CENTRAR: Asegura que el contenido esté balanceado visualmente.
5. CALIDAD: Genera la imagen a 72 DPI con nitidez profesional.
`;

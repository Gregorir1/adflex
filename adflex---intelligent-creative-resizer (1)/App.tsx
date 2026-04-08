
import React, { useState, useRef } from 'react';
import { AD_FORMATS } from './constants';
import { AdFormat, DesignState, GeneratedAd } from './types';
import { adaptImageToFormat } from './services/gemini';
import { 
  CloudArrowUpIcon, 
  ArrowPathIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  PhotoIcon,
  Squares2X2Icon,
  DocumentIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  PencilSquareIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

/**
 * Redimensiona una imagen base64 a las dimensiones exactas utilizando Canvas.
 * Esto asegura que el archivo final tenga los píxeles solicitados por el usuario.
 */
const resizeImageToExactDimensions = (base64: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Suavizado de imagen para mejor calidad al escalar
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = base64;
  });
};

export default function App() {
  const [state, setState] = useState<DesignState>({
    originalImage: null,
    formats: AD_FORMATS,
    results: {},
    isProcessing: false,
  });
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(AD_FORMATS.map(f => f.id));
  const [editingAd, setEditingAd] = useState<{id: string, format: AdFormat} | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAdeptFile(file);
    }
  };

  const processAdeptFile = async (file: File) => {
    setIsParsingFile(true);
    setHasGenerated(false);
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      if (extension === 'psd') {
        const PSDLib = (window as any).PSD;
        if (!PSDLib) {
          setTimeout(() => processAdeptFile(file), 1000);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
            const psd = new PSDLib(buffer);
            psd.parse();
            const canvas = psd.image.toCanvas();
            setState(prev => ({ 
              ...prev, 
              originalImage: canvas.toDataURL('image/png'), 
              results: {} 
            }));
          } catch (err: any) {
            alert("Error: El archivo PSD debe guardarse con 'Maximizar compatibilidad' activado.");
          }
          setIsParsingFile(false);
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'ai') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const result = e.target?.result as string;
          try {
             const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
             if (pdfjsLib) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const loadingTask = pdfjsLib.getDocument({data: atob(result.split(',')[1])});
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({scale: 2.0});
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({canvasContext: context, viewport: viewport}).promise;
                setState(prev => ({ ...prev, originalImage: canvas.toDataURL('image/png'), results: {} }));
             } else {
                setState(prev => ({ ...prev, originalImage: result, results: {} }));
             }
          } catch (err) {
             setState(prev => ({ ...prev, originalImage: result, results: {} }));
          }
          setIsParsingFile(false);
        };
        reader.readAsDataURL(file);
      } else {
        alert("Sube un archivo .PSD o .AI maestro.");
        setIsParsingFile(false);
      }
    } catch (error: any) {
      alert(error.message);
      setIsParsingFile(false);
    }
  };

  const processAdaptation = async () => {
    if (!state.originalImage || selectedFormats.length === 0) return;
    
    setHasGenerated(true);
    setState(prev => ({ ...prev, isProcessing: true }));
    
    const initialResults: Record<string, GeneratedAd> = {};
    selectedFormats.forEach(id => {
      initialResults[id] = { formatId: id, imageUrl: '', status: 'processing' };
    });
    setState(prev => ({ ...prev, results: initialResults }));

    for (let i = 0; i < selectedFormats.length; i++) {
      const id = selectedFormats[i];
      const format = AD_FORMATS.find(f => f.id === id);
      if (!format) continue;

      try {
        if (i > 0) await new Promise(res => setTimeout(res, 2000));
        
        const aiResultUrl = await adaptImageToFormat(state.originalImage, format);
        
        // Redimensionamiento exacto antes de mostrar/guardar
        const finalUrl = await resizeImageToExactDimensions(aiResultUrl, format.width, format.height);
        
        setState(prev => ({
          ...prev,
          results: { ...prev.results, [id]: { formatId: id, imageUrl: finalUrl, status: 'completed' } }
        }));
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          results: { ...prev.results, [id]: { formatId: id, imageUrl: '', status: 'error', error: error.message } }
        }));
      }
    }
    setState(prev => ({ ...prev, isProcessing: false }));
  };

  const handleManualRefine = async () => {
    if (!editingAd || !state.originalImage) return;
    const { format } = editingAd;
    const id = format.id;

    setState(prev => ({
      ...prev,
      results: { ...prev.results, [id]: { ...prev.results[id], status: 'processing' } }
    }));
    setEditingAd(null);

    try {
      const aiResultUrl = await adaptImageToFormat(state.originalImage, format, editPrompt);
      
      // Redimensionamiento exacto tras refinamiento
      const finalUrl = await resizeImageToExactDimensions(aiResultUrl, format.width, format.height);
      
      setState(prev => ({
        ...prev,
        results: { ...prev.results, [id]: { formatId: id, imageUrl: finalUrl, status: 'completed' } }
      }));
      setEditPrompt("");
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        results: { ...prev.results, [id]: { formatId: id, imageUrl: '', status: 'error', error: error.message } }
      }));
    }
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 selection:bg-indigo-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-900 p-2 rounded-xl">
              <Squares2X2Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">AdFlex</h1>
              <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-[0.3em] mt-1">Creative Automation Engine</p>
            </div>
          </div>
          <button
            onClick={processAdaptation}
            disabled={!state.originalImage || state.isProcessing || selectedFormats.length === 0}
            className={`flex items-center space-x-2 px-8 py-3 rounded-full text-[11px] font-black uppercase transition-all transform active:scale-95 ${
              !state.originalImage || state.isProcessing || selectedFormats.length === 0
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100'
            }`}
          >
            {state.isProcessing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
            <span>{state.isProcessing ? 'Adaptando Pautas...' : 'Generar Pautas'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <aside className="lg:col-span-3 space-y-8">
            <section className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-5 flex items-center">
                <DocumentIcon className="h-4 w-4 mr-2 text-indigo-500" />
                Diseño Maestro
              </h2>
              
              {!state.originalImage && !isParsingFile ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-100 rounded-3xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                  <CloudArrowUpIcon className="h-10 w-10 text-slate-300 mx-auto mb-4 group-hover:text-indigo-500 transition-transform" />
                  <p className="text-[11px] font-black text-slate-600 uppercase">Subir Maestro</p>
                  <p className="text-[9px] text-slate-400 mt-2">PSD o AI</p>
                </div>
              ) : isParsingFile ? (
                <div className="bg-slate-50 rounded-3xl p-8 text-center border border-indigo-100 py-16">
                  <ArrowPathIcon className="h-10 w-10 text-indigo-500 animate-spin mx-auto mb-4" />
                  <p className="text-[10px] font-black text-slate-600 uppercase">Analizando capas...</p>
                </div>
              ) : (
                <div className="relative group bg-white rounded-3xl overflow-hidden aspect-square border-2 border-slate-100 shadow-xl p-2">
                  <img src={state.originalImage!} alt="Source" className="w-full h-full object-contain rounded-2xl" />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm rounded-2xl">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-900 text-[10px] font-black px-6 py-2 rounded-xl uppercase">Cambiar</button>
                  </div>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".psd,.ai" className="hidden" />
            </section>

            <section className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-5">Formatos de Salida</h2>
              <div className="space-y-2.5">
                {AD_FORMATS.map(format => (
                  <label key={format.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${selectedFormats.includes(format.id) ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-50 hover:border-slate-200 bg-slate-50/30'}`}>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-black text-slate-800 tracking-tight">{format.width}x{format.height}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{format.name}</span>
                    </div>
                    <input type="checkbox" checked={selectedFormats.includes(format.id)} onChange={() => setSelectedFormats(prev => prev.includes(format.id) ? prev.filter(i => i !== format.id) : [...prev, format.id])} className="w-5 h-5 text-indigo-600 border-slate-200 rounded-lg" />
                  </label>
                ))}
              </div>
            </section>
          </aside>

          <section className="lg:col-span-9">
            <div className="bg-white min-h-[700px] p-8 rounded-[3rem] border border-slate-200 shadow-sm relative">
              {!hasGenerated ? (
                <div className="h-full flex flex-col items-center justify-center py-40 opacity-20 grayscale">
                  <PhotoIcon className="h-32 w-32 text-slate-200 mb-8" />
                  <h3 className="text-xl font-black text-slate-900 uppercase italic">Creative Studio</h3>
                  <p className="text-[12px] text-slate-400 mt-2 text-center">Sube tu diseño maestro para comenzar la recomposición.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in duration-700">
                  {selectedFormats.map(id => {
                    const result = state.results[id];
                    const format = AD_FORMATS.find(f => f.id === id);
                    if (!format) return null;

                    return (
                      <div key={id} className="group flex flex-col bg-slate-50 rounded-[2.5rem] border border-slate-200 overflow-hidden hover:border-indigo-400 hover:shadow-2xl transition-all">
                        <div className="px-8 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[15px] font-black text-slate-900 uppercase tracking-tighter">{format.width}x{format.height}</span>
                            <span className="text-[9px] text-indigo-500 font-bold uppercase">{format.name}</span>
                          </div>
                          
                          {result?.status === 'completed' && (
                            <div className="flex items-center space-x-2">
                              <button onClick={() => setEditingAd({id, format})} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center space-x-2">
                                <PencilSquareIcon className="h-4 w-4" />
                                <span className="text-[9px] font-black uppercase">Re-Adaptar</span>
                              </button>
                              <button onClick={() => downloadImage(result.imageUrl, `AdFlex_${format.width}x${format.height}`)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center space-x-2">
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                <span className="text-[9px] font-black uppercase">Descargar</span>
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 p-8 flex items-center justify-center min-h-[400px] bg-white relative">
                          {!result || result.status === 'processing' ? (
                            <div className="flex flex-col items-center">
                              <div className="h-14 w-14 border-[5px] border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                              <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest animate-pulse italic">Recomponiendo...</span>
                            </div>
                          ) : result.status === 'error' ? (
                            <div className="text-center p-8 bg-rose-50 rounded-3xl border border-rose-100 max-w-[280px]">
                              <ExclamationCircleIcon className="h-10 w-10 text-rose-400 mx-auto mb-4" />
                              <span className="text-[10px] text-rose-600 font-black uppercase">Error de Render</span>
                              <p className="text-[9px] text-slate-500 mt-2 font-medium leading-relaxed">{result.error}</p>
                            </div>
                          ) : (
                            <div className="relative shadow-2xl transition-transform hover:scale-[1.02] w-full flex justify-center">
                              <img src={result.imageUrl} alt="Ad Result" className="max-w-full rounded-lg border-[3px] border-slate-100 bg-white shadow-sm" style={{ maxHeight: '500px', objectFit: 'contain' }} />
                            </div>
                          )}
                        </div>
                        <div className="px-8 py-3.5 bg-white border-t border-slate-50 flex items-center justify-between">
                           <span className="text-[9px] text-slate-400 font-bold uppercase">Resolución: 72 DPI</span>
                           <div className="flex space-x-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
            <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-3"><AdjustmentsHorizontalIcon className="h-6 w-6 text-indigo-600" /><h3 className="text-xl font-black text-slate-900 uppercase italic">Ajuste Manual IA</h3></div>
              <button onClick={() => setEditingAd(null)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <div className="p-10 space-y-6">
              <p className="text-[12px] text-slate-500 font-medium">Define qué elementos mover o escalar específicamente para este formato.</p>
              <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Ej: 'Mueve el producto a la izquierda y el CTA a la derecha'..." className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-inner" />
              <button onClick={handleManualRefine} className="w-full py-4 text-[11px] font-black uppercase text-white bg-indigo-600 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2"><span>Aplicar Cambio</span><SparklesIcon className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

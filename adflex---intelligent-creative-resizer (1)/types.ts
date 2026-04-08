
export interface AdFormat {
  id: string;
  name: string;
  width: number;
  height: number;
  category: 'Mobile' | 'Desktop';
  description: string;
}

export interface GeneratedAd {
  formatId: string;
  imageUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface DesignState {
  originalImage: string | null;
  formats: AdFormat[];
  results: Record<string, GeneratedAd>;
  isProcessing: boolean;
}

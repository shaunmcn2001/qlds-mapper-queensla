import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ParcelSearch } from '@/components/ParcelSearch';
import { LayerPicker } from '@/components/LayerPicker';
import { MapView } from '@/components/MapView';
import { PreviewTable } from '@/components/PreviewTable';
import { ExportPanel } from '@/components/ExportPanel';
import { intersectLayers } from '@/lib/gis';
import { useKV } from '@github/spark/hooks';
import type { Parcel, Feature } from '@/types';

function App() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedLayers, setSelectedLayers] = useKV<string[]>('selected-layers', []);
  const [features, setFeatures] = useState<Record<string, Feature[]>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handleParcelResolved = (resolvedParcels: Parcel[]) => {
    setParcels(resolvedParcels);
    setFeatures({});
    setIsResolving(false);
  };

  const handlePreview = async () => {
    if (parcels.length === 0 || selectedLayers.length === 0) return;
    
    setIsPreviewing(true);
    try {
      const intersectionResults = await intersectLayers(parcels[0], selectedLayers);
      setFeatures(intersectionResults);
    } catch (error) {
      console.error('Failed to preview intersections:', error);
    } finally {
      setIsPreviewing(false);
    }
  };

  const canPreview = parcels.length > 0 && selectedLayers.length > 0;
  const canExport = parcels.length > 0 && Object.keys(features).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Q</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">QLD Parcel GIS Explorer</h1>
              <p className="text-sm text-muted-foreground">
                Resolve parcels and intersect with spatial layers
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            <ParcelSearch 
              onParcelResolved={handleParcelResolved}
              isLoading={isResolving}
            />
            
            <LayerPicker
              selectedLayers={selectedLayers}
              onSelectionChange={setSelectedLayers}
              onPreview={handlePreview}
              canPreview={canPreview}
              isLoading={isPreviewing}
            />
            
            <ExportPanel
              parcels={parcels}
              features={features}
              canExport={canExport}
            />
          </div>

          {/* Right Column - Map and Results */}
          <div className="lg:col-span-2 space-y-6">
            <MapView
              parcels={parcels}
              features={features}
              selectedLayers={selectedLayers}
            />
            
            {(isPreviewing || Object.keys(features).length > 0) && (
              <PreviewTable
                features={features}
                selectedLayers={selectedLayers}
              />
            )}
          </div>
        </div>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App
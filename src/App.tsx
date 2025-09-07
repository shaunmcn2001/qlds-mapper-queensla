import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { ParcelSearch } from '@/components/ParcelSearch';
import { LayerPicker } from '@/components/LayerPicker';
import { MapView } from '@/components/MapView';
import { PreviewTable } from '@/components/PreviewTable';
import { ExportPanel } from '@/components/ExportPanel';
import { intersectLayers } from '@/lib/gis';
import type { Parcel, Feature } from '@/types';

function App() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [features, setFeatures] = useState<Record<string, Feature[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleParcelResolved = (resolvedParcels: Parcel[]) => {
    setParcels(resolvedParcels);
    setFeatures({}); // Clear previous features
  };

  const handlePreview = async () => {
    if (parcels.length === 0 || selectedLayers.length === 0) return;
    
    setIsPreviewLoading(true);
    try {
      const intersectedFeatures = await intersectLayers(parcels[0], selectedLayers);
      setFeatures(intersectedFeatures);
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const canPreview = parcels.length > 0 && selectedLayers.length > 0;
  const canExport = parcels.length > 0 && Object.keys(features).length > 0;
  const hasPreviewData = Object.keys(features).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
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
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <ParcelSearch
              onParcelResolved={handleParcelResolved}
              isLoading={isLoading}
            />
            
            <LayerPicker
              selectedLayers={selectedLayers}
              onSelectionChange={setSelectedLayers}
              onPreview={handlePreview}
              canPreview={canPreview}
              isLoading={isPreviewLoading}
            />
            
            <ExportPanel
              parcels={parcels}
              features={features}
              canExport={canExport}
            />
          </div>
          
          {/* Middle Panel - Map */}
          <div className="space-y-6">
            <MapView
              parcels={parcels}
              features={features}
              selectedLayers={selectedLayers}
            />
            
            {hasPreviewData && (
              <PreviewTable
                features={features}
                selectedLayers={selectedLayers}
              />
            )}
          </div>
          
          {/* Right Panel - Info */}
          <div className="space-y-6">
            {!hasPreviewData && (
              <div className="bg-muted/50 rounded-lg p-6 text-center">
                <h3 className="font-medium mb-2">Getting Started</h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>1. Enter a Queensland Lot/Plan reference</p>
                  <p>2. Select spatial layers to intersect</p>
                  <p>3. Preview intersections on the map</p>
                  <p>4. Export results as KML or GeoJSON</p>
                </div>
              </div>
            )}
            
            {parcels.length > 0 && (
              <div className="bg-card border rounded-lg p-4">
                <h3 className="font-medium mb-3">Resolved Parcels</h3>
                <div className="space-y-2">
                  {parcels.map((parcel, index) => (
                    <div key={parcel.id} className="flex justify-between text-sm">
                      <span className="font-mono">{parcel.lotPlan}</span>
                      <span className="text-muted-foreground">
                        {parcel.area.toLocaleString()} m²
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {hasPreviewData && (
              <div className="bg-card border rounded-lg p-4">
                <h3 className="font-medium mb-3">Layer Summary</h3>
                <div className="space-y-2">
                  {selectedLayers.map(layerId => {
                    const layerFeatures = features[layerId] || [];
                    return (
                      <div key={layerId} className="flex justify-between text-sm">
                        <span className="capitalize">{layerId.replace('_', ' ')}</span>
                        <span className="text-muted-foreground">
                          {layerFeatures.length} feature{layerFeatures.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App
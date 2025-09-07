import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Card } from '@/components/ui/card';
import type { Parcel, Feature, LayerConfig } from '@/types';
import { getLayers } from '@/lib/gis';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapViewProps {
  parcels: Parcel[];
  features: Record<string, Feature[]>;
  selectedLayers: string[];
}

export function MapView({ parcels, features, selectedLayers }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerId = 'map-container';
  const layers = getLayers();
  
  useEffect(() => {
    if (!mapRef.current) {
      // Initialize map
      const map = L.map(containerId, {
        center: [-27.4705, 153.0245],
        zoom: 15,
        zoomControl: true,
        attributionControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      mapRef.current = map;
    }

    const map = mapRef.current;
    
    // Clear existing layers (except base tile layer)
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) return;
      map.removeLayer(layer);
    });

    // Add parcel boundaries
    if (parcels.length > 0) {
      const parcelGroup = L.layerGroup();
      
      parcels.forEach(parcel => {
        const polygon = L.polygon(
          parcel.geometry.coordinates[0].map(coord => [coord[1], coord[0]] as L.LatLngExpression),
          {
            color: '#1f77b4',
            fillColor: '#1f77b4',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.1
          }
        );
        
        polygon.bindPopup(`
          <div class="font-medium">${parcel.lotPlan}</div>
          <div class="text-sm text-muted-foreground">Area: ${parcel.area.toLocaleString()} m²</div>
        `);
        
        parcelGroup.addLayer(polygon);
      });
      
      parcelGroup.addTo(map);
      
      // Fit map to parcels
      const bounds = L.latLngBounds(
        parcels.map(p => p.geometry.coordinates[0].map(coord => [coord[1], coord[0]] as L.LatLngExpression)).flat()
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Add intersected features
    selectedLayers.forEach(layerId => {
      const layerFeatures = features[layerId];
      if (!layerFeatures) return;
      
      const layerConfig = layers.find(l => l.id === layerId);
      if (!layerConfig) return;
      
      const featureGroup = L.layerGroup();
      
      layerFeatures.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          const polygon = L.polygon(
            feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]] as L.LatLngExpression),
            {
              color: layerConfig.style.color,
              fillColor: layerConfig.style.color,
              weight: layerConfig.style.lineWidth,
              opacity: layerConfig.style.lineOpacity,
              fillOpacity: layerConfig.style.polyOpacity
            }
          );
          
          // Create popup content
          const popupContent = createPopupContent(feature, layerConfig);
          polygon.bindPopup(popupContent);
          
          featureGroup.addLayer(polygon);
        }
      });
      
      featureGroup.addTo(map);
    });

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [parcels, features, selectedLayers]);

  return (
    <Card className="overflow-hidden">
      <div 
        id={containerId} 
        className="h-96 w-full"
        style={{ minHeight: '400px' }}
      />
    </Card>
  );
}

function createPopupContent(feature: Feature, layerConfig: LayerConfig): string {
  const { properties } = feature;
  const { popup, fields } = layerConfig;
  
  let content = `<div class="font-medium mb-2">${feature.displayName}</div>`;
  
  const fieldsToShow = popup.order.length > 0 ? popup.order : fields.include;
  
  fieldsToShow.forEach(field => {
    const value = properties[field];
    if (popup.hideNull && (value == null || value === '')) return;
    
    const label = fields.aliases[field] || field;
    content += `<div class="text-sm"><strong>${label}:</strong> ${value || 'N/A'}</div>`;
  });
  
  return content;
}
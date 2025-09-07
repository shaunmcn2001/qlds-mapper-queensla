export interface ParcelInput {
  input: string;
  normalized: string[];
}

export interface Parcel {
  id: string;
  lotPlan: string;
  geometry: GeoJSON.Polygon;
  area: number;
  centroid: [number, number];
}

export interface LayerConfig {
  id: string;
  label: string;
  url: string;
  description?: string;
  fields: {
    include: string[];
    aliases: Record<string, string>;
  };
  nameTemplate: string;
  style: {
    lineWidth: number;
    lineOpacity: number;
    polyOpacity: number;
    color: string;
  };
  popup: {
    order: string[];
    hideNull: boolean;
  };
}

export interface Feature {
  id: string;
  layerId: string;
  geometry: GeoJSON.Geometry;
  properties: Record<string, any>;
  displayName: string;
}

export interface ExportOptions {
  format: 'kml' | 'geojson';
  clipToParcel: boolean;
  simplifyTolerance: number;
  includeAttributes: boolean;
  fillOpacity: number;
  strokeWidth: number;
}

export interface LayerPreset {
  id: string;
  name: string;
  selectedLayers: string[];
  exportOptions: ExportOptions;
}
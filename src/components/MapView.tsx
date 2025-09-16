import React, { useMemo } from "react";
import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

import type { FeatureMap } from "@/lib/gis";

const DEFAULT_CENTER: [number, number] = [-27.4698, 153.0251];

function polygonToLatLngs(geom: any): L.LatLngExpression[][] {
  if (!geom || geom.type !== "Polygon") return [];
  const rings = Array.isArray(geom.coordinates) ? geom.coordinates : [];
  return rings.map((ring: Array<[number, number]>) =>
    ring.map(([x, y]) => [y, x] as L.LatLngExpression),
  );
}

function collectBounds(parcels: any[], features: FeatureMap): L.LatLngBounds | null {
  const bounds = L.latLngBounds([]);
  parcels.forEach((parcel) => {
    polygonToLatLngs(parcel?.geometry).forEach((ring) => ring.forEach((pt) => bounds.extend(pt)));
  });
  Object.entries(features)
    .filter(([key]) => key !== "meta")
    .forEach(([, value]) => {
      const arr = Array.isArray(value) ? value : [];
      arr.forEach((feature: any) => {
        polygonToLatLngs(feature.geometry).forEach((ring) =>
          ring.forEach((pt) => bounds.extend(pt)),
        );
      });
    });
  return bounds.isValid() ? bounds : null;
}

function FitToBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [map, bounds]);
  return null;
}

type Props = {
  parcels: Array<{ geometry: any; lotPlan?: string }>;
  featuresByLayer: FeatureMap;
  layerStyles?: Record<string, string>;
};

export default function MapView({ parcels, featuresByLayer, layerStyles = {} }: Props) {
  const parcelPolygons = useMemo(() => {
    return parcels.map((parcel) => {
      const paths = polygonToLatLngs(parcel.geometry);
      if (paths.length === 0) return null;
      return (
        <Polygon
          key={parcel.lotPlan || parcel.id || Math.random().toString(36)}
          positions={paths}
          pathOptions={{ color: "#111827", weight: 2, fillOpacity: 0, opacity: 0.9 }}
        >
          {parcel.lotPlan && <Tooltip sticky>{parcel.lotPlan}</Tooltip>}
        </Polygon>
      );
    });
  }, [parcels]);

  const featurePolygons = useMemo(() => {
    const entries = Object.entries(featuresByLayer).filter(([key]) => key !== "meta");
    return entries.flatMap(([layerId, value], layerIndex) => {
      const features = Array.isArray(value) ? value : [];
      const color = layerStyles[layerId] || DEFAULT_COLORS[layerIndex % DEFAULT_COLORS.length];
      return features.map((feature: any) => {
        const paths = polygonToLatLngs(feature.geometry);
        if (paths.length === 0) return null;
        return (
          <Polygon
            key={`${layerId}-${feature.id}`}
            positions={paths}
            pathOptions={{
              color,
              weight: 1,
              opacity: 0.9,
              fillColor: color,
              fillOpacity: 0.25,
            }}
          >
            <Tooltip sticky>
              <div className="space-y-1">
                <p className="font-semibold text-xs text-slate-900">{feature.displayName || layerId}</p>
                {feature.properties && (
                  <div className="space-y-0.5">
                    {Object.entries(feature.properties)
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-[11px]">
                          <span className="font-medium text-slate-500">{key}:</span>
                          <span className="font-mono text-slate-700">{String(value)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </Tooltip>
          </Polygon>
        );
      });
    });
  }, [featuresByLayer, layerStyles]);

  const bounds = useMemo(() => collectBounds(parcels, featuresByLayer), [parcels, featuresByLayer]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={10}
      className="h-full w-full"
      scrollWheelZoom
      attributionControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; <a href='https://www.openstreetmap.org/'>OpenStreetMap</a> contributors"
      />
      {parcelPolygons}
      {featurePolygons}
      <FitToBounds bounds={bounds} />
    </MapContainer>
  );
}

const DEFAULT_COLORS = [
  "#2563eb",
  "#f97316",
  "#10b981",
  "#8b5cf6",
  "#f43f5e",
  "#0ea5e9",
];

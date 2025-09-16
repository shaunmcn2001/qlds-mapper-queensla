import type { Feature, LayerConfig, Parcel } from "@/types";

type DeepPartial<T> = { [K in keyof T]: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const parcelPolygon: Parcel["geometry"] = {
  type: "Polygon",
  coordinates: [
    [
      [153.0218, -27.4673],
      [153.0275, -27.4674],
      [153.0293, -27.4719],
      [153.0244, -27.4741],
      [153.0199, -27.4712],
      [153.0218, -27.4673],
    ],
  ],
};

const makeFeatureGeometry = (
  offsets: Array<[number, number]>,
): Feature["geometry"] => ({
  type: "Polygon",
  coordinates: [
    offsets.map(([dx, dy]) => [parcelPolygon.coordinates[0][0][0] + dx, parcelPolygon.coordinates[0][0][1] + dy]),
  ],
});

const SAMPLE_PARCELS: Parcel[] = [
  {
    id: "SAMPLE-3/RP67254",
    lotPlan: "3/RP67254",
    geometry: parcelPolygon,
    centroid: [parcelPolygon.coordinates[0][0][0] + 0.003, parcelPolygon.coordinates[0][0][1] - 0.0025],
    area: 0,
  },
];

const SAMPLE_LAYERS: LayerConfig[] = [
  {
    id: "environmental_risk",
    label: "Environmental Risk Zones",
    description: "Demonstration overlays from Queensland open data.",
    fields: {
      include: ["ZONE", "SOURCE", "UPDATED"],
      aliases: {
        ZONE: "Zone",
        SOURCE: "Source",
        UPDATED: "Updated",
      },
    },
    style: {
      color: "#2563eb",
      lineWidth: 2,
      lineOpacity: 0.9,
      polyOpacity: 0.25,
    },
    popup: {
      order: ["ZONE", "SOURCE", "UPDATED"],
      hideNull: true,
    },
  },
  {
    id: "heritage_register",
    label: "State Heritage Register",
    description: "Sample of Queensland heritage places with attributes.",
    fields: {
      include: ["PLACE_NAME", "PLACE_TYPE", "LOCAL_GOV"],
      aliases: {
        PLACE_NAME: "Place",
        PLACE_TYPE: "Type",
        LOCAL_GOV: "Local Government",
      },
    },
    style: {
      color: "#f97316",
      lineWidth: 2,
      lineOpacity: 0.9,
      polyOpacity: 0.2,
    },
    popup: {
      order: ["PLACE_NAME", "PLACE_TYPE", "LOCAL_GOV"],
      hideNull: true,
    },
  },
  {
    id: "flood_hazard",
    label: "Flood Hazard Areas",
    description: "Illustrative flood extent polygons for demo purposes.",
    fields: {
      include: ["HAZARD", "PROBABILITY", "UPDATED"],
      aliases: {
        HAZARD: "Hazard",
        PROBABILITY: "Probability",
        UPDATED: "Updated",
      },
    },
    style: {
      color: "#10b981",
      lineWidth: 2,
      lineOpacity: 0.85,
      polyOpacity: 0.2,
    },
    popup: {
      order: ["HAZARD", "PROBABILITY", "UPDATED"],
      hideNull: true,
    },
  },
];

const SAMPLE_FEATURES: Record<string, Feature[]> = {
  environmental_risk: [
    {
      id: "env-1",
      layerId: "environmental_risk",
      displayName: "Bushfire management area",
      geometry: makeFeatureGeometry([
        [0.001, 0.0002],
        [0.004, 0.0005],
        [0.0045, -0.0028],
        [0.0008, -0.003],
        [0.001, 0.0002],
      ]),
      properties: {
        ZONE: "Bushfire prone area",
        SOURCE: "Sample overlay",
        UPDATED: "2024-07-01",
      },
    },
    {
      id: "env-2",
      layerId: "environmental_risk",
      displayName: "Protected vegetation",
      geometry: makeFeatureGeometry([
        [-0.002, 0.001],
        [0.0015, 0.0012],
        [0.0012, -0.0015],
        [-0.0025, -0.0017],
        [-0.002, 0.001],
      ]),
      properties: {
        ZONE: "Regulated vegetation",
        SOURCE: "Sample overlay",
        UPDATED: "2024-05-20",
      },
    },
  ],
  heritage_register: [
    {
      id: "heritage-1",
      layerId: "heritage_register",
      displayName: "Old Post Office",
      geometry: makeFeatureGeometry([
        [-0.001, -0.0005],
        [0.001, -0.0004],
        [0.0011, -0.0022],
        [-0.0009, -0.0023],
        [-0.001, -0.0005],
      ]),
      properties: {
        PLACE_NAME: "Sample Post Office",
        PLACE_TYPE: "State heritage place",
        LOCAL_GOV: "Brisbane",
      },
    },
  ],
  flood_hazard: [
    {
      id: "flood-1",
      layerId: "flood_hazard",
      displayName: "1% AEP Flood extent",
      geometry: makeFeatureGeometry([
        [-0.0035, 0.001],
        [0.001, 0.0015],
        [0.002, -0.002],
        [-0.003, -0.003],
        [-0.0035, 0.001],
      ]),
      properties: {
        HAZARD: "1% AEP",
        PROBABILITY: "High",
        UPDATED: "2023-11-15",
      },
    },
    {
      id: "flood-2",
      layerId: "flood_hazard",
      displayName: "Annual inundation",
      geometry: makeFeatureGeometry([
        [-0.0025, 0.002],
        [0.0005, 0.0025],
        [0.0015, 0.0002],
        [-0.0015, -0.0006],
        [-0.0025, 0.002],
      ]),
      properties: {
        HAZARD: "Frequent",
        PROBABILITY: "Medium",
        UPDATED: "2024-02-08",
      },
    },
  ],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createFallbackParcels(): Parcel[] {
  return clone(SAMPLE_PARCELS);
}

export function createFallbackLayers(): LayerConfig[] {
  return clone(SAMPLE_LAYERS);
}

export function createFallbackFeatures(): Record<string, Feature[]> {
  return clone(SAMPLE_FEATURES);
}

export type FallbackSnapshot = {
  parcels: DeepPartial<Parcel>[];
  layers: DeepPartial<LayerConfig>[];
  features: Record<string, DeepPartial<Feature>[]>;
};

export function getFallbackSnapshot(): FallbackSnapshot {
  return {
    parcels: clone(SAMPLE_PARCELS),
    layers: clone(SAMPLE_LAYERS),
    features: clone(SAMPLE_FEATURES),
  };
}

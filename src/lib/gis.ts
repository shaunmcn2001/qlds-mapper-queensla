import type { ParcelInput, LayerConfig, Parcel, Feature } from '../types';

// Mock data for demonstration
const MOCK_LAYERS: LayerConfig[] = [
  {
    id: 'landtypes',
    label: 'Land Types',
    url: 'https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Environment/LandTypes/MapServer/1',
    description: 'Queensland land type classifications',
    fields: {
      include: ['LT_NAME', 'LT_CODE', 'LANDSYS', 'REGION', 'SOURCE'],
      aliases: {
        LT_NAME: 'Land Type',
        LT_CODE: 'Code',
        LANDSYS: 'Land System',
        REGION: 'Region',
        SOURCE: 'Source'
      }
    },
    nameTemplate: '${LT_NAME} (${LT_CODE})',
    style: {
      lineWidth: 1,
      lineOpacity: 0.9,
      polyOpacity: 0.35,
      color: '#1f77b4'
    },
    popup: {
      order: ['LT_NAME', 'LT_CODE', 'LANDSYS', 'REGION', 'SOURCE'],
      hideNull: true
    }
  },
  {
    id: 'veg_mgmt',
    label: 'Vegetation Management',
    url: 'https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Biota/VegetationManagement/MapServer/101',
    description: 'Vegetation management status and regional ecosystems',
    fields: {
      include: ['VMSTATUS', 'RE', 'RE_DESC', 'BIOTA_CODE', 'BIOTA_NAME'],
      aliases: {
        VMSTATUS: 'VM Status',
        RE: 'Regional Ecosystem',
        RE_DESC: 'RE Description',
        BIOTA_CODE: 'Biota Code',
        BIOTA_NAME: 'Biota Name'
      }
    },
    nameTemplate: '${VMSTATUS} - ${RE}',
    style: {
      lineWidth: 1,
      lineOpacity: 0.9,
      polyOpacity: 0.30,
      color: '#2ca02c'
    },
    popup: {
      order: ['VMSTATUS', 'RE', 'RE_DESC', 'BIOTA_CODE', 'BIOTA_NAME'],
      hideNull: true
    }
  },
  {
    id: 'flood_mapping',
    label: 'Flood Mapping',
    url: 'https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Water/FloodMapping/MapServer/3',
    description: 'Defined flood events and flood risk areas',
    fields: {
      include: ['EVENT_TYPE', 'EVENT_NAME', 'FLOOD_LEVEL', 'STUDY_YEAR', 'AUTHORITY'],
      aliases: {
        EVENT_TYPE: 'Event Type',
        EVENT_NAME: 'Event Name',
        FLOOD_LEVEL: 'Flood Level',
        STUDY_YEAR: 'Study Year',
        AUTHORITY: 'Authority'
      }
    },
    nameTemplate: '${EVENT_NAME} (${EVENT_TYPE})',
    style: {
      lineWidth: 2,
      lineOpacity: 0.8,
      polyOpacity: 0.25,
      color: '#ff7f0e'
    },
    popup: {
      order: ['EVENT_NAME', 'EVENT_TYPE', 'FLOOD_LEVEL', 'STUDY_YEAR', 'AUTHORITY'],
      hideNull: true
    }
  }
];

export function normalizeLotPlan(input: string): string[] {
  const normalized: string[] = [];
  const trimmed = input.trim().toUpperCase();
  
  // Handle ranges like "2-4 RP53435"
  const rangeMatch = trimmed.match(/^(\d+)-(\d+)\s*([A-Z]*\s*\d+)$/);
  if (rangeMatch) {
    const [, start, end, plan] = rangeMatch;
    const startNum = parseInt(start);
    const endNum = parseInt(end);
    for (let i = startNum; i <= endNum; i++) {
      normalized.push(`${i}/${plan.replace(/\s+/g, '')}`);
    }
    return normalized;
  }
  
  // Handle various single formats
  let cleanInput = trimmed
    .replace(/^LOT\s*/i, '')
    .replace(/^L/, '')
    .replace(/\s+/g, '');
  
  // Add slash if missing between lot and plan
  if (/^\d+[A-Z]+\d+$/.test(cleanInput)) {
    cleanInput = cleanInput.replace(/(\d+)([A-Z]+\d+)$/, '$1/$2');
  }
  
  normalized.push(cleanInput);
  return normalized;
}

export async function resolveParcels(lotPlans: string[]): Promise<Parcel[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return lotPlans.map((lotPlan, index) => ({
    id: `parcel_${index}`,
    lotPlan,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [153.0240 + (index * 0.001), -27.4705 + (index * 0.001)],
        [153.0250 + (index * 0.001), -27.4705 + (index * 0.001)],
        [153.0250 + (index * 0.001), -27.4715 + (index * 0.001)],
        [153.0240 + (index * 0.001), -27.4715 + (index * 0.001)],
        [153.0240 + (index * 0.001), -27.4705 + (index * 0.001)]
      ]]
    },
    area: 1000 + (index * 100),
    centroid: [153.0245 + (index * 0.001), -27.4710 + (index * 0.001)]
  }));
}

export async function intersectLayers(parcel: Parcel, layerIds: string[]): Promise<Record<string, Feature[]>> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const results: Record<string, Feature[]> = {};
  
  layerIds.forEach(layerId => {
    const layer = MOCK_LAYERS.find(l => l.id === layerId);
    if (!layer) return;
    
    const features: Feature[] = [];
    const featureCount = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < featureCount; i++) {
      const props: Record<string, any> = {};
      layer.fields.include.forEach(field => {
        switch (field) {
          case 'LT_NAME':
            props[field] = ['Alluvial Plains', 'Rolling Hills', 'Coastal Lowlands'][i % 3];
            break;
          case 'LT_CODE':
            props[field] = ['AP01', 'RH02', 'CL03'][i % 3];
            break;
          case 'VMSTATUS':
            props[field] = ['Essential', 'Of Concern', 'Least Concern'][i % 3];
            break;
          case 'RE':
            props[field] = ['12.3.1', '12.5.2', '12.8.1'][i % 3];
            break;
          case 'EVENT_TYPE':
            props[field] = ['1% AEP', '5% AEP', 'PMF'][i % 3];
            break;
          case 'EVENT_NAME':
            props[field] = ['Brisbane River Flood', 'Local Creek Flood', 'Storm Surge'][i % 3];
            break;
          default:
            props[field] = `Value ${i + 1}`;
        }
      });
      
      features.push({
        id: `${layerId}_feature_${i}`,
        layerId,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [parcel.centroid[0] - 0.002 + (i * 0.001), parcel.centroid[1] - 0.002 + (i * 0.001)],
            [parcel.centroid[0] + 0.002 + (i * 0.001), parcel.centroid[1] - 0.002 + (i * 0.001)],
            [parcel.centroid[0] + 0.002 + (i * 0.001), parcel.centroid[1] + 0.002 + (i * 0.001)],
            [parcel.centroid[0] - 0.002 + (i * 0.001), parcel.centroid[1] + 0.002 + (i * 0.001)],
            [parcel.centroid[0] - 0.002 + (i * 0.001), parcel.centroid[1] - 0.002 + (i * 0.001)]
          ]]
        },
        properties: props,
        displayName: generateDisplayName(layer.nameTemplate, props)
      });
    }
    
    results[layerId] = features;
  });
  
  return results;
}

function generateDisplayName(template: string, properties: Record<string, any>): string {
  return template.replace(/\$\{(\w+)\}/g, (match, fieldName) => {
    return properties[fieldName] || match;
  });
}

export function getLayers(): LayerConfig[] {
  return MOCK_LAYERS;
}

export async function exportData(
  parcel: Parcel,
  features: Record<string, Feature[]>,
  options: { format: 'kml' | 'geojson' }
): Promise<string> {
  // Simulate export processing
  await new Promise(resolve => setTimeout(resolve, 800));
  
  if (options.format === 'geojson') {
    const featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'parcel', lotPlan: parcel.lotPlan },
          geometry: parcel.geometry
        },
        ...Object.values(features).flat().map(f => ({
          type: 'Feature',
          properties: { ...f.properties, layerId: f.layerId },
          geometry: f.geometry
        }))
      ]
    };
    return JSON.stringify(featureCollection, null, 2);
  }
  
  // Mock KML export
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>QLD Parcel Export</name>
    <Folder>
      <name>Parcel: ${parcel.lotPlan}</name>
      <Placemark>
        <name>${parcel.lotPlan}</name>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
                ${parcel.geometry.coordinates[0].map(coord => `${coord[0]},${coord[1]},0`).join(' ')}
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    </Folder>
    ${Object.entries(features).map(([layerId, layerFeatures]) => `
    <Folder>
      <name>${layerId}</name>
      ${layerFeatures.map(f => `
      <Placemark>
        <name>${f.displayName}</name>
        <description>${Object.entries(f.properties).map(([k, v]) => `${k}: ${v}`).join('\\n')}</description>
      </Placemark>`).join('')}
    </Folder>`).join('')}
  </Document>
</kml>`;
}
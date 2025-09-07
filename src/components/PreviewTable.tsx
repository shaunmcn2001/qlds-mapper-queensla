import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database } from '@phosphor-icons/react';
import { getLayers } from '@/lib/gis';
import type { Feature } from '@/types';

interface PreviewTableProps {
  features: Record<string, Feature[]>;
  selectedLayers: string[];
}

export function PreviewTable({ features, selectedLayers }: PreviewTableProps) {
  const layers = getLayers();
  const totalFeatures = Object.values(features).reduce((sum, feats) => sum + feats.length, 0);

  if (totalFeatures === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground">
          <div className="text-center">
            <Database className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">No intersections found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Database className="text-primary" />
            Feature Preview
          </div>
          <Badge variant="secondary" className="text-xs">
            {totalFeatures} feature{totalFeatures !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {selectedLayers.map(layerId => {
            const layerFeatures = features[layerId];
            if (!layerFeatures || layerFeatures.length === 0) return null;
            
            const layer = layers.find(l => l.id === layerId);
            if (!layer) return null;
            
            return (
              <LayerFeatureTable
                key={layerId}
                layer={layer}
                features={layerFeatures.slice(0, 10)} // Show first 10 features
                totalCount={layerFeatures.length}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function LayerFeatureTable({ 
  layer, 
  features, 
  totalCount 
}: { 
  layer: any; 
  features: Feature[]; 
  totalCount: number;
}) {
  const displayFields = layer.popup.order.length > 0 
    ? layer.popup.order.slice(0, 4) 
    : layer.fields.include.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div 
          className="w-4 h-4 rounded border"
          style={{ backgroundColor: layer.style.color }}
        />
        <h3 className="font-medium">{layer.label}</h3>
        {totalCount > 10 && (
          <Badge variant="outline" className="text-xs">
            Showing 10 of {totalCount}
          </Badge>
        )}
      </div>
      
      <ScrollArea className="h-48 border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              {displayFields.map(field => (
                <TableHead key={field} className="font-medium text-xs">
                  {layer.fields.aliases[field] || field}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((feature, index) => (
              <TableRow key={feature.id} className="text-xs">
                <TableCell className="font-mono text-muted-foreground">
                  {index + 1}
                </TableCell>
                {displayFields.map(field => (
                  <TableCell key={field} className="tabular-nums">
                    {feature.properties[field] || '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
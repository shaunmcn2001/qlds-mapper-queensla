import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, Eye, Save } from '@phosphor-icons/react';
import { getLayers } from '@/lib/gis';
import type { LayerConfig } from '@/types';

interface LayerPickerProps {
  selectedLayers: string[];
  onSelectionChange: (layerIds: string[]) => void;
  onPreview: () => void;
  canPreview: boolean;
  isLoading: boolean;
}

export function LayerPicker({ 
  selectedLayers, 
  onSelectionChange, 
  onPreview, 
  canPreview, 
  isLoading 
}: LayerPickerProps) {
  const layers = getLayers();

  const handleLayerToggle = (layerId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedLayers, layerId]);
    } else {
      onSelectionChange(selectedLayers.filter(id => id !== layerId));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          <div className="flex items-center gap-2">
            <Layers className="text-primary" />
            Layer Selection
          </div>
          <Badge variant="secondary" className="text-xs">
            {selectedLayers.length} selected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {layers.map((layer) => (
            <LayerItem
              key={layer.id}
              layer={layer}
              selected={selectedLayers.includes(layer.id)}
              onToggle={(checked) => handleLayerToggle(layer.id, checked)}
            />
          ))}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={onPreview}
            disabled={!canPreview || selectedLayers.length === 0 || isLoading}
            className="flex-1 flex items-center gap-2"
          >
            <Eye size={16} />
            Preview Intersections
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            title="Save as preset"
            disabled={selectedLayers.length === 0}
          >
            <Save size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LayerItem({ 
  layer, 
  selected, 
  onToggle 
}: { 
  layer: LayerConfig; 
  selected: boolean; 
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <Checkbox
        id={layer.id}
        checked={selected}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex-1 space-y-1">
        <label 
          htmlFor={layer.id}
          className="text-sm font-medium cursor-pointer"
        >
          {layer.label}
        </label>
        {layer.description && (
          <p className="text-xs text-muted-foreground">
            {layer.description}
          </p>
        )}
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded border"
            style={{ backgroundColor: layer.style.color }}
          />
          <span className="text-xs text-muted-foreground font-mono">
            {layer.fields.include.length} attributes
          </span>
        </div>
      </div>
    </div>
  );
}
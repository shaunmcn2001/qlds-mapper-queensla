import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, Map, Loader2 } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportData } from '@/lib/gis';
import type { Parcel, Feature, ExportOptions } from '@/types';

interface ExportPanelProps {
  parcels: Parcel[];
  features: Record<string, Feature[]>;
  canExport: boolean;
}

export function ExportPanel({ parcels, features, canExport }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'geojson',
    clipToParcel: true,
    simplifyTolerance: 1,
    includeAttributes: true,
    fillOpacity: 0.3,
    strokeWidth: 1
  });

  const handleExport = async (format: 'kml' | 'geojson') => {
    if (!canExport || parcels.length === 0) return;
    
    setIsExporting(true);
    
    try {
      const exportOptions = { ...options, format };
      const data = await exportData(parcels[0], features, exportOptions);
      
      const blob = new Blob([data], { 
        type: format === 'kml' ? 'application/vnd.google-earth.kml+xml' : 'application/geo+json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `parcel_export_${parcels[0].lotPlan}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`${format.toUpperCase()} export completed successfully`);
    } catch (error) {
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const featureCount = Object.values(features).reduce((sum, feats) => sum + feats.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Download className="text-primary" />
          Export Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Format */}
        <div className="space-y-2">
          <Label>Export Format</Label>
          <Select
            value={options.format}
            onValueChange={(value: 'kml' | 'geojson') => 
              setOptions(prev => ({ ...prev, format: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="geojson">
                <div className="flex items-center gap-2">
                  <FileText size={16} />
                  GeoJSON
                </div>
              </SelectItem>
              <SelectItem value="kml">
                <div className="flex items-center gap-2">
                  <Map size={16} />
                  KML/KMZ
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Processing Options */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Processing Options</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">Clip to Parcel Boundary</Label>
              <p className="text-xs text-muted-foreground">
                Trim features to parcel extent
              </p>
            </div>
            <Switch
              checked={options.clipToParcel}
              onCheckedChange={(checked) =>
                setOptions(prev => ({ ...prev, clipToParcel: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">Include Attributes</Label>
              <p className="text-xs text-muted-foreground">
                Include feature properties
              </p>
            </div>
            <Switch
              checked={options.includeAttributes}
              onCheckedChange={(checked) =>
                setOptions(prev => ({ ...prev, includeAttributes: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Simplify Tolerance</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {options.simplifyTolerance}m
              </span>
            </div>
            <Slider
              value={[options.simplifyTolerance]}
              onValueChange={(value) =>
                setOptions(prev => ({ ...prev, simplifyTolerance: value[0] }))
              }
              max={10}
              min={0}
              step={0.5}
              className="w-full"
            />
          </div>
        </div>

        <Separator />

        {/* Style Options */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Style Options</h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Fill Opacity</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {(options.fillOpacity * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[options.fillOpacity]}
              onValueChange={(value) =>
                setOptions(prev => ({ ...prev, fillOpacity: value[0] }))
              }
              max={1}
              min={0}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Stroke Width</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {options.strokeWidth}px
              </span>
            </div>
            <Slider
              value={[options.strokeWidth]}
              onValueChange={(value) =>
                setOptions(prev => ({ ...prev, strokeWidth: value[0] }))
              }
              max={5}
              min={0.5}
              step={0.5}
              className="w-full"
            />
          </div>
        </div>

        <Separator />

        {/* Export Summary */}
        {canExport && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Parcels: {parcels.length}</div>
              <div>Features: {featureCount}</div>
              <div>Format: {options.format.toUpperCase()}</div>
            </div>
          </div>
        )}

        {/* Export Buttons */}
        <div className="space-y-2">
          <Button
            onClick={() => handleExport('geojson')}
            disabled={!canExport || isExporting}
            className="w-full flex items-center gap-2"
            variant={options.format === 'geojson' ? 'default' : 'outline'}
          >
            {isExporting && options.format === 'geojson' ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <FileText size={16} />
            )}
            Export GeoJSON
          </Button>
          
          <Button
            onClick={() => handleExport('kml')}
            disabled={!canExport || isExporting}
            className="w-full flex items-center gap-2"
            variant={options.format === 'kml' ? 'default' : 'outline'}
          >
            {isExporting && options.format === 'kml' ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Map size={16} />
            )}
            Export KML
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
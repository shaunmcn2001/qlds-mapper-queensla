import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Loader2 } from '@phosphor-icons/react';
import { normalizeLotPlan, resolveParcels } from '@/lib/gis';
import type { Parcel } from '@/types';

interface ParcelSearchProps {
  onParcelResolved: (parcels: Parcel[]) => void;
  isLoading: boolean;
}

export function ParcelSearch({ onParcelResolved, isLoading }: ParcelSearchProps) {
  const [input, setInput] = useState('');
  const [normalized, setNormalized] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (value: string) => {
    setInput(value);
    setError(null);
    
    if (value.trim()) {
      try {
        const normalizedValues = normalizeLotPlan(value);
        setNormalized(normalizedValues);
      } catch (err) {
        setNormalized([]);
        setError('Invalid lot/plan format');
      }
    } else {
      setNormalized([]);
    }
  };

  const handleResolve = async () => {
    if (normalized.length === 0) return;
    
    try {
      const parcels = await resolveParcels(normalized);
      onParcelResolved(parcels);
    } catch (err) {
      setError('Failed to resolve parcels. Please try again.');
    }
  };

  const formatExamples = [
    '2/RP53435',
    'L2 RP53435', 
    '2-4 RP53435',
    'Lot 2 Sec 3 DP754253',
    'A/DP397521'
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="text-primary" />
          Parcel Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              id="parcel-input"
              placeholder="Enter Lot/Plan (e.g., 2/RP53435)"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleResolve}
              disabled={normalized.length === 0 || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Search size={16} />
              )}
              Resolve
            </Button>
          </div>
          
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {normalized.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Normalized ({normalized.length} parcel{normalized.length !== 1 ? 's' : ''}):
            </p>
            <div className="flex flex-wrap gap-1">
              {normalized.map((lot, index) => (
                <Badge key={index} variant="secondary" className="font-mono text-xs">
                  {lot}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Format Examples:</p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {formatExamples.map((example, index) => (
              <button
                key={index}
                onClick={() => handleInputChange(example)}
                className="text-left p-1 rounded hover:bg-muted font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
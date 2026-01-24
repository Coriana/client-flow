import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Location {
  id: string;
  name: string;
  location_type: string | null;
  city: string | null;
  state: string | null;
}

interface LocationSelectorProps {
  value: string | null;
  onChange: (locationId: string | null) => void;
  label?: string;
  showViewLink?: boolean;
}

export default function LocationSelector({ value, onChange, label = 'Location', showViewLink = true }: LocationSelectorProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    const { data } = await supabase
      .from('locations')
      .select('id, name, location_type, city, state')
      .eq('is_active', true)
      .order('name');

    setLocations(data || []);
    setLoading(false);
  }

  function formatLocationLabel(location: Location) {
    const parts = [location.name];
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    return parts.join(', ');
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="h-10 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {label}
        </Label>
        {showViewLink && value && (
          <Link to={`/locations/${value}`} className="text-xs text-primary hover:underline">
            View location
          </Link>
        )}
      </div>
      <Select
        value={value || '__none__'}
        onValueChange={(v) => onChange(v === '__none__' ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              <div className="flex items-center gap-2">
                <span>{location.name}</span>
                {location.location_type && (
                  <span className="text-xs text-muted-foreground">({location.location_type})</span>
                )}
                {location.city && (
                  <span className="text-xs text-muted-foreground">- {location.city}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

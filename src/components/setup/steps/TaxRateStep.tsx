import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranding } from '@/contexts/BrandingContext';
import { toast } from 'sonner';

interface TaxRateStepProps {
  data: {
    name: string;
    rate: number;
  };
  onUpdate: (data: Partial<TaxRateStepProps['data']>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function TaxRateStep({ data, onUpdate, onNext, onBack }: TaxRateStepProps) {
  const { formatCurrency } = useBranding();
  const [saving, setSaving] = useState(false);
  const [existingTaxId, setExistingTaxId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch existing default tax rate
    const fetchTaxRate = async () => {
      const { data: taxRates } = await supabase
        .from('tax_rates')
        .select('id, name, rate')
        .eq('is_default', true)
        .limit(1)
        .single();

      if (taxRates) {
        setExistingTaxId(taxRates.id);
        onUpdate({ name: taxRates.name, rate: Number(taxRates.rate) });
      }
    };
    fetchTaxRate();
  }, []);

  const handleSave = async () => {
    if (!data.name.trim()) {
      toast.error('Tax name is required');
      return;
    }

    setSaving(true);
    try {
      if (existingTaxId) {
        // Update existing tax rate
        const { error } = await supabase
          .from('tax_rates')
          .update({
            name: data.name.trim(),
            rate: data.rate,
          })
          .eq('id', existingTaxId);

        if (error) throw error;
      } else {
        // Create new tax rate
        const { error } = await supabase
          .from('tax_rates')
          .insert({
            name: data.name.trim(),
            rate: data.rate,
            is_default: true,
            is_active: true,
          });

        if (error) throw error;
      }
      onNext();
    } catch (error) {
      console.error('Error saving tax rate:', error);
      toast.error('Failed to save tax rate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-primary">
        <Receipt className="h-8 w-8" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Tax Setup</h3>
          <p className="text-sm text-muted-foreground">Configure your default tax rate</p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-sm">
        <p className="text-muted-foreground">
          A default GST rate of 10% has been created. You can modify it below or keep the default.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="taxName">Tax Name *</Label>
            <Input
              id="taxName"
              placeholder="e.g., GST"
              value={data.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxRate">Rate (%)</Label>
            <Input
              id="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={data.rate}
              onChange={(e) => onUpdate({ rate: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <strong>Preview:</strong> A {formatCurrency(100)} item will be invoiced as {formatCurrency(100)} + {formatCurrency(100 * data.rate / 100)} {data.name} = <strong>{formatCurrency(100 + (100 * data.rate / 100))}</strong>
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onNext}>
            Skip
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Next →'}
          </Button>
        </div>
      </div>
    </div>
  );
}

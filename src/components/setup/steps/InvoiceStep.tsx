import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvoiceStepProps {
  data: {
    prefix: string;
    nextNumber: number;
    paymentTerms: number;
  };
  onUpdate: (data: Partial<InvoiceStepProps['data']>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function InvoiceStep({ data, onUpdate, onNext, onBack }: InvoiceStepProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          invoice_prefix: data.prefix.trim() || 'INV-',
          invoice_next_number: data.nextNumber || 1,
          default_payment_terms: data.paymentTerms || 30,
          setup_completed: true,
        })
        .not('id', 'is', null);

      if (error) throw error;
      onNext();
    } catch (error) {
      console.error('Error saving invoice settings:', error);
      toast.error('Failed to save invoice settings');
    } finally {
      setSaving(false);
    }
  };

  const formatInvoiceNumber = () => {
    const num = String(data.nextNumber).padStart(5, '0');
    return `${data.prefix}${num}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-primary">
        <FileText className="h-8 w-8" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Invoice Settings</h3>
          <p className="text-sm text-muted-foreground">Customize how your invoices are numbered</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
            <Input
              id="invoicePrefix"
              placeholder="e.g., INV-"
              value={data.prefix}
              onChange={(e) => onUpdate({ prefix: e.target.value.toUpperCase() })}
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Include a separator if you want one, e.g. INV-
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startingNumber">Starting Number</Label>
            <Input
              id="startingNumber"
              type="number"
              min="1"
              value={data.nextNumber}
              onChange={(e) => onUpdate({ nextNumber: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <strong>Preview:</strong> Your first invoice will be numbered <strong>{formatInvoiceNumber()}</strong>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentTerms">Default Payment Terms (days)</Label>
          <Input
            id="paymentTerms"
            type="number"
            min="0"
            max="365"
            value={data.paymentTerms}
            onChange={(e) => onUpdate({ paymentTerms: parseInt(e.target.value) || 30 })}
          />
          <p className="text-xs text-muted-foreground">
            Number of days clients have to pay invoices (e.g., 30 = due in 30 days)
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Complete Setup →'}
        </Button>
      </div>
    </div>
  );
}

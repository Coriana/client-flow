import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TradingNameStepProps {
  data: {
    name: string;
    bankAccountName: string;
    bsb: string;
    accountNumber: string;
    paypalEmail: string;
  };
  onUpdate: (data: Partial<TradingNameStepProps['data']>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function TradingNameStep({ data, onUpdate, onNext, onBack }: TradingNameStepProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!data.name.trim()) {
      toast.error('Trading name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('trading_names')
        .insert({
          name: data.name.trim(),
          bank_account_name: data.bankAccountName.trim() || null,
          bsb: data.bsb.trim() || null,
          account_number: data.accountNumber.trim() || null,
          paypal_email: data.paypalEmail.trim() || null,
          is_default: true,
        });

      if (error) throw error;
      onNext();
    } catch (error) {
      console.error('Error saving trading name:', error);
      toast.error('Failed to save trading name');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-primary">
        <Store className="h-8 w-8" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Trading Name</h3>
          <p className="text-sm text-muted-foreground">This appears on your invoices</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tradingName">Trading Name *</Label>
          <Input
            id="tradingName"
            placeholder="e.g., Acme Solutions"
            value={data.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            The name that appears on invoices (can be different from your company name)
          </p>
        </div>

        <div className="border-t pt-4 mt-4">
          <p className="text-sm font-medium text-foreground mb-3">Bank Details for Invoices (optional)</p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bankAccountName">Account Name</Label>
              <Input
                id="bankAccountName"
                placeholder="e.g., Acme Solutions"
                value={data.bankAccountName}
                onChange={(e) => onUpdate({ bankAccountName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bsb">BSB</Label>
                <Input
                  id="bsb"
                  placeholder="e.g., 063-000"
                  value={data.bsb}
                  onChange={(e) => onUpdate({ bsb: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  placeholder="e.g., 12345678"
                  value={data.accountNumber}
                  onChange={(e) => onUpdate({ accountNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paypalEmail">PayPal Email (optional)</Label>
              <Input
                id="paypalEmail"
                type="email"
                placeholder="payments@company.com"
                value={data.paypalEmail}
                onChange={(e) => onUpdate({ paypalEmail: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Next →'}
          </Button>
        </div>
      </div>
    </div>
  );
}

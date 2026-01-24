import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Landmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BankAccountStepProps {
  data: {
    name: string;
    bankName: string;
    bsb: string;
    accountNumber: string;
    openingBalance: number;
    openingBalanceDate: string;
  };
  onUpdate: (data: Partial<BankAccountStepProps['data']>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BankAccountStep({ data, onUpdate, onNext, onBack }: BankAccountStepProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!data.name.trim()) {
      toast.error('Account name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .insert({
          name: data.name.trim(),
          bank_name: data.bankName.trim() || null,
          bsb: data.bsb.trim() || null,
          account_number: data.accountNumber.trim() || null,
          opening_balance: data.openingBalance || 0,
          current_balance: data.openingBalance || 0,
          opening_balance_date: data.openingBalanceDate || new Date().toISOString().split('T')[0],
          is_default: true,
          is_active: true,
        });

      if (error) throw error;
      onNext();
    } catch (error) {
      console.error('Error saving bank account:', error);
      toast.error('Failed to save bank account');
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
        <Landmark className="h-8 w-8" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Bank Account</h3>
          <p className="text-sm text-muted-foreground">Your primary business bank account</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accountName">Account Name *</Label>
          <Input
            id="accountName"
            placeholder="e.g., Business Account"
            value={data.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bankName">Bank Name</Label>
          <Input
            id="bankName"
            placeholder="e.g., Commonwealth Bank"
            value={data.bankName}
            onChange={(e) => onUpdate({ bankName: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bankBsb">BSB</Label>
            <Input
              id="bankBsb"
              placeholder="e.g., 063-000"
              value={data.bsb}
              onChange={(e) => onUpdate({ bsb: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccountNumber">Account Number</Label>
            <Input
              id="bankAccountNumber"
              placeholder="e.g., 12345678"
              value={data.accountNumber}
              onChange={(e) => onUpdate({ accountNumber: e.target.value })}
            />
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <p className="text-sm font-medium text-foreground mb-3">Opening Balance</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Amount ($)</Label>
              <Input
                id="openingBalance"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={data.openingBalance || ''}
                onChange={(e) => onUpdate({ openingBalance: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingBalanceDate">As of Date</Label>
              <Input
                id="openingBalanceDate"
                type="date"
                value={data.openingBalanceDate}
                onChange={(e) => onUpdate({ openingBalanceDate: e.target.value })}
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

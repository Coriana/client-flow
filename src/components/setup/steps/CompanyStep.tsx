import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CURRENCIES = [
  { code: 'AUD', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'USD', name: 'US Dollar', locale: 'en-US' },
  { code: 'GBP', name: 'British Pound', locale: 'en-GB' },
  { code: 'EUR', name: 'Euro', locale: 'de-DE' },
  { code: 'NZD', name: 'New Zealand Dollar', locale: 'en-NZ' },
  { code: 'CAD', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'CUSTOM', name: 'Custom...', locale: '' },
];

interface CompanyStepProps {
  data: {
    name: string;
    abn: string;
    address: string;
    email: string;
    phone: string;
    currency: string;
    currencyLocale: string;
  };
  onUpdate: (data: Partial<CompanyStepProps['data']>) => void;
  onNext: () => void;
}

export function CompanyStep({ data, onUpdate, onNext }: CompanyStepProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!data.name.trim()) {
      toast.error('Company name is required');
      return;
    }

    setSaving(true);
    try {
      const predefinedCurrency = CURRENCIES.slice(0, -1).find(c => c.code === data.currency);
      const currencyCode = data.currency.trim() || 'AUD';
      const currencyLocale = predefinedCurrency ? predefinedCurrency.locale : (data.currencyLocale?.trim() || 'en-AU');
      
      const { error } = await supabase
        .from('company_settings')
        .update({
          name: data.name.trim(),
          abn: data.abn.trim() || null,
          address: data.address.trim() || null,
          email: data.email.trim() || null,
          phone: data.phone.trim() || null,
          currency: currencyCode,
          currency_locale: currencyLocale,
        })
        .not('id', 'is', null);

      if (error) throw error;
      onNext();
    } catch (error) {
      console.error('Error saving company details:', error);
      toast.error('Failed to save company details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-primary">
        <Building2 className="h-8 w-8" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Company Details</h3>
          <p className="text-sm text-muted-foreground">Basic information about your business</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            placeholder="e.g., Acme Consulting Pty Ltd"
            value={data.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="abn">ABN</Label>
            <Input
              id="abn"
              placeholder="e.g., 12 345 678 901"
              value={data.abn}
              onChange={(e) => onUpdate({ abn: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={CURRENCIES.slice(0, -1).find(c => c.code === data.currency) ? data.currency : 'CUSTOM'}
              onValueChange={(value) => {
                if (value === 'CUSTOM') {
                  if (CURRENCIES.slice(0, -1).find(c => c.code === data.currency)) {
                    onUpdate({ currency: '', currencyLocale: '' });
                  }
                } else {
                  const selected = CURRENCIES.find(c => c.code === value);
                  onUpdate({ currency: value, currencyLocale: selected?.locale || 'en-AU' });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code === 'CUSTOM' ? currency.name : `${currency.code} - ${currency.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Custom currency inputs */}
            {!CURRENCIES.slice(0, -1).find(c => c.code === data.currency) && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs">Currency Code</Label>
                  <Input 
                    value={data.currency || ''}
                    onChange={(e) => onUpdate({ currency: e.target.value.toUpperCase() })}
                    placeholder="e.g., JPY"
                    maxLength={3}
                  />
                </div>
                <div>
                  <Label className="text-xs">Locale</Label>
                  <Input 
                    value={data.currencyLocale || ''}
                    onChange={(e) => onUpdate({ currencyLocale: e.target.value })}
                    placeholder="e.g., ja-JP"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Business Address</Label>
          <Textarea
            id="address"
            placeholder="e.g., 123 Main Street, Sydney NSW 2000"
            value={data.address}
            onChange={(e) => onUpdate({ address: e.target.value })}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="hello@company.com"
              value={data.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="e.g., 02 1234 5678"
              value={data.phone}
              onChange={(e) => onUpdate({ phone: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Next →'}
        </Button>
      </div>
    </div>
  );
}
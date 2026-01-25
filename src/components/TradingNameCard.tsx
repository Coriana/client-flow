import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Star, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface TradingName {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  abn?: string;
  bank_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  paypal_email?: string;
  other_payment_details?: string;
}

interface TradingNameCardProps {
  tradingName: TradingName;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export default function TradingNameCard({ tradingName, onSetDefault, onDelete, onUpdate }: TradingNameCardProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    abn: tradingName.abn || '',
    bank_name: tradingName.bank_name || '',
    bank_bsb: tradingName.bank_bsb || '',
    bank_account_number: tradingName.bank_account_number || '',
    bank_account_name: tradingName.bank_account_name || '',
    paypal_email: tradingName.paypal_email || '',
    other_payment_details: tradingName.other_payment_details || '',
  });

  async function handleSaveBilling() {
    setSaving(true);
    const { error } = await supabase
      .from('trading_names')
      .update(formData as any)
      .eq('id', tradingName.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Billing details saved' });
      onUpdate();
    }
    setSaving(false);
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <div className="flex items-center justify-between p-3">
        <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{tradingName.name}</span>
          {!!tradingName.is_default && (
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3" />
              Default
            </Badge>
          )}
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          {!tradingName.is_default && (
            <Button variant="ghost" size="sm" onClick={() => onSetDefault(tradingName.id)}>
              Set as Default
            </Button>
          )}
          {!tradingName.is_default && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(tradingName.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
      <CollapsibleContent className="px-3 pb-3">
        <div className="space-y-4 pt-2 border-t">
          <h4 className="font-medium text-sm text-muted-foreground mt-3">Business Details (shown on invoices)</h4>
          
          <div className="space-y-2">
            <Label>ABN</Label>
            <Input
              value={formData.abn}
              onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
              placeholder="e.g. 12 345 678 901"
            />
            <p className="text-xs text-muted-foreground">If set, this ABN will be used on invoices instead of the company ABN</p>
          </div>

          <h4 className="font-medium text-sm text-muted-foreground mt-3">Banking Details</h4>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="e.g. Commonwealth Bank"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={formData.bank_account_name}
                onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                placeholder="e.g. My Company Pty Ltd"
              />
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>BSB</Label>
              <Input
                value={formData.bank_bsb}
                onChange={(e) => setFormData({ ...formData, bank_bsb: e.target.value })}
                placeholder="e.g. 063-000"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                placeholder="e.g. 12345678"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>PayPal Email</Label>
            <Input
              type="email"
              value={formData.paypal_email}
              onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
              placeholder="e.g. payments@mycompany.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Other Payment Details</Label>
            <Textarea
              value={formData.other_payment_details}
              onChange={(e) => setFormData({ ...formData, other_payment_details: e.target.value })}
              placeholder="e.g. Crypto wallet address, BPAY details, etc."
              rows={2}
            />
          </div>
          
          <Button onClick={handleSaveBilling} disabled={saving} size="sm">
            {saving ? 'Saving...' : 'Save Billing Details'}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
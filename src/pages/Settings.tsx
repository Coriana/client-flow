import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, Star, Percent, Palette } from 'lucide-react';
import TradingNameCard from '@/components/TradingNameCard';
import LogoUploader from '@/components/settings/LogoUploader';
import { useBranding } from '@/contexts/BrandingContext';
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

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
  is_active: boolean;
}

const CURRENCIES = [
  { code: 'AUD', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'USD', name: 'US Dollar', locale: 'en-US' },
  { code: 'GBP', name: 'British Pound', locale: 'en-GB' },
  { code: 'EUR', name: 'Euro', locale: 'de-DE' },
  { code: 'NZD', name: 'New Zealand Dollar', locale: 'en-NZ' },
  { code: 'CAD', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'CUSTOM', name: 'Custom...', locale: '' },
];

interface Role {
  id: string;
  name: string;
}

export default function Settings() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { refetch: refetchBranding } = useBranding();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({ 
    name: '', 
    trading_name: '', 
    abn: '', 
    address: '', 
    email: '', 
    phone: '', 
    invoice_prefix: 'INV', 
    invoice_next_number: 1, 
    default_payment_terms: 30, 
    default_tax_rate: 10,
    default_hourly_rate: 0,
    default_tax_rate_id: null,
    default_billable_time: true,
    default_billable_expenses: false,
    app_name: 'WorkFlow',
    logo_url: null,
    favicon_url: null,
    currency: 'AUD',
    currency_locale: 'en-AU',
    default_role_id: null,
  });
  const [tradingNames, setTradingNames] = useState<TradingName[]>([]);
  const [newTradingName, setNewTradingName] = useState('');
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [newTaxRate, setNewTaxRate] = useState({ name: '', rate: '' });
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchTradingNames();
    fetchTaxRates();
    fetchRoles();
  }, []);

  async function fetchRoles() {
    const { data } = await supabase.from('roles').select('id, name').order('name');
    setRoles(data || []);
  }

  async function fetchSettings() {
    const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
    if (data) setSettings(data);
  }

  async function fetchTradingNames() {
    const { data } = await supabase.from('trading_names').select('*').order('is_default', { ascending: false }).order('name');
    setTradingNames(data || []);
  }

  async function fetchTaxRates() {
    const { data } = await supabase.from('tax_rates').select('*').order('is_default', { ascending: false }).order('name');
    setTaxRates(data || []);
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from('company_settings').upsert(settings);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Settings saved' });
      refetchBranding();
    }
    setSaving(false);
  }

  async function handleAddTradingName() {
    if (!newTradingName.trim()) {
      toast({ title: 'Error', description: 'Trading name is required', variant: 'destructive' });
      return;
    }

    const isFirst = tradingNames.length === 0;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('trading_names').insert({
      name: newTradingName.trim(),
      is_default: isFirst,
      is_active: true,
      user_id: userData.user?.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Trading name added' });
      setNewTradingName('');
      fetchTradingNames();
    }
  }

  async function handleSetDefault(id: string) {
    await supabase.from('trading_names').update({ is_default: false }).eq('is_default', true);
    const { error } = await supabase.from('trading_names').update({ is_default: true }).eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Default trading name updated' });
      fetchTradingNames();
    }
  }

  async function handleDeleteTradingName(id: string) {
    const tn = tradingNames.find(t => t.id === id);
    if (tn?.is_default) {
      toast({ title: 'Error', description: 'Cannot delete the default trading name', variant: 'destructive' });
      return;
    }

    if (!(await confirm({
      title: 'Delete this trading name?',
      confirmLabel: 'Delete',
      destructive: true,
    }))) return;

    const { error } = await supabase.from('trading_names').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Trading name deleted' });
      fetchTradingNames();
    }
  }

  // Tax Rates handlers
  async function handleAddTaxRate() {
    if (!newTaxRate.name.trim() || newTaxRate.rate === '') {
      toast({ title: 'Error', description: 'Name and rate are required', variant: 'destructive' });
      return;
    }

    const isFirst = taxRates.length === 0;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('tax_rates').insert({
      name: newTaxRate.name.trim(),
      rate: parseFloat(newTaxRate.rate),
      is_default: isFirst,
      is_active: true,
      user_id: userData.user?.id,
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Tax rate added' });
      setNewTaxRate({ name: '', rate: '' });
      fetchTaxRates();
      // If first tax rate, set as company default
      if (isFirst && data) {
        setSettings((prev: any) => ({ ...prev, default_tax_rate_id: data.id }));
      }
    }
  }

  async function handleSetDefaultTaxRate(id: string) {
    await supabase.from('tax_rates').update({ is_default: false }).eq('is_default', true);
    const { error } = await supabase.from('tax_rates').update({ is_default: true }).eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Default tax rate updated' });
      setSettings((prev: any) => ({ ...prev, default_tax_rate_id: id }));
      fetchTaxRates();
    }
  }

  async function handleDeleteTaxRate(id: string) {
    const tr = taxRates.find(t => t.id === id);
    if (tr?.is_default) {
      toast({ title: 'Error', description: 'Cannot delete the default tax rate', variant: 'destructive' });
      return;
    }

    if (!(await confirm({
      title: 'Delete this tax rate?',
      confirmLabel: 'Delete',
      destructive: true,
    }))) return;

    const { error } = await supabase.from('tax_rates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Tax rate deleted' });
      fetchTaxRates();
    }
  }

  async function handleToggleTaxRateActive(id: string, isActive: boolean) {
    const { error } = await supabase.from('tax_rates').update({ is_active: !isActive }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchTaxRates();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your business</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="trading-names">Trading Names</TabsTrigger>
          <TabsTrigger value="tax-rates">Tax Rates</TabsTrigger>
          <TabsTrigger value="invoicing">Invoicing</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Primary Trading Name</Label>
                  <Input 
                    value={settings.trading_name || ''} 
                    onChange={(e) => setSettings({ ...settings, trading_name: e.target.value })} 
                    placeholder="See Trading Names tab for multiple"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ABN</Label>
                <Input value={settings.abn || ''} onChange={(e) => setSettings({ ...settings, abn: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={settings.email || ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={settings.phone || ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={CURRENCIES.slice(0, -1).find(c => c.code === settings.currency) ? settings.currency : 'CUSTOM'}
                    onValueChange={(value) => {
                      if (value === 'CUSTOM') {
                        // Keep current values if switching to custom, or set defaults
                        if (CURRENCIES.slice(0, -1).find(c => c.code === settings.currency)) {
                          setSettings({ 
                            ...settings, 
                            currency: '',
                            currency_locale: ''
                          });
                        }
                      } else {
                        const selected = CURRENCIES.find(c => c.code === value);
                        setSettings({ 
                          ...settings, 
                          currency: value,
                          currency_locale: selected?.locale || 'en-AU'
                        });
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
                  {!CURRENCIES.slice(0, -1).find(c => c.code === settings.currency) && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Label className="text-xs">Currency Code</Label>
                        <Input 
                          value={settings.currency || ''}
                          onChange={(e) => setSettings({...settings, currency: e.target.value.toUpperCase()})}
                          placeholder="e.g., JPY"
                          maxLength={3}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Locale</Label>
                        <Input 
                          value={settings.currency_locale || ''}
                          onChange={(e) => setSettings({...settings, currency_locale: e.target.value})}
                          placeholder="e.g., ja-JP"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Default Role for New Users</Label>
                  <Select
                    value={settings.default_role_id || ''}
                    onValueChange={(value) => setSettings({ ...settings, default_role_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">New users will be assigned this role</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Customize how your app looks with your company's branding.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>App Name</Label>
                <Input 
                  value={settings.app_name || ''} 
                  onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
                  placeholder="WorkFlow"
                />
                <p className="text-sm text-muted-foreground">
                  Displayed in the sidebar header and browser tab
                </p>
              </div>

              <div className="border-t pt-6">
                <LogoUploader
                  label="Company Logo"
                  description="Displayed in the sidebar. Recommended: 200x50px, PNG or SVG"
                  currentUrl={settings.logo_url}
                  onUpload={(url) => setSettings({ ...settings, logo_url: url })}
                  folder="branding/logo"
                  previewSize="lg"
                />
              </div>

              <div className="border-t pt-6">
                <LogoUploader
                  label="Favicon"
                  description="Shown in browser tabs. Recommended: 32x32px PNG or ICO"
                  currentUrl={settings.favicon_url}
                  onUpload={(url) => setSettings({ ...settings, favicon_url: url })}
                  folder="branding/favicon"
                  previewSize="sm"
                  accept="image/png,image/x-icon,image/ico"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading-names">
          <Card>
            <CardHeader>
              <CardTitle>Trading Names</CardTitle>
              <p className="text-sm text-muted-foreground">Manage multiple trading names for your business. Select which trading name to use when creating jobs.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Add new trading name..." 
                  value={newTradingName} 
                  onChange={(e) => setNewTradingName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTradingName()}
                />
                <Button onClick={handleAddTradingName}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="space-y-4">
                {tradingNames.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No trading names added yet</p>
                ) : (
                  tradingNames.map((tn) => (
                    <TradingNameCard 
                      key={tn.id} 
                      tradingName={tn} 
                      onSetDefault={handleSetDefault}
                      onDelete={handleDeleteTradingName}
                      onUpdate={fetchTradingNames}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax-rates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Tax Rates
              </CardTitle>
              <p className="text-sm text-muted-foreground">Define tax types with custom names and rates. The default tax rate will be used for new invoice lines.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Tax name (e.g. GST, VAT)..." 
                  value={newTaxRate.name} 
                  onChange={(e) => setNewTaxRate({ ...newTaxRate, name: e.target.value })}
                  className="flex-1"
                />
                <Input 
                  type="number"
                  step="0.01"
                  placeholder="Rate %"
                  value={newTaxRate.rate} 
                  onChange={(e) => setNewTaxRate({ ...newTaxRate, rate: e.target.value })}
                  className="w-24"
                />
                <Button onClick={handleAddTaxRate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {taxRates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No tax rates added yet. Add at least one tax rate to use on invoices.</p>
                ) : (
                  taxRates.map((tr) => (
                    <div key={tr.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch 
                          checked={tr.is_active} 
                          onCheckedChange={() => handleToggleTaxRateActive(tr.id, tr.is_active)}
                        />
                        <div>
                          <span className={`font-medium ${!tr.is_active ? 'text-muted-foreground line-through' : ''}`}>
                            {tr.name}
                          </span>
                          <span className={`ml-2 text-sm ${!tr.is_active ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                            ({tr.rate}%)
                          </span>
                        </div>
                        {!!tr.is_default && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!tr.is_default && (
                          <Button variant="ghost" size="sm" onClick={() => handleSetDefaultTaxRate(tr.id)}>
                            Set as Default
                          </Button>
                        )}
                        {!tr.is_default && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTaxRate(tr.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoicing">
          <Card>
            <CardHeader><CardTitle>Invoice Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Prefix</Label>
                  <Input value={settings.invoice_prefix} onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Next Invoice Number</Label>
                  <Input type="number" value={settings.invoice_next_number} onChange={(e) => setSettings({ ...settings, invoice_next_number: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Payment Terms (days)</Label>
                  <Input type="number" value={settings.default_payment_terms} onChange={(e) => setSettings({ ...settings, default_payment_terms: parseInt(e.target.value) || 30 })} />
                </div>
                <div className="space-y-2">
                  <Label>Default Tax Rate</Label>
                  <Select
                    value={settings.default_tax_rate_id || ''}
                    onValueChange={(value) => setSettings({ ...settings, default_tax_rate_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default tax rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {taxRates.filter(tr => tr.is_active).map((tr) => (
                        <SelectItem key={tr.id} value={tr.id}>
                          {tr.name} ({tr.rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Hourly Rate ($)</Label>
                <p className="text-sm text-muted-foreground">Applied to new jobs automatically</p>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={settings.default_hourly_rate || ''} 
                  onChange={(e) => setSettings({ ...settings, default_hourly_rate: parseFloat(e.target.value) || 0 })} 
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  id="default_billing_in_advance"
                  checked={settings.default_billing_in_advance || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, default_billing_in_advance: checked })}
                />
                <div>
                  <Label htmlFor="default_billing_in_advance">Bill asset rentals in advance</Label>
                  <p className="text-sm text-muted-foreground">When enabled, invoices show the upcoming billing period (e.g., Feb invoice for Feb rent). When disabled, invoices show the previous period (arrears).</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
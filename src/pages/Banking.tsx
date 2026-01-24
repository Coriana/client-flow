import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { Plus, Building2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface BankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  bsb: string | null;
  account_number: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  is_default: boolean;
  account_id: string | null;
}

interface Account {
  id: string;
  name: string;
  code: string;
}

export default function Banking() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [chartAccounts, setChartAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [newAccount, setNewAccount] = useState({
    name: '',
    bank_name: '',
    bsb: '',
    account_number: '',
    opening_balance: 0,
    account_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, chartRes] = await Promise.all([
        supabase
          .from('bank_accounts')
          .select('*')
          .order('name'),
        supabase
          .from('accounts')
          .select('id, name, code')
          .eq('type', 'asset')
          .eq('is_active', true)
          .order('code'),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (chartRes.error) throw chartRes.error;

      setAccounts(accountsRes.data || []);
      setChartAccounts(chartRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading bank accounts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccount.name) {
      toast({
        title: 'Name required',
        description: 'Please enter an account name.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('bank_accounts').insert({
        name: newAccount.name,
        bank_name: newAccount.bank_name || null,
        bsb: newAccount.bsb || null,
        account_number: newAccount.account_number || null,
        opening_balance: newAccount.opening_balance,
        current_balance: newAccount.opening_balance,
        account_id: newAccount.account_id || null,
      });

      if (error) throw error;

      toast({ title: 'Bank account added' });
      setDialogOpen(false);
      setNewAccount({
        name: '',
        bank_name: '',
        bsb: '',
        account_number: '',
        opening_balance: 0,
        account_id: '',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error adding account',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);
  const positiveAccounts = accounts.filter(acc => acc.current_balance >= 0);
  const negativeAccounts = accounts.filter(acc => acc.current_balance < 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Banking</h1>
          <p className="text-muted-foreground">Manage bank accounts and transactions</p>
        </div>
        <PermissionGate resource="banking" action="write">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Bank Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Bank Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Account Name *</Label>
                  <Input
                    id="name"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="e.g., Business Cheque Account"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      value={newAccount.bank_name}
                      onChange={(e) => setNewAccount({ ...newAccount, bank_name: e.target.value })}
                      placeholder="e.g., CommBank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bsb">BSB</Label>
                    <Input
                      id="bsb"
                      value={newAccount.bsb}
                      onChange={(e) => setNewAccount({ ...newAccount, bsb: e.target.value })}
                      placeholder="e.g., 063-000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={newAccount.account_number}
                    onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                    placeholder="e.g., 12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opening_balance">Opening Balance</Label>
                  <Input
                    id="opening_balance"
                    type="number"
                    step="0.01"
                    value={newAccount.opening_balance}
                    onChange={(e) => setNewAccount({ ...newAccount, opening_balance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chart_account">Link to Chart of Accounts</Label>
                  <Select
                    value={newAccount.account_id}
                    onValueChange={(value) => setNewAccount({ ...newAccount, account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {chartAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddAccount} disabled={saving} className="w-full">
                  {saving ? 'Adding...' : 'Add Account'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalBalance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Balances</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${positiveAccounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {positiveAccounts.length} account{positiveAccounts.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Balances</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${Math.abs(negativeAccounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {negativeAccounts.length} account{negativeAccounts.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts Grid */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No bank accounts yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first bank account to start tracking balances and importing transactions.
            </p>
            <PermissionGate resource="banking" action="write">
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bank Account
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link key={account.id} to={`/banking/${account.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {account.is_default && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      {!account.is_active && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  {account.bank_name && (
                    <p className="text-sm text-muted-foreground">{account.bank_name}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-2xl font-bold ${Number(account.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Number(account.current_balance).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </p>
                      {account.bsb && account.account_number && (
                        <p className="text-xs text-muted-foreground">
                          BSB: {account.bsb} | Acc: {account.account_number}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

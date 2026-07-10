import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';

interface AccountSummary {
  id: string;
  name: string;
  totalTransactions: number;
  reconciledCount: number;
  unreconciledCount: number;
  reconciledAmount: number;
  unreconciledAmount: number;
  moneyIn: number;
  moneyOut: number;
  netCashFlow: number;
}

interface UnreconciledTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountName: string;
}

export default function BankReconciliationReport() {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [unreconciledTransactions, setUnreconciledTransactions] = useState<UnreconciledTransaction[]>([]);
  const [totals, setTotals] = useState({
    totalTransactions: 0,
    reconciledCount: 0,
    unreconciledCount: 0,
    moneyIn: 0,
    moneyOut: 0,
    netCashFlow: 0,
  });
  const { formatCurrency } = useBranding();

  async function fetchReport() {
    setLoading(true);

    // Fetch all bank accounts
    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('id, name')
      .eq('is_active', true);

    // Fetch all transactions in date range
    const { data: transactions } = await supabase
      .from('bank_transactions')
      .select('id, bank_account_id, date, description, amount, is_reconciled')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    // Process by account
    const accountMap = new Map<string, AccountSummary>();
    
    (bankAccounts || []).forEach(account => {
      accountMap.set(account.id, {
        id: account.id,
        name: account.name,
        totalTransactions: 0,
        reconciledCount: 0,
        unreconciledCount: 0,
        reconciledAmount: 0,
        unreconciledAmount: 0,
        moneyIn: 0,
        moneyOut: 0,
        netCashFlow: 0,
      });
    });

    const unreconciled: UnreconciledTransaction[] = [];

    (transactions || []).forEach(tx => {
      const account = accountMap.get(tx.bank_account_id);
      if (!account) return;

      account.totalTransactions++;
      
      if (tx.amount >= 0) {
        account.moneyIn += tx.amount;
      } else {
        account.moneyOut += Math.abs(tx.amount);
      }

      if (tx.is_reconciled) {
        account.reconciledCount++;
        account.reconciledAmount += Math.abs(tx.amount);
      } else {
        account.unreconciledCount++;
        account.unreconciledAmount += Math.abs(tx.amount);
        unreconciled.push({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          accountName: account.name,
        });
      }

      account.netCashFlow += tx.amount;
    });

    const accountList = Array.from(accountMap.values()).filter(a => a.totalTransactions > 0);

    // Calculate totals
    const totalStats = accountList.reduce(
      (acc, a) => ({
        totalTransactions: acc.totalTransactions + a.totalTransactions,
        reconciledCount: acc.reconciledCount + a.reconciledCount,
        unreconciledCount: acc.unreconciledCount + a.unreconciledCount,
        moneyIn: acc.moneyIn + a.moneyIn,
        moneyOut: acc.moneyOut + a.moneyOut,
        netCashFlow: acc.netCashFlow + a.netCashFlow,
      }),
      { totalTransactions: 0, reconciledCount: 0, unreconciledCount: 0, moneyIn: 0, moneyOut: 0, netCashFlow: 0 }
    );

    setAccounts(accountList);
    setUnreconciledTransactions(unreconciled.slice(0, 20)); // Show top 20
    setTotals(totalStats);
    setLoading(false);
  }

  useEffect(() => {
    fetchReport();
  }, []);

  const reconciliationPercentage = totals.totalTransactions > 0 
    ? (totals.reconciledCount / totals.totalTransactions) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? 'Loading...' : 'Run Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Reconciled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totals.reconciledCount}</div>
            <p className="text-xs text-muted-foreground">of {totals.totalTransactions} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-orange-600" />
              Unreconciled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totals.unreconciledCount}</div>
            <p className="text-xs text-muted-foreground">need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-green-600" />
              Money In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.moneyIn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-red-600" />
              Money Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.moneyOut)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Reconciliation Progress</span>
            <span className="text-2xl font-bold">{reconciliationPercentage.toFixed(1)}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={reconciliationPercentage} className="h-3" />
          <p className="text-sm text-muted-foreground mt-2">
            Net Cash Flow: <span className={totals.netCashFlow >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {formatCurrency(totals.netCashFlow)}
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Account Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>By Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Reconciled</TableHead>
                <TableHead className="text-right">Unreconciled</TableHead>
                <TableHead className="text-right">Money In</TableHead>
                <TableHead className="text-right">Money Out</TableHead>
                <TableHead className="text-right">Net Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No transactions in date range
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell className="text-right">{account.totalTransactions}</TableCell>
                    <TableCell className="text-right text-green-600">{account.reconciledCount}</TableCell>
                    <TableCell className="text-right text-orange-600">{account.unreconciledCount}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(account.moneyIn)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(account.moneyOut)}</TableCell>
                    <TableCell className={`text-right font-medium ${account.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(account.netCashFlow)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unreconciled Transactions */}
      {unreconciledTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unreconciled Transactions (Top 20)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unreconciledTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{tx.accountName}</TableCell>
                    <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                    <TableCell className={`text-right ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfYear } from 'date-fns';

interface PLData {
  income: number;
  writtenOff: number;
  expenses: number;
  purchases: number;
  netProfit: number;
}

export default function ProfitLossReport() {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PLData | null>(null);
  const [incomeByClient, setIncomeByClient] = useState<{ name: string; amount: number }[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<{ category: string; amount: number }[]>([]);
  const [purchasesByVendor, setPurchasesByVendor] = useState<{ name: string; amount: number }[]>([]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  async function fetchReport() {
    setLoading(true);

    // Fetch paid invoices (income)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total, amount_paid, status, client_id, clients(name)')
      .in('status', ['paid', 'partially_paid'])
      .gte('issue_date', startDate)
      .lte('issue_date', endDate);

    // Fetch written off invoices (bad debt)
    const { data: writtenOffInvoices } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('status', 'written_off')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate);

    // Fetch expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category')
      .gte('date', startDate)
      .lte('date', endDate);

    // Fetch purchases (bills paid)
    const { data: purchases } = await supabase
      .from('purchases')
      .select('total, vendor_name, vendors(name)')
      .gte('date', startDate)
      .lte('date', endDate);

    // Calculate totals
    const income = (invoices || []).reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
    const writtenOff = (writtenOffInvoices || []).reduce((sum, inv) => sum + ((inv.total || 0) - (inv.amount_paid || 0)), 0);
    const totalExpenses = (expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalPurchases = (purchases || []).reduce((sum, p) => sum + (p.total || 0), 0);

    // Group income by client
    const clientMap = new Map<string, number>();
    (invoices || []).forEach(inv => {
      const clientName = (inv.clients as any)?.name || 'Unknown';
      clientMap.set(clientName, (clientMap.get(clientName) || 0) + (inv.amount_paid || 0));
    });
    const clientBreakdown = Array.from(clientMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Group expenses by category
    const catMap = new Map<string, number>();
    (expenses || []).forEach(exp => {
      const cat = exp.category || 'Uncategorized';
      catMap.set(cat, (catMap.get(cat) || 0) + (exp.amount || 0));
    });
    const catBreakdown = Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Group purchases by vendor
    const vendorMap = new Map<string, number>();
    (purchases || []).forEach(p => {
      const vendorName = (p.vendors as any)?.name || p.vendor_name || 'Unknown';
      vendorMap.set(vendorName, (vendorMap.get(vendorName) || 0) + (p.total || 0));
    });
    const vendorBreakdown = Array.from(vendorMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    setData({
      income,
      writtenOff,
      expenses: totalExpenses,
      purchases: totalPurchases,
      netProfit: income - totalExpenses - totalPurchases - writtenOff,
    });
    setIncomeByClient(clientBreakdown);
    setExpensesByCategory(catBreakdown);
    setPurchasesByVendor(vendorBreakdown);
    setLoading(false);
  }

  useEffect(() => {
    fetchReport();
  }, []);

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

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(data.income)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(data.expenses)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(data.purchases)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bad Debt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(data.writtenOff)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(data.netProfit)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Income by Client</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeByClient.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No income recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      incomeByClient.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expensesByCategory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No expenses recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      expensesByCategory.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.category}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purchases by Vendor</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchasesByVendor.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No purchases recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchasesByVendor.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

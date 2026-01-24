import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  current_stock: number;
  unit_cost: number;
  sales_price: number;
  total_cost_value: number;
  total_sales_value: number;
  is_active: boolean;
  reorder_level: number;
}

export default function InventoryValuationReport() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const fetchReport = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching items:', error);
      setLoading(false);
      return;
    }

    const mapped = data?.map(item => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      current_stock: item.current_stock || 0,
      unit_cost: Number(item.unit_cost) || 0,
      sales_price: Number(item.sales_price) || 0,
      total_cost_value: (item.current_stock || 0) * (Number(item.unit_cost) || 0),
      total_sales_value: (item.current_stock || 0) * (Number(item.sales_price) || 0),
      is_active: item.is_active ?? true,
      reorder_level: item.reorder_level || 0,
    })) || [];

    setItems(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const totals = {
    items: items.length,
    activeItems: items.filter(i => i.is_active).length,
    totalUnits: items.reduce((s, i) => s + i.current_stock, 0),
    costValue: items.reduce((s, i) => s + i.total_cost_value, 0),
    salesValue: items.reduce((s, i) => s + i.total_sales_value, 0),
    lowStock: items.filter(i => i.is_active && i.current_stock <= i.reorder_level).length,
  };

  const categories = [...new Set(items.map(i => i.category || 'Uncategorized'))].sort();
  const categoryTotals = categories.map(cat => {
    const catItems = items.filter(i => (i.category || 'Uncategorized') === cat);
    return {
      category: cat,
      count: catItems.length,
      units: catItems.reduce((s, i) => s + i.current_stock, 0),
      costValue: catItems.reduce((s, i) => s + i.total_cost_value, 0),
      salesValue: catItems.reduce((s, i) => s + i.total_sales_value, 0),
    };
  });

  if (loading) return <div className="text-muted-foreground">Loading report...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.items}</div>
            <p className="text-xs text-muted-foreground">{totals.activeItems} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalUnits.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cost Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.costValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sales Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.salesValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Potential Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totals.salesValue - totals.costValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totals.lowStock}</div>
            <p className="text-xs text-muted-foreground">items need reorder</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Value by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Cost Value</TableHead>
                <TableHead className="text-right">Sales Value</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryTotals.map(cat => (
                <TableRow key={cat.category}>
                  <TableCell className="font-medium">{cat.category}</TableCell>
                  <TableCell className="text-right">{cat.count}</TableCell>
                  <TableCell className="text-right">{cat.units.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatCurrency(cat.costValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(cat.salesValue)}</TableCell>
                  <TableCell className="text-right">
                    {cat.costValue > 0 ? (((cat.salesValue - cat.costValue) / cat.costValue) * 100).toFixed(1) : 0}%
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totals.items}</TableCell>
                <TableCell className="text-right">{totals.totalUnits.toLocaleString()}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.costValue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.salesValue)}</TableCell>
                <TableCell className="text-right">
                  {totals.costValue > 0 ? (((totals.salesValue - totals.costValue) / totals.costValue) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Sales Price</TableHead>
                <TableHead className="text-right">Cost Value</TableHead>
                <TableHead className="text-right">Sales Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    <Link to={`/inventory/${item.id}`} className="text-primary hover:underline font-mono">
                      {item.sku}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category || '-'}</TableCell>
                  <TableCell className="text-right">
                    {item.current_stock <= item.reorder_level && item.is_active ? (
                      <span className="text-amber-600 font-medium">{item.current_stock}</span>
                    ) : (
                      item.current_stock
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.sales_price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.total_cost_value)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.total_sales_value)}</TableCell>
                  <TableCell>
                    {!item.is_active ? (
                      <Badge variant="secondary">Inactive</Badge>
                    ) : item.current_stock <= item.reorder_level ? (
                      <Badge variant="destructive">Low Stock</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {items.length === 0 && <p className="text-center text-muted-foreground py-8">No inventory items found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

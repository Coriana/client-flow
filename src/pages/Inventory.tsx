import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, AlertTriangle, Package } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { EmptyState } from '@/components/EmptyState';
import { ListPagination } from '@/components/ListPagination';
import { usePagination } from '@/hooks/usePagination';
import type { Tables } from '@/integrations/supabase/types';

type Item = Tables<'items'>;

async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching items:', error);
    return [];
  }
  return data || [];
}

export default function Inventory() {
  const [search, setSearch] = useState('');
  const { formatCurrency } = useBranding();
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ['inventory'],
    queryFn: fetchItems,
  });

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase()) ||
    item.category?.toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filteredItems);

  const lowStockItems = items.filter(item =>
    (item.current_stock || 0) <= (item.reorder_level || 0) && item.is_active
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage items and stock levels</p>
        </div>
        <Button asChild>
          <Link to="/inventory/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Link>
        </Button>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">Low Stock Alert</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder level
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search items..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <>
          {/* table (desktop) */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          </div>
        </>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items yet"
          description="Add an item to start tracking stock levels and pricing."
          action={
            <Button asChild>
              <Link to="/inventory/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* table (desktop) */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">No matches for "{search}"</p>
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                        Clear search
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.pageItems.map((item) => {
                    const isLowStock = (item.current_stock || 0) <= (item.reorder_level || 0);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-10 w-10 object-cover rounded"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                              —
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell>
                          <Link
                            to={`/inventory/${item.id}`}
                            className="font-medium hover:underline"
                          >
                            {item.name}
                          </Link>
                        </TableCell>
                        <TableCell>{item.category || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_cost ?? 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.sales_price ?? 0)}</TableCell>
                        <TableCell className="text-right">
                          <span className={isLowStock ? 'text-yellow-600 dark:text-yellow-400 font-medium' : ''}>
                            {item.current_stock}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? (isLowStock ? 'outline' : 'default') : 'secondary'}>
                            {item.is_active ? (isLowStock ? 'Low Stock' : 'Active') : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No matches for "{search}"</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              pagination.pageItems.map((item) => {
                const isLowStock = (item.current_stock || 0) <= (item.reorder_level || 0);
                return (
                  <Link
                    key={item.id}
                    to={`/inventory/${item.id}`}
                    className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <p className="text-sm text-muted-foreground font-mono">{item.sku}</p>
                      </div>
                      <Badge variant={item.is_active ? (isLowStock ? 'outline' : 'default') : 'secondary'}>
                        {item.is_active ? (isLowStock ? 'Low Stock' : 'Active') : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatCurrency(item.sales_price ?? 0)}</span>
                      <span className={isLowStock ? 'font-medium text-yellow-600 dark:text-yellow-400' : 'font-medium'}>
                        {item.current_stock} in stock
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <ListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.setPage}
          />
        </>
      )}
    </div>
  );
}

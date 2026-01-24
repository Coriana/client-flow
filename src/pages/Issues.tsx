import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Issue = Tables<'issues'> & { clients?: { name: string } | null };

const severityColors: Record<string, string> = { low: 'secondary', medium: 'default', high: 'outline', critical: 'destructive' };
const statusColors: Record<string, string> = { open: 'destructive', in_progress: 'default', resolved: 'secondary', closed: 'outline' };

export default function Issues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchIssues() {
      const { data } = await supabase.from('issues').select('*, clients(name)').order('created_at', { ascending: false });
      setIssues(data || []);
      setLoading(false);
    }
    fetchIssues();
  }, []);

  const filteredIssues = issues.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Issues</h1><p className="text-muted-foreground">Track and resolve issues</p></div>
        <Button asChild><Link to="/issues/new"><Plus className="h-4 w-4 mr-2" />Log Issue</Link></Button>
      </div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Client</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filteredIssues.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No issues</TableCell></TableRow> :
            filteredIssues.map(issue => (
              <TableRow key={issue.id}>
                <TableCell><Link to={`/issues/${issue.id}`} className="font-medium hover:underline">{issue.title}</Link></TableCell>
                <TableCell>{issue.clients?.name || '-'}</TableCell>
                <TableCell><Badge variant={severityColors[issue.severity] as any}>{issue.severity}</Badge></TableCell>
                <TableCell><Badge variant={statusColors[issue.status] as any}>{issue.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell>{new Date(issue.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

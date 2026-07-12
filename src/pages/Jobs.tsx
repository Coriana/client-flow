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
import { Plus, Search, Briefcase } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { EmptyState } from '@/components/EmptyState';
import { ListPagination } from '@/components/ListPagination';
import { usePagination } from '@/hooks/usePagination';
import type { Tables } from '@/integrations/supabase/types';

type Job = Tables<'jobs'> & { clients?: { name: string } | null };

const statusColors: Record<string, string> = {
  prospect: 'secondary',
  active: 'default',
  on_hold: 'outline',
  complete: 'default',
  archived: 'secondary',
};

async function fetchJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, clients(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
  return data || [];
}

export default function Jobs() {
  const [search, setSearch] = useState('');
  const { formatCurrency } = useBranding();
  const { data: jobs = [], isLoading: loading } = useQuery({
    queryKey: ['jobs'],
    queryFn: fetchJobs,
  });

  const filteredJobs = jobs.filter(job =>
    job.name.toLowerCase().includes(search.toLowerCase()) ||
    job.job_number.toLowerCase().includes(search.toLowerCase()) ||
    job.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filteredJobs);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">Track your projects and work</p>
        </div>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search jobs..." 
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
                  <TableHead>Job #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Create a job to start tracking work and budgets for a client."
          action={
            <Button asChild>
              <Link to="/jobs/new">
                <Plus className="h-4 w-4 mr-2" />
                New Job
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
                  <TableHead>Job #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No matches for "{search}"</p>
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                        Clear search
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.pageItems.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-sm">{job.job_number}</TableCell>
                      <TableCell>
                        <Link
                          to={`/jobs/${job.id}`}
                          className="font-medium hover:underline"
                        >
                          {job.name}
                        </Link>
                      </TableCell>
                      <TableCell>{job.clients?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[job.status] as any || 'secondary'}>
                          {job.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{job.budget ? formatCurrency(job.budget) : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No matches for "{search}"</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              pagination.pageItems.map((job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{job.name}</span>
                    <Badge variant={statusColors[job.status] as any || 'secondary'}>
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{job.job_number}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{job.clients?.name || '-'}</span>
                    <span className="font-medium">{job.budget ? formatCurrency(job.budget) : '-'}</span>
                  </div>
                </Link>
              ))
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

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDisplayDate, todayLocal } from '@/lib/dates';
import type { Tables } from '@/integrations/supabase/types';

type JobAsset = Tables<'job_assets'>;
type Job = Tables<'jobs'>;

interface AssetConflict {
  assetId: string;
  conflictType: 'blocked' | 'warning';
  message: string;
  conflictingJobId: string;
  conflictingJobName: string;
  conflictingJobStatus: string;
}

interface ConflictResult {
  conflicts: AssetConflict[];
  checkAssetAvailability: (assetId: string, startDate: string, endDate?: string, excludeJobAssetId?: string) => AssetConflict | null;
}

export function useAssetConflicts(currentJobId?: string): ConflictResult {
  const [allRentals, setAllRentals] = useState<(JobAsset & { jobs?: Job })[]>([]);

  useEffect(() => {
    async function fetchRentals() {
      const today = todayLocal();
      
      // Fetch all rentals that either:
      // 1. Have no end date (ongoing), OR
      // 2. Have an end date in the future
      const { data } = await supabase
        .from('job_assets')
        .select('*, jobs(*)')
        .or(`rental_end_date.is.null,rental_end_date.gte.${today}`);
      
      setAllRentals(data || []);
    }
    fetchRentals();
  }, [currentJobId]);

  const checkAssetAvailability = (
    assetId: string, 
    startDate: string, 
    endDate?: string,
    excludeJobAssetId?: string
  ): AssetConflict | null => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    for (const rental of allRentals) {
      // Skip if same job_asset being edited
      if (excludeJobAssetId && rental.id === excludeJobAssetId) continue;
      // Skip if different asset
      if (rental.asset_id !== assetId) continue;

      const rentalStart = new Date(rental.rental_start_date);
      const rentalEnd = rental.rental_end_date ? new Date(rental.rental_end_date) : null;
      const jobStatus = rental.jobs?.status || 'active';
      const jobName = rental.jobs?.name || 'Unknown';
      const jobId = rental.job_id;

      // Skip if same job (allowing multiple rentals of same asset on same job if needed)
      if (jobId === currentJobId) continue;

      // Check for overlap
      const hasOverlap = checkDateOverlap(start, end, rentalStart, rentalEnd);
      
      if (hasOverlap) {
        // Prospect job = warning only (can be overridden)
        if (jobStatus === 'prospect') {
          return {
            assetId,
            conflictType: 'warning',
            message: `Asset is potentially booked for prospect job "${jobName}" during this period.`,
            conflictingJobId: jobId,
            conflictingJobName: jobName,
            conflictingJobStatus: jobStatus,
          };
        }

        // Any other job status (active, complete, on_hold, archived) with overlap = blocked
        // As long as the rental period overlaps, the asset is unavailable
        if (!rentalEnd) {
          return {
            assetId,
            conflictType: 'blocked',
            message: `Asset is currently rented to "${jobName}" with no end date. Set an end date on that rental first.`,
            conflictingJobId: jobId,
            conflictingJobName: jobName,
            conflictingJobStatus: jobStatus,
          };
        }
        
        return {
          assetId,
          conflictType: 'blocked',
          message: `Asset is already rented to "${jobName}" during this period (${formatDisplayDate(rental.rental_start_date)} to ${formatDisplayDate(rental.rental_end_date)}).`,
          conflictingJobId: jobId,
          conflictingJobName: jobName,
          conflictingJobStatus: jobStatus,
        };
      }
    }

    return null;
  };

  // Get all conflicts for assets assigned to current job
  const conflicts: AssetConflict[] = [];
  const currentJobRentals = allRentals.filter(r => r.job_id === currentJobId);
  
  for (const rental of currentJobRentals) {
    const conflict = checkAssetAvailability(
      rental.asset_id, 
      rental.rental_start_date, 
      rental.rental_end_date || undefined,
      rental.id
    );
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return { conflicts, checkAssetAvailability };
}

function checkDateOverlap(
  start1: Date, 
  end1: Date | null, 
  start2: Date, 
  end2: Date | null
): boolean {
  // If both have no end date, they overlap if they started
  if (!end1 && !end2) return true;
  
  // If first has no end, it overlaps if second starts after first
  if (!end1) {
    return end2 ? end2 >= start1 : true;
  }
  
  // If second has no end, it overlaps if first ends after second starts
  if (!end2) {
    return end1 >= start2;
  }
  
  // Both have end dates - standard overlap check
  return start1 <= end2 && end1 >= start2;
}

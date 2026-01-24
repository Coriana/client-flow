import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';

interface SetupStatus {
  isComplete: boolean;
  isLoading: boolean;
  missingSteps: string[];
  refetch: () => void;
}

export function useSetupComplete(): SetupStatus {
  const { user } = useAuth();
  const { canWrite, loading: permissionsLoading } = usePermissions();
  const [isComplete, setIsComplete] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [missingSteps, setMissingSteps] = useState<string[]>([]);

  const checkSetup = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Wait for permissions to load
    if (permissionsLoading) {
      setIsLoading(true);
      return;
    }

    // Use the RPC function that bypasses RLS to check setup status
    // This works for all authenticated users regardless of their role
    try {
      const { data: setupComplete, error: rpcError } = await supabase
        .rpc('is_setup_complete');

      if (rpcError) {
        console.error('Error checking setup status:', rpcError);
        // On error, assume complete to not block users
        setIsComplete(true);
        setMissingSteps([]);
        setIsLoading(false);
        return;
      }

      // If setup is complete, we're done
      if (setupComplete) {
        setIsComplete(true);
        setMissingSteps([]);
        setIsLoading(false);
        return;
      }

      // Setup is not complete - but only show wizard to users who can actually complete it
      // Users without settings write permission should just proceed normally
      if (!canWrite('settings')) {
        setIsComplete(true);
        setMissingSteps([]);
        setIsLoading(false);
        return;
      }

      // User can write settings and setup is not complete - fetch details for the wizard
      const { data: settings } = await supabase
        .from('company_settings')
        .select('setup_completed, name')
        .limit(1)
        .single();

      // If explicitly marked complete, we're done
      if (settings?.setup_completed) {
        setIsComplete(true);
        setMissingSteps([]);
        setIsLoading(false);
        return;
      }

      // Otherwise check individual requirements
      const missing: string[] = [];

      // Check if company name is still default
      if (!settings || settings.name === 'My Company') {
        missing.push('company');
      }

      // Check for trading names
      const { count: tradingCount } = await supabase
        .from('trading_names')
        .select('*', { count: 'exact', head: true });

      if (!tradingCount || tradingCount === 0) {
        missing.push('trading_name');
      }

      // Check for bank accounts
      const { count: bankCount } = await supabase
        .from('bank_accounts')
        .select('*', { count: 'exact', head: true });

      if (!bankCount || bankCount === 0) {
        missing.push('bank_account');
      }

      setMissingSteps(missing);
      setIsComplete(missing.length === 0);
    } catch (error) {
      console.error('Error checking setup status:', error);
      setIsComplete(true); // Don't block on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSetup();
  }, [user, permissionsLoading, canWrite]);

  return { isComplete, isLoading, missingSteps, refetch: checkSetup };
}

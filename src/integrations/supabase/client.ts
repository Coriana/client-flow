/**
 * API Client - Now using local SQLite backend
 * 
 * This module re-exports the local API client with the same interface
 * as the original Supabase client, allowing existing code to work unchanged.
 * 
 * Import the client like this:
 * import { supabase } from "@/integrations/supabase/client";
 */

export { supabase } from '@/integrations/api/client';

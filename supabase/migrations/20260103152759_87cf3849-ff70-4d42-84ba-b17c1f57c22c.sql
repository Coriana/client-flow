-- Fix STORAGE_EXPOSURE: Make buckets private and update policies

-- Make all buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('images', 'documents', 'kb-files');

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;

-- Create authenticated policies for images bucket
CREATE POLICY "Authenticated users can view images" ON storage.objects
  FOR SELECT USING (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Create authenticated policies for documents bucket  
CREATE POLICY "Authenticated users can view documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
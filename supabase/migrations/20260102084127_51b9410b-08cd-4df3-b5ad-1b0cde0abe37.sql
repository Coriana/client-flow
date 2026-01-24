-- Create asset_documents table for PDF uploads
CREATE TABLE public.asset_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issue_bookmarks table for resolution bookmarks
CREATE TABLE public.issue_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  bookmark_label TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issue_bookmark_links for cross-issue references
CREATE TABLE public.issue_bookmark_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  target_bookmark_id UUID NOT NULL REFERENCES public.issue_bookmarks(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_issue_id, target_bookmark_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_bookmark_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for asset_documents
CREATE POLICY "Users can view asset documents" ON public.asset_documents
  FOR SELECT USING (can_read('assets'));

CREATE POLICY "Users can insert asset documents" ON public.asset_documents
  FOR INSERT WITH CHECK (can_write('assets'));

CREATE POLICY "Users can update asset documents" ON public.asset_documents
  FOR UPDATE USING (can_write('assets'));

CREATE POLICY "Users can delete asset documents" ON public.asset_documents
  FOR DELETE USING (can_write('assets'));

-- RLS policies for issue_bookmarks
CREATE POLICY "Users can view issue bookmarks" ON public.issue_bookmarks
  FOR SELECT USING (can_read('issues'));

CREATE POLICY "Users can insert issue bookmarks" ON public.issue_bookmarks
  FOR INSERT WITH CHECK (can_write('issues'));

CREATE POLICY "Users can update issue bookmarks" ON public.issue_bookmarks
  FOR UPDATE USING (can_write('issues'));

CREATE POLICY "Users can delete issue bookmarks" ON public.issue_bookmarks
  FOR DELETE USING (can_write('issues'));

-- RLS policies for issue_bookmark_links
CREATE POLICY "Users can view bookmark links" ON public.issue_bookmark_links
  FOR SELECT USING (can_read('issues'));

CREATE POLICY "Users can insert bookmark links" ON public.issue_bookmark_links
  FOR INSERT WITH CHECK (can_write('issues'));

CREATE POLICY "Users can delete bookmark links" ON public.issue_bookmark_links
  FOR DELETE USING (can_write('issues'));

-- Create a documents storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "Anyone can view documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update documents" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
-- =====================================================
-- KNOWLEDGE BASE SYSTEM
-- =====================================================

-- Create kb_articles table
CREATE TABLE public.kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  tags TEXT[],
  status TEXT NOT NULL DEFAULT 'draft',
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create kb_attachments table (images/PDFs up to 10MB)
CREATE TABLE public.kb_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create kb_article_issues junction table (flexible multi-stage linking)
CREATE TABLE public.kb_article_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'reference',
  stage_notes TEXT,
  applied_by UUID REFERENCES public.profiles(id),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  helped_resolve BOOLEAN,
  UNIQUE(article_id, issue_id, link_type)
);

-- Create kb_article_history table
CREATE TABLE public.kb_article_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES public.profiles(id),
  api_key_id UUID REFERENCES public.api_keys(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for kb tables
CREATE INDEX idx_kb_articles_category ON public.kb_articles(category);
CREATE INDEX idx_kb_articles_status ON public.kb_articles(status);
CREATE INDEX idx_kb_articles_tags ON public.kb_articles USING GIN(tags);
CREATE INDEX idx_kb_attachments_article ON public.kb_attachments(article_id);
CREATE INDEX idx_kb_article_issues_article ON public.kb_article_issues(article_id);
CREATE INDEX idx_kb_article_issues_issue ON public.kb_article_issues(issue_id);

-- Enable RLS on kb tables
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_article_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_article_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for kb_articles
CREATE POLICY "Users can view KB articles" ON public.kb_articles FOR SELECT USING (can_read('issues'));
CREATE POLICY "Users can insert KB articles" ON public.kb_articles FOR INSERT WITH CHECK (can_write('issues'));
CREATE POLICY "Users can update KB articles" ON public.kb_articles FOR UPDATE USING (can_write('issues'));
CREATE POLICY "Users can delete KB articles" ON public.kb_articles FOR DELETE USING (can_write('issues'));

-- RLS policies for kb_attachments
CREATE POLICY "Users can view KB attachments" ON public.kb_attachments FOR SELECT USING (can_read('issues'));
CREATE POLICY "Users can insert KB attachments" ON public.kb_attachments FOR INSERT WITH CHECK (can_write('issues'));
CREATE POLICY "Users can update KB attachments" ON public.kb_attachments FOR UPDATE USING (can_write('issues'));
CREATE POLICY "Users can delete KB attachments" ON public.kb_attachments FOR DELETE USING (can_write('issues'));

-- RLS policies for kb_article_issues
CREATE POLICY "Users can view KB article issues" ON public.kb_article_issues FOR SELECT USING (can_read('issues'));
CREATE POLICY "Users can insert KB article issues" ON public.kb_article_issues FOR INSERT WITH CHECK (can_write('issues'));
CREATE POLICY "Users can update KB article issues" ON public.kb_article_issues FOR UPDATE USING (can_write('issues'));
CREATE POLICY "Users can delete KB article issues" ON public.kb_article_issues FOR DELETE USING (can_write('issues'));

-- RLS policies for kb_article_history
CREATE POLICY "Users can view KB article history" ON public.kb_article_history FOR SELECT USING (can_read('issues'));
CREATE POLICY "Users can insert KB article history" ON public.kb_article_history FOR INSERT WITH CHECK (can_write('issues'));

-- =====================================================
-- LOCATIONS SYSTEM
-- =====================================================

-- Create locations table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_type TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'Australia',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create location_contacts table
CREATE TABLE public.location_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add location_id to existing tables
ALTER TABLE public.vendors ADD COLUMN location_id UUID REFERENCES public.locations(id);
ALTER TABLE public.clients ADD COLUMN location_id UUID REFERENCES public.locations(id);
ALTER TABLE public.assets ADD COLUMN location_id UUID REFERENCES public.locations(id);
ALTER TABLE public.jobs ADD COLUMN location_id UUID REFERENCES public.locations(id);

-- Create indexes for locations
CREATE INDEX idx_locations_type ON public.locations(location_type);
CREATE INDEX idx_locations_active ON public.locations(is_active);
CREATE INDEX idx_location_contacts_location ON public.location_contacts(location_id);
CREATE INDEX idx_vendors_location ON public.vendors(location_id);
CREATE INDEX idx_clients_location ON public.clients(location_id);
CREATE INDEX idx_assets_location ON public.assets(location_id);
CREATE INDEX idx_jobs_location ON public.jobs(location_id);

-- Enable RLS on location tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for locations (use settings resource since it's general config)
CREATE POLICY "Users can view locations" ON public.locations FOR SELECT USING (can_read('settings'));
CREATE POLICY "Users can insert locations" ON public.locations FOR INSERT WITH CHECK (can_write('settings'));
CREATE POLICY "Users can update locations" ON public.locations FOR UPDATE USING (can_write('settings'));
CREATE POLICY "Users can delete locations" ON public.locations FOR DELETE USING (can_write('settings'));

-- RLS policies for location_contacts
CREATE POLICY "Users can view location contacts" ON public.location_contacts FOR SELECT USING (can_read('settings'));
CREATE POLICY "Users can insert location contacts" ON public.location_contacts FOR INSERT WITH CHECK (can_write('settings'));
CREATE POLICY "Users can update location contacts" ON public.location_contacts FOR UPDATE USING (can_write('settings'));
CREATE POLICY "Users can delete location contacts" ON public.location_contacts FOR DELETE USING (can_write('settings'));

-- =====================================================
-- STORAGE BUCKET FOR KB FILES
-- =====================================================

-- Create kb-files bucket with 10MB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kb-files', 'kb-files', true, 10485760);

-- Storage policies for kb-files bucket
CREATE POLICY "Users can upload KB files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kb-files' AND can_write('issues'));
CREATE POLICY "Users can view KB files" ON storage.objects FOR SELECT USING (bucket_id = 'kb-files' AND can_read('issues'));
CREATE POLICY "Users can delete KB files" ON storage.objects FOR DELETE USING (bucket_id = 'kb-files' AND can_write('issues'));

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Add updated_at trigger for kb_articles
CREATE TRIGGER update_kb_articles_updated_at
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add updated_at trigger for locations
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- ADD RESOURCES FOR PERMISSIONS
-- =====================================================

-- Add kb and locations to resources table if it exists
INSERT INTO public.resources (name, display_name, category, sort_order) VALUES
  ('knowledge_base', 'Knowledge Base', 'Operations', 55),
  ('locations', 'Locations', 'Settings', 85)
ON CONFLICT (name) DO NOTHING;
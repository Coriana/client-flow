-- Create junction tables for issues to support multiple jobs and assets

CREATE TABLE public.issue_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(issue_id, job_id)
);

CREATE TABLE public.issue_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(issue_id, asset_id)
);

-- Enable RLS
ALTER TABLE public.issue_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for issue_jobs
CREATE POLICY "All can view issue_jobs" ON public.issue_jobs
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage issue_jobs" ON public.issue_jobs
  FOR ALL USING (NOT has_role(auth.uid(), 'readonly'));

-- RLS Policies for issue_assets
CREATE POLICY "All can view issue_assets" ON public.issue_assets
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage issue_assets" ON public.issue_assets
  FOR ALL USING (NOT has_role(auth.uid(), 'readonly'));

-- Migrate existing data from issues table to junction tables
INSERT INTO public.issue_jobs (issue_id, job_id)
SELECT id, job_id FROM public.issues WHERE job_id IS NOT NULL;

INSERT INTO public.issue_assets (issue_id, asset_id)
SELECT id, asset_id FROM public.issues WHERE asset_id IS NOT NULL;
-- Create api_keys table for service account/AI access
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Create indexes for fast lookups
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);

-- Create api_request_log table for auditing
CREATE TABLE public.api_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  request_body JSONB,
  response_summary TEXT,
  ip_address TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_request_log_api_key ON public.api_request_log(api_key_id);
CREATE INDEX idx_api_request_log_created_at ON public.api_request_log(created_at);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_keys - Owners can manage all, users can view their own
CREATE POLICY "Owners can manage all API keys"
ON public.api_keys FOR ALL
USING (is_owner(auth.uid()));

CREATE POLICY "Users can view their own API keys"
ON public.api_keys FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own API keys"
ON public.api_keys FOR INSERT
WITH CHECK (user_id = auth.uid() OR is_owner(auth.uid()));

CREATE POLICY "Users can revoke their own API keys"
ON public.api_keys FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own API keys"
ON public.api_keys FOR DELETE
USING (user_id = auth.uid());

-- RLS policies for api_request_log
CREATE POLICY "Owners can view all API logs"
ON public.api_request_log FOR SELECT
USING (is_owner(auth.uid()));

CREATE POLICY "Users can view logs for their own keys"
ON public.api_request_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.api_keys ak 
    WHERE ak.id = api_request_log.api_key_id 
    AND ak.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert API logs"
ON public.api_request_log FOR INSERT
WITH CHECK (true);

-- Function to validate API key and return user info
CREATE OR REPLACE FUNCTION public.validate_api_key(raw_key TEXT)
RETURNS TABLE (
  key_user_id UUID,
  key_api_key_id UUID,
  key_scopes TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_record RECORD;
  computed_hash TEXT;
BEGIN
  -- Compute hash of the provided key
  computed_hash := encode(sha256(raw_key::bytea), 'hex');
  
  -- Find matching key
  SELECT ak.id, ak.user_id, ak.scopes, ak.is_active, ak.expires_at
  INTO key_record
  FROM api_keys ak
  WHERE ak.key_hash = computed_hash;
  
  -- Key not found
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Key is inactive
  IF NOT key_record.is_active THEN
    RETURN;
  END IF;
  
  -- Key is expired
  IF key_record.expires_at IS NOT NULL AND key_record.expires_at < now() THEN
    RETURN;
  END IF;
  
  -- Update last used timestamp
  UPDATE api_keys SET last_used_at = now() WHERE id = key_record.id;
  
  -- Return valid key info
  RETURN QUERY SELECT key_record.user_id, key_record.id, key_record.scopes;
END;
$$;

-- Add api_keys resource to resources table for permission management
INSERT INTO public.resources (name, display_name, category)
VALUES ('api_keys', 'API Keys', 'settings')
ON CONFLICT (name) DO NOTHING;

-- Grant write permission on api_keys to owner role
INSERT INTO public.role_permissions (role_id, resource_id, permission)
SELECT r.id, res.id, 'write'::permission_level
FROM public.roles r
CROSS JOIN public.resources res
WHERE r.name = 'owner' AND res.name = 'api_keys'
ON CONFLICT DO NOTHING;
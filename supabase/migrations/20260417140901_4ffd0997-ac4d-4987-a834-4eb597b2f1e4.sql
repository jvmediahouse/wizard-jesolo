-- 1. App role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check role (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. wizard_submissions table
CREATE TABLE public.wizard_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Lead info
  name TEXT,
  surname TEXT,
  email TEXT,
  city TEXT,
  province TEXT,
  country TEXT,
  age_range TEXT,
  -- Wizard answers
  path TEXT,
  travel_group TEXT,
  interests TEXT[],
  beach_preference TEXT,
  sports TEXT[],
  event_types TEXT[],
  selected_date DATE,
  end_date DATE,
  -- Consents
  privacy_consent BOOLEAN DEFAULT false,
  newsletter BOOLEAN DEFAULT false,
  -- Generated plan
  generated_plan JSONB
);

ALTER TABLE public.wizard_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can submit
CREATE POLICY "Anyone can insert wizard submissions"
ON public.wizard_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view all wizard submissions"
ON public.wizard_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete wizard submissions"
ON public.wizard_submissions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_wizard_submissions_created_at ON public.wizard_submissions(created_at DESC);
CREATE INDEX idx_wizard_submissions_email ON public.wizard_submissions(email);
CREATE INDEX idx_wizard_submissions_path ON public.wizard_submissions(path);
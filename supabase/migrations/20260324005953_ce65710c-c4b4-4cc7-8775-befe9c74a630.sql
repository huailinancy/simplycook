
-- Create food_logs table for daily meal tracking
CREATE TABLE public.food_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  description TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent duplicate meal entries per day
CREATE UNIQUE INDEX food_logs_user_date_meal ON public.food_logs (user_id, log_date, meal_type);

-- Enable RLS
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own food logs" ON public.food_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own food logs" ON public.food_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own food logs" ON public.food_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own food logs" ON public.food_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage policies for food-log-photos bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('food-log-photos', 'food-log-photos', true);

CREATE POLICY "Authenticated users can upload food log photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'food-log-photos');
CREATE POLICY "Authenticated users can update food log photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'food-log-photos');
CREATE POLICY "Anyone can view food log photos" ON storage.objects FOR SELECT USING (bucket_id = 'food-log-photos');

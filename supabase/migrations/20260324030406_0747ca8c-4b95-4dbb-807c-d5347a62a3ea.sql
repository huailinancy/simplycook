-- Allow multiple dishes per meal in food logs by removing the single-row-per-meal constraint
-- and adding explicit ordering for dishes within a meal.

DROP INDEX IF EXISTS public.food_logs_user_date_meal;

ALTER TABLE public.food_logs
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_food_logs_user_date_meal_sort
ON public.food_logs (user_id, log_date, meal_type, sort_order);
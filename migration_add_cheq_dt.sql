-- Rode este comando no SQL Editor do Supabase para criar a nova coluna
ALTER TABLE public.rel_financeiro 
ADD COLUMN IF NOT EXISTS cheq_dt_data DATE;
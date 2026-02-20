-- ATENÇÃO: Execute este script no SQL Editor do Supabase
-- Simplificando a chave única para Filial + Número do Lançamento

-- 1. Limpa a tabela para evitar conflitos na migração
TRUNCATE TABLE public.rel_financeiro;

-- 2. Remove constraints antigas
ALTER TABLE public.rel_financeiro DROP CONSTRAINT IF EXISTS unique_financial_record;
DROP INDEX IF EXISTS idx_unique_financial;

-- 3. Cria a constraint de unicidade simplificada
ALTER TABLE public.rel_financeiro 
ADD CONSTRAINT unique_financial_record 
UNIQUE (fil_in_codigo, mov_in_numlancto);

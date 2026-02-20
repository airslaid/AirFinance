
-- SCRIPT DE CORREÇÃO DE PERMISSÕES
-- Execute este script no SQL Editor do Supabase se você não conseguir ver a lista de usuários.

-- 1. Insere ou atualiza o perfil dos usuários TI e Cássia para garantir que são Admins
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
    id, 
    email, 
    raw_user_meta_data->>'full_name', 
    'admin'
FROM auth.users
WHERE email IN ('ti@grupoairslaid.com.br', 'cassia@grupoairslaid.com.br')
ON CONFLICT (id) DO UPDATE 
SET role = 'admin';

-- 2. Verifica se funcionou (deve retornar os admins)
SELECT * FROM public.profiles WHERE role = 'admin';

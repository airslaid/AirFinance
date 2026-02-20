
-- SCRIPT DE CORREÇÃO TOTAL DE ACESSO (CASSIA)
-- 1. Garante extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Insere na tabela de autenticação SE NÃO EXISTIR
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
SELECT 
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'cassia@grupoairslaid.com.br',
    crypt('123456', gen_salt('bf')), -- Senha: '123456'
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Cassia Siude"}',
    now(),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'cassia@grupoairslaid.com.br'
);

-- 3. Se já existir, FORÇA a atualização da senha e confirmação do email
UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', '"Cassia Siude"')
WHERE email = 'cassia@grupoairslaid.com.br';

-- 4. Atualiza ou cria o perfil de ADMIN na tabela profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, 'Cassia Siude', 'admin'
FROM auth.users
WHERE email = 'cassia@grupoairslaid.com.br'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', full_name = 'Cassia Siude';

-- 5. Verifica resultado
SELECT email, role FROM public.profiles WHERE email = 'cassia@grupoairslaid.com.br';

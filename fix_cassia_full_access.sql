
-- SCRIPT DE RESET FORÇADO (HARD RESET)
-- Use este script se o login estiver falhando mesmo com o usuário existindo.

-- 1. Habilita criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. REMOVE o usuário existente para limpar qualquer estado corrompido ou senhas antigas
-- O 'ON DELETE CASCADE' configurado no setup irá remover o perfil automaticamente também.
DELETE FROM auth.users WHERE email = 'cassia@grupoairslaid.com.br';

-- 3. CRIA o usuário NOVAMENTE do zero com senha '123456'
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
    updated_at,
    confirmation_token,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'cassia@grupoairslaid.com.br',
    crypt('123456', gen_salt('bf')), -- Senha 123456 garantida
    now(), -- Email já confirmado
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Cassia Siude"}',
    now(),
    now(),
    '',
    ''
);

-- 4. Recria o Perfil de Admin imediatamente
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, 'Cassia Siude', 'admin'
FROM auth.users
WHERE email = 'cassia@grupoairslaid.com.br'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', full_name = 'Cassia Siude';

-- 5. Confirmação
SELECT email, role, created_at FROM public.profiles WHERE email = 'cassia@grupoairslaid.com.br';

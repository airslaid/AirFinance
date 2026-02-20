
-- Habilita a extensão necessária para gerar o hash da senha
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- INSERIR USUÁRIO NO AUTH.USERS
-- Isso cria o login 'ti@grupoairslaid.com.br' com a senha '123456'
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
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'ti@grupoairslaid.com.br',       -- SEU EMAIL
    crypt('123456', gen_salt('bf')), -- SUA SENHA
    now(),                           -- Confirma o email automaticamente
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Admin AirFinance"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);

-- NOTA: O trigger que configuramos no passo anterior (migration_admin_setup.sql) 
-- deve rodar automaticamente agora e criar o perfil em public.profiles.

-- Para garantir que ele seja ADMIN, aguardamos o trigger e fazemos o update:
DO $$
BEGIN
  -- Pequena pausa para garantir que o trigger disparou (opcional, mas seguro em scripts manuais)
  PERFORM pg_sleep(1);
  
  UPDATE public.profiles
  SET role = 'admin'
  WHERE email = 'ti@grupoairslaid.com.br';
END $$;

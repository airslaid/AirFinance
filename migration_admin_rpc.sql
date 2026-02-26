-- 1. Habilita a extensão pgcrypto (geralmente no schema extensions no Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Função segura para DELETAR usuário
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requesting_user_role TEXT;
BEGIN
  -- Verifica se quem está chamando é admin
  SELECT role INTO requesting_user_role FROM public.profiles WHERE id = auth.uid();
  IF requesting_user_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado. Apenas admins.');
  END IF;

  -- Deleta o usuário da tabela de autenticação
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuário excluído com sucesso.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Função segura para ALTERAR SENHA
CREATE OR REPLACE FUNCTION admin_reset_password(target_user_id UUID, new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- Adicionamos 'extensions' ao search_path para encontrar o pgcrypto
SET search_path = public, auth, extensions
AS $$
DECLARE
  requesting_user_role TEXT;
BEGIN
  -- Verifica se quem está chamando é admin
  SELECT role INTO requesting_user_role FROM public.profiles WHERE id = auth.uid();
  IF requesting_user_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado. Apenas admins.');
  END IF;

  -- Atualiza a senha usando o hash compatível com o Supabase (bcrypt)
  -- Tentamos usar o crypt e gen_salt que agora devem estar no path
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now(),
      last_sign_in_at = NULL -- Força re-login em alguns casos
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Senha alterada com sucesso.');
EXCEPTION WHEN OTHERS THEN
  -- Se falhar por causa do gen_salt, tentamos com o prefixo extensions explicitamente
  BEGIN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = target_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Senha alterada com sucesso (via extensions path).');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Erro ao processar hash de senha: ' || SQLERRM);
  END;
END;
$$;

-- 4. Função segura para CRIAR usuário
CREATE OR REPLACE FUNCTION admin_create_user(
  new_email TEXT,
  new_password TEXT,
  new_full_name TEXT,
  new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  requesting_user_role TEXT;
  new_user_id UUID;
BEGIN
  -- Verifica se quem está chamando é admin
  SELECT role INTO requesting_user_role FROM public.profiles WHERE id = auth.uid();
  IF requesting_user_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado. Apenas admins.');
  END IF;

  -- Verifica se o email já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = new_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este email já está em uso.');
  END IF;

  -- Gera UUID (tenta extensões se necessário)
  BEGIN
    new_user_id := extensions.uuid_generate_v4();
  EXCEPTION WHEN OTHERS THEN
    new_user_id := gen_random_uuid(); -- Fallback para built-in se disponível (PG 13+)
  END;

  -- Insere na tabela auth.users (Autenticação do Supabase)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    new_email,
    crypt(new_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', new_full_name),
    now(),
    now(),
    '',
    ''
  );

  -- Insere ou atualiza na tabela public.profiles (Perfil da aplicação)
  -- Usamos ON CONFLICT para evitar o erro "duplicate key" caso exista um trigger automático
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new_user_id, new_email, new_full_name, new_role)
  ON CONFLICT (id) DO UPDATE 
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role;

  RETURN jsonb_build_object('success', true, 'message', 'Usuário criado com sucesso.', 'id', new_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

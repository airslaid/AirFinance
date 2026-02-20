
-- 1. Criar tabela de perfis (se não existir)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Trigger para criar perfil automaticamente quando um usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove trigger antigo se existir para recriar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. POLÍTICAS DE SEGURANÇA (RLS)

-- Todo mundo pode ler perfis? Não, apenas admins ou o próprio dono.
-- Para simplificar a lista de usuários para o admin:
DROP POLICY IF EXISTS "Admins podem ver todos" ON public.profiles;
CREATE POLICY "Admins podem ver todos" ON public.profiles
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Usuarios veem o proprio perfil" ON public.profiles;
CREATE POLICY "Usuarios veem o proprio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Apenas Admins podem atualizar roles
DROP POLICY IF EXISTS "Admins podem atualizar roles" ON public.profiles;
CREATE POLICY "Admins podem atualizar roles" ON public.profiles
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 5. DEFINIR VOCÊ COMO ADMIN
-- IMPORTANTE: Substitua 'seu_email@exemplo.com' pelo seu email real de login
-- Se o perfil ainda não existir (usuário antigo), insira manualmente.

INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'ti@grupoairslaid.com.br' -- <<<< COLOQUE SEU EMAIL AQUI
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Para garantir, update caso o trigger já tenha criado
UPDATE public.profiles SET role = 'admin' WHERE email = 'ti@grupoairslaid.com.br';

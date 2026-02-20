
-- CORREÇÃO DE SEGURANÇA E RECURSÃO (RLS)

-- 1. Criar uma função de segurança "Bypass" (Security Definer)
-- Essa função checa se é admin SEM acionar as políticas da tabela novamente (evita o loop infinito).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões de superusuário, ignorando RLS
SET search_path = public -- Segurança extra
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Derrubar as políticas antigas que causam recursão
DROP POLICY IF EXISTS "Admins podem ver todos" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar roles" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios veem o proprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Qualquer um autenticado pode ver" ON public.profiles;

-- 3. Criar novas políticas usando a função segura

-- LEITURA: Admin vê tudo OU Usuário vê o dele mesmo
CREATE POLICY "Ver Perfis" ON public.profiles
FOR SELECT
USING (
  auth.uid() = id OR public.is_admin()
);

-- ATUALIZAÇÃO: Apenas Admin pode alterar dados (ex: roles)
CREATE POLICY "Atualizar Perfis" ON public.profiles
FOR UPDATE
USING (
  public.is_admin()
);

-- 4. Garantir permissões na função
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon;

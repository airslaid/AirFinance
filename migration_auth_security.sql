-- 1. Garante que o RLS está ativado na tabela
ALTER TABLE public.rel_financeiro ENABLE ROW LEVEL SECURITY;

-- 2. Remove as políticas antigas que permitiam acesso público (Anônimo)
DROP POLICY IF EXISTS "Acesso Publico Leitura" ON public.rel_financeiro;
DROP POLICY IF EXISTS "Acesso Publico Escrita" ON public.rel_financeiro;

-- 3. Cria nova política de LEITURA apenas para autenticados
-- O comando 'auth.role() = 'authenticated'' verifica se o usuário está logado.
CREATE POLICY "Acesso Apenas Autenticado Leitura" ON public.rel_financeiro
FOR SELECT
TO authenticated
USING (true);

-- 4. Cria nova política de ESCRITA/INSERT apenas para autenticados
CREATE POLICY "Acesso Apenas Autenticado Escrita" ON public.rel_financeiro
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. Cria nova política de ATUALIZAÇÃO (necessário para updates futuros)
CREATE POLICY "Acesso Apenas Autenticado Update" ON public.rel_financeiro
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Cria nova política de EXCLUSÃO
CREATE POLICY "Acesso Apenas Autenticado Delete" ON public.rel_financeiro
FOR DELETE
TO authenticated
USING (true);

-- Resumo: Agora, se alguém tentar acessar a API sem o token de login gerado pela tela, o Supabase retornará um array vazio ou erro.
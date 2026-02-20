
// Deno Edge Function: 'admin-actions'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("[Admin Function] Iniciando verificação de chaves...");

    // -----------------------------------------------------------------------
    // 1. RECUPERAÇÃO DAS CHAVES COM MÚLTIPLAS TENTATIVAS E LIMPEZA
    // -----------------------------------------------------------------------
    
    // Helper para limpar espaços em branco que podem vir do copy-paste
    // @ts-ignore
    const getEnv = (key: string) => Deno.env.get(key)?.trim();

    // @ts-ignore
    const supabaseUrl = getEnv('SUPABASE_URL');
    // @ts-ignore
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

    // SERVICE ROLE KEY (A chave crítica)
    // @ts-ignore
    const serviceKeyCandidate1 = getEnv('SERVICE_ROLE_KEY');          
    // @ts-ignore
    const serviceKeyCandidate2 = getEnv('SUPABASE_SERVICE_ROLE_KEY'); 
    // @ts-ignore
    const serviceKeyCandidate3 = getEnv('MY_SECRET_KEY');             

    const serviceRoleKey = serviceKeyCandidate1 || serviceKeyCandidate2 || serviceKeyCandidate3;

    // -----------------------------------------------------------------------
    // 2. DIAGNÓSTICO E RETORNO DE ERRO CONTROLADO
    // -----------------------------------------------------------------------
    const missingKeys = [];
    if (!supabaseUrl) missingKeys.push("SUPABASE_URL");
    if (!supabaseAnonKey) missingKeys.push("SUPABASE_ANON_KEY");
    if (!serviceRoleKey) missingKeys.push("SERVICE_ROLE_KEY");

    // Logs detalhados para o painel do Supabase
    console.log(`[DIAGNOSTICO] URL: ${supabaseUrl ? 'OK' : 'MISSING'}`);
    console.log(`[DIAGNOSTICO] ANON: ${supabaseAnonKey ? 'OK' : 'MISSING'}`);
    console.log(`[DIAGNOSTICO] SERVICE: ${serviceRoleKey ? 'OK (Length: ' + serviceRoleKey.length + ')' : 'MISSING'}`);

    if (missingKeys.length > 0) {
        const errorMsg = `FALTA CONFIGURAÇÃO: As seguintes Secrets não foram encontradas ou estão vazias em 'Edge Functions > admin-actions > Secrets': ${missingKeys.join(', ')}.`;
        console.error(errorMsg);
        
        return new Response(
            JSON.stringify({ error: errorMsg }), 
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // -----------------------------------------------------------------------
    // 3. LÓGICA DA FUNÇÃO
    // -----------------------------------------------------------------------

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(
            JSON.stringify({ error: "Token de autorização ausente." }), 
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Cliente "Normal" (Respeita RLS)
    const supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, { 
        global: { headers: { Authorization: authHeader } } 
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        return new Response(
            JSON.stringify({ error: "Usuário não autenticado ou token expirado." }), 
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`[Admin Function] Solicitante: ${user.email}`);

    // Verificar se é Admin (consulta tabela profiles OU whitelist)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // LISTA DE SUPER ADMINS - Whitelist para garantir acesso
    const SUPER_ADMINS = ['ti@grupoairslaid.com.br', 'cassia@grupoairslaid.com.br'];
    
    const isDbAdmin = profile && profile.role === 'admin';
    const isSuperAdmin = user.email && SUPER_ADMINS.includes(user.email);

    if (!isDbAdmin && !isSuperAdmin) {
      console.warn(`[Admin Function] Bloqueado. ${user.email} não é admin.`);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem realizar esta ação." }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- AQUI COMEÇA A MÁGICA ---
    // Instanciar Cliente ADMIN com a chave que recuperamos lá em cima
    const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);

    const { action, email, password, role, data } = await req.json();
    console.log(`[Admin Function] Ação: ${action} | Alvo: ${email}`);

    if (action === 'create_user') {
        if (!email || !password) {
            return new Response(
                JSON.stringify({ error: "Email e senha são obrigatórios." }), 
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 1. Cria o usuário no Auth
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, 
            user_metadata: data
        });

        if (createError) {
            console.error("Erro ao criar usuário:", createError);
            throw createError;
        }

        // 2. Se for Admin, atualiza a tabela profiles
        if (role === 'admin' && newUser.user) {
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .upsert({ 
                    id: newUser.user.id,
                    email: email,
                    full_name: data.full_name,
                    role: 'admin' 
                });
            
            if (updateError) {
                 console.error("Erro ao definir como admin:", updateError);
            }
        }

        return new Response(
            JSON.stringify(newUser), 
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
        JSON.stringify({ error: `Ação '${action}' desconhecida.` }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("[Admin Function] Erro Fatal:", error);
    
    return new Response(
      JSON.stringify({ 
          error: error.message || "Erro interno na Edge Function.", 
          details: String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
});


// Deno Edge Function: 'admin-actions'
// Versão: 2.0 (Modern Syntax)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Usando Deno.serve (Sintaxe Moderna)
Deno.serve(async (req) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. RECUPERAÇÃO DAS CHAVES
    // @ts-ignore
    const getEnv = (key: string) => Deno.env.get(key)?.trim();

    // @ts-ignore
    const supabaseUrl = getEnv('SUPABASE_URL');
    // @ts-ignore
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');
    // @ts-ignore
    const serviceRoleKey = getEnv('SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');

    // Validação das chaves - Retorna 200 com erro para o cliente ler
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        return new Response(
            JSON.stringify({ 
                success: false, 
                error: "Falta configuração de Secrets (SUPABASE_URL, SUPABASE_ANON_KEY, SERVICE_ROLE_KEY)." 
            }), 
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 3. AUTENTICAÇÃO DO SOLICITANTE
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(
            JSON.stringify({ success: false, error: "Token de autorização ausente." }), 
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, { 
        global: { headers: { Authorization: authHeader } } 
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        return new Response(
            JSON.stringify({ success: false, error: "Usuário não autenticado." }), 
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 4. VERIFICAÇÃO DE PERMISSÃO (ADMIN)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const SUPER_ADMINS = ['ti@grupoairslaid.com.br', 'cassia@grupoairslaid.com.br'];
    const isDbAdmin = profile && profile.role === 'admin';
    const isSuperAdmin = user.email && SUPER_ADMINS.includes(user.email);

    if (!isDbAdmin && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado. Apenas administradores." }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. EXECUÇÃO DA AÇÃO (ADMIN)
    // @ts-ignore
    const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);

    const { action, email, password, role, data, user_id } = await req.json();
    console.log(`[Admin Function] Ação: ${action}`);

    // --- CREATE USER ---
    if (action === 'create_user') {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: data
        });

        if (createError) throw createError;

        if (role === 'admin' && newUser.user) {
            await supabaseAdmin.from('profiles').upsert({ 
                id: newUser.user.id, email, full_name: data.full_name, role: 'admin' 
            });
        }
        
        return new Response(
            JSON.stringify({ success: true, data: newUser }), 
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // --- DELETE USER ---
    if (action === 'delete_user') {
        if (!user_id) throw new Error("ID do usuário é obrigatório.");
        
        const { data: deletedUser, error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (deleteError) throw deleteError;

        return new Response(
            JSON.stringify({ success: true, message: "Usuário deletado", data: deletedUser }), 
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // --- RESET PASSWORD ---
    if (action === 'reset_password') {
        if (!user_id || !password) throw new Error("ID e Senha são obrigatórios.");

        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id, 
            { password: password }
        );
        
        if (updateError) throw updateError;

        return new Response(
            JSON.stringify({ success: true, message: "Senha atualizada", data: updatedUser }), 
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
        JSON.stringify({ success: false, error: `Ação '${action}' desconhecida.` }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Erro Fatal:", error);
    return new Response(
      JSON.stringify({ 
          success: false,
          error: error.message || "Erro interno na Edge Function.",
          details: String(error)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
});


import { supabase } from './supabaseClient';
import { UserProfile } from '../types';

export const fetchProfiles = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar perfis:', error);
    return [];
  }
  return data as UserProfile[];
};

export const updateUserRole = async (userId: string, newRole: 'admin' | 'user') => {
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw error;
};

export const createUser = async (email: string, password: string, fullName: string, role: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: {
        action: 'create_user',
        email,
        password,
        data: { full_name: fullName },
        role
      }
    });

    if (error) {
       console.error("Erro retornado pelo invoke:", error);
       
       let errorMsg = "";

       // 1. Tenta pegar a mensagem de erro do objeto Error padrão
       if (error instanceof Error) {
         errorMsg = error.message;
       } 
       // 2. Tenta pegar de um objeto genérico (FunctionsHttpError)
       else if (typeof error === 'object' && error !== null) {
         // Verifica se tem contexto com resposta JSON da nossa Edge Function
         const ctx = (error as any).context;
         if (ctx && typeof ctx === 'object') {
            if (ctx.error) errorMsg = ctx.error;
            else if (ctx.message) errorMsg = ctx.message;
         }
         
         // Se não achou no contexto, pega a mensagem base
         if (!errorMsg && (error as any).message) {
            errorMsg = (error as any).message;
         }
       }

       // 3. Fallback se ainda estiver vazio
       if (!errorMsg) errorMsg = "Erro desconhecido na Edge Function.";

       // 4. Intercepta erros comuns para dar dicas
       if (errorMsg.includes("non-2xx") || errorMsg.includes("status code") || errorMsg.includes("Faltam as seguintes Secrets")) {
           errorMsg = "Falha na Configuração: Verifique se as Secrets (SUPABASE_URL, SUPABASE_ANON_KEY, SERVICE_ROLE_KEY) foram adicionadas na Edge Function no painel.";
       }
       
       throw new Error(errorMsg);
    }
    
    // Verifica erro lógico retornado no corpo da resposta (data)
    if (data && data.error) {
        throw new Error(data.error);
    }

    return data;

  } catch (err: any) {
    console.error("Erro no serviço create user:", err);
    throw new Error(err.message || "Erro de comunicação com o servidor.");
  }
};

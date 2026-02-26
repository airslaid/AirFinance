
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
    // Usando RPC (Função SQL) para criar usuário, evitando problemas com Edge Functions
    const { data, error } = await supabase.rpc('admin_create_user', {
      new_email: email,
      new_password: password,
      new_full_name: fullName,
      new_role: role
    });

    if (error) throw error;
    
    // A função RPC retorna um JSONB { success: boolean, error?: string }
    if (data && data.success === false) {
        throw new Error(data.error || "Erro ao criar usuário (SQL).");
    }

    return data;

  } catch (err: any) {
    console.error("Erro no serviço create user:", err);
    throw new Error(getErrorMessage(err, "Erro ao criar usuário."));
  }
};

// Helper para extrair mensagem de erro detalhada
const getErrorMessage = (error: any, defaultMsg: string) => {
  let errorMsg = "";

  if (error instanceof Error) {
    errorMsg = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Verifica se veio do nosso backend customizado (success: false)
    if (error.success === false && error.error) {
        return error.error;
    }

    const ctx = (error as any).context;
    if (ctx && typeof ctx === 'object') {
       if (ctx.error) errorMsg = ctx.error;
       else if (ctx.message) errorMsg = ctx.message;
    }
    
    if (!errorMsg && (error as any).message) {
       errorMsg = (error as any).message;
    }
  }

  if (!errorMsg) errorMsg = defaultMsg;

  if (errorMsg.includes("non-2xx") || errorMsg.includes("status code")) {
      return "Erro de conexão com o servidor (500). Verifique se o código da Edge Function foi atualizado no Supabase.";
  }

  return errorMsg;
};

export const deleteUser = async (userId: string) => {
  try {
    // Usando RPC (Função SQL) em vez de Edge Function para maior confiabilidade
    const { data, error } = await supabase.rpc('admin_delete_user', {
      target_user_id: userId
    });

    if (error) throw error;
    
    // A função RPC retorna um JSONB { success: boolean, error?: string }
    if (data && data.success === false) {
        throw new Error(data.error || "Erro ao deletar usuário (SQL).");
    }

    return data;
  } catch (err: any) {
    console.error("Erro ao deletar usuário:", err);
    throw new Error(getErrorMessage(err, "Erro ao deletar usuário."));
  }
};

export const resetPassword = async (userId: string, password: string) => {
  try {
    // Usando RPC (Função SQL) para resetar senha
    const { data, error } = await supabase.rpc('admin_reset_password', {
      target_user_id: userId,
      new_password: password
    });

    if (error) throw error;

    if (data && data.success === false) {
        throw new Error(data.error || "Erro ao resetar senha (SQL).");
    }

    return data;
  } catch (err: any) {
    console.error("Erro ao resetar senha:", err);
    throw new Error(getErrorMessage(err, "Erro ao resetar senha."));
  }
};

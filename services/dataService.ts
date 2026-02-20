import { supabase } from './supabaseClient';
import { FinancialRecord, KPIData } from '../types';
import { TABLE_NAME, SUPABASE_URL, SUPABASE_KEY } from '../constants';

// --- FUNÇÕES DE SUPABASE ---

export interface FetchResult {
  data: FinancialRecord[];
  isMock: boolean;
  error?: string;
  totalDbCount?: number;
}

export const fetchFinancialData = async (): Promise<FetchResult> => {
  try {
    // 1. Busca o total exato de registros no banco (count)
    const countResult = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true });
    
    const totalDbCount = countResult.count || 0;

    // 2. Busca os dados usando Paginação para contornar o limite de 1000 linhas do Supabase/PostgREST
    // O limite padrão da API é geralmente 1000, então buscamos em lotes (chunks).
    
    let allData: FinancialRecord[] = [];
    const PAGE_SIZE = 1000;
    const promises = [];

    // Se não houver dados, retorna vazio
    if (totalDbCount === 0) {
       return { data: [], isMock: false, totalDbCount: 0 };
    }

    // Cria as promessas de busca para cada página
    for (let from = 0; from < totalDbCount; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      
      const promise = supabase
        .from(TABLE_NAME)
        .select('*')
        .order('mov_dt_vencto', { ascending: false })
        .order('id', { ascending: false }) // Garante ordenação determinística para a paginação
        .range(from, to);
        
      promises.push(promise);
    }

    // Executa todas as buscas em paralelo
    const responses = await Promise.all(promises);

    // Combina os resultados
    for (const response of responses) {
      if (response.error) throw response.error;
      if (response.data) {
        allData = [...allData, ...(response.data as FinancialRecord[])];
      }
    }

    // Retorna os dados combinados
    return { 
      data: allData, 
      isMock: false,
      totalDbCount
    };

  } catch (err: any) {
    console.error("Erro ao buscar dados:", err);
    return { data: [], isMock: true, error: err.message, totalDbCount: 0 };
  }
};

// --- SYNC VIA EDGE FUNCTION (SERVER-SIDE) ---
export const syncDataFromPowerBI = async (): Promise<{ success: boolean; message: string }> => {
  console.log("Iniciando sincronização via Edge Function (smart-endpoint)...");
  
  try {
    const functionUrl = `${SUPABASE_URL}/functions/v1/smart-endpoint`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ action: 'sync' })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Sem detalhes');
      throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "A função retornou falha.");
    }

    return { 
      success: true, 
      message: `Sucesso! ${data.count} registros importados.` 
    };

  } catch (err: any) {
    console.error("FALHA NA SINCRONIZAÇÃO:", err);
    
    let msg = err.message;
    
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      msg = "Erro de Conexão: Verifique se a função 'smart-endpoint' está implantada e acessível.";
    }

    return {
      success: false,
      message: msg
    };
  }
};

export const calculateKPIs = (data: FinancialRecord[]): KPIData => {
  let totalPending = 0;
  let totalPaid = 0;
  let totalGeneral = 0;
  let countPending = 0;

  data.forEach(record => {
    // Conversão de valores
    const valorOriginal = Number(record.valor || 0);
    const saldoPendente = Number(record.mov_re_saldocpacre || 0);
    const valorBaixado = Number(record.cheqbx_re_vrbaixa || 0); // Valor Pago vem desta coluna

    // Total Geral é a soma dos valores originais dos documentos
    totalGeneral += valorOriginal;

    // Acumula valor pago independente do status (para histórico)
    totalPaid += valorBaixado;

    // Lógica de Status:
    // EM ABERTO: Saldo Pendente > 0
    // PAGO: Saldo Pendente == 0
    if (saldoPendente > 0) {
      totalPending += saldoPendente; // Soma apenas o que falta pagar
      countPending++;
    }
    // Se saldoPendente === 0, considera-se pago/baixado integralmente para fins de contagem,
    // mas o valor financeiro já foi somado em totalPaid (valorBaixado).
  });

  return { 
    totalPending, 
    totalPaid, 
    totalGeneral, 
    countPending 
  };
};
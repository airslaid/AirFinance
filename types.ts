
// Mapped from table REL_FINANCEIRO (Full Dataset Schema)
export interface FinancialRecord {
  id?: number; // Supabase generated ID
  
  // Existing columns
  agn_in_codigo: number;
  valor: number;
  mov_dt_vencto: string; // ISO Date
  mov_dt_datadocto: string; // ISO Date
  mov_ch_natureza: string;
  fpa_st_favorecido: string;
  mov_ch_conciliado: string;
  fil_in_codigo: number;
  rcb_st_nota?: string;

  // New columns
  cheq_dt_data?: string; // ISO Date (Nova coluna)
  cheqbx_re_vrbaixa?: number;
  cheqbx_re_vrjuros?: number;
  conta_baixa?: number;
  cpa_in_ap?: number;
  cpa_st_documento?: string;
  cpa_st_parcela?: string;
  fpa_dt_emissao?: string; // ISO Date
  fpa_in_contador?: number;
  fpa_in_numero?: number;
  fpa_st_doctointerno?: string;
  fpa_tpd_st_codigo?: string;
  mov_in_numlancto?: number;
  mov_re_saldocpacre?: number;
  org_in_codigo?: number;
}

export interface ReceivableRecord {
  id?: number;
  agn_in_codigo?: number;
  cre_st_documento?: string;
  cre_st_parcela?: string;
  dt_baixa?: string;
  dt_lancamento?: string;
  dt_vencto?: string;
  fpa_dt_emissao?: string;
  fpa_st_doctointerno?: string;
  fpa_st_favorecido?: string;
  fre_in_numero?: number;
  fre_tpd_st_codigo?: string;
  mov_ch_conciliado?: string;
  mov_ch_natureza?: string;
  mov_in_numlancto?: number;
  mov_re_saldocpacre?: number;
  org_in_codigo?: number;
  rcb_st_nota?: string;
  valor?: number;
}

export interface KPIData {
  totalPending: number; // A Pagar (Em Aberto)
  totalPaid: number;    // Pago (Conciliado)
  totalGeneral: number; // Total Geral
  countPending: number; // Qtd de boletos em aberto
}

export enum TransactionType {
  CREDIT = 'C',
  DEBIT = 'D'
}

export interface UserProfile {
  id: string; // UUID do Auth
  email: string;
  full_name?: string;
  role: 'admin' | 'user';
  created_at: string;
  last_sign_in_at?: string;
}

export type PageView = 'dashboard' | 'receivables' | 'users' | 'cashflow' | 'reports';

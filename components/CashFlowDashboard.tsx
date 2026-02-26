import React, { useEffect, useState, useMemo } from 'react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Calendar,
  Filter,
  RefreshCw,
  Info,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell 
} from 'recharts';
import { fetchFinancialData, fetchReceivablesData } from '../services/dataService';
import { FinancialRecord, ReceivableRecord } from '../types';

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// --- CONSTANTS ---
const BRANCH_MAP: Record<string, string> = {
  '10': 'AIRSLAID',
  '20': 'BIG TELAS',
  '30': 'ITELFA',
  '40': 'GRASSI HOLDING',
  '100': 'AIRSLAID',
  '200': 'BIG TELAS',
  '300': 'ITELFA',
  '400': 'GRASSI HOLDING',
  '500': 'FAZENDA BOM SOSSEGO'
};

const BRANCH_NAMES = Array.from(new Set(Object.values(BRANCH_MAP))).sort();

// --- COMPONENTS ---
const KPICard = ({ title, value, subtext, icon: Icon, color, tooltip }: any) => {
  const colorClasses = {
    blue: 'text-blue-700 bg-blue-100',
    emerald: 'text-emerald-700 bg-emerald-100',
    rose: 'text-rose-700 bg-rose-100',
    amber: 'text-amber-700 bg-amber-100',
    slate: 'text-slate-700 bg-slate-200',
  }[color] || 'text-slate-700 bg-slate-200';

  return (
    <div className="bg-white p-2.5 border border-slate-300 hover:border-slate-400 transition-colors shadow-sm group/card relative">
      <div className="flex justify-between items-center mb-0.5">
        <div className="flex items-center gap-1">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{title}</p>
           {tooltip && (
             <div className="group/tooltip relative">
                <Info size={10} className="text-slate-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 font-normal normal-case">
                  {tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
             </div>
           )}
        </div>
        <div className={`p-0.5 ${colorClasses}`}>
          <Icon size={12} />
        </div>
      </div>
      <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-none">{value}</h3>
      {subtext && (
        <div className="mt-1.5 flex items-center text-[9px] border-t border-slate-100 pt-1">
          <span className="text-slate-500 font-medium">{subtext}</span>
        </div>
      )}
    </div>
  );
};

export const CashFlowDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [payables, setPayables] = useState<FinancialRecord[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'predicted' | 'realized'>('predicted');

  // Load Data
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        const [payablesRes, receivablesRes] = await Promise.all([
          fetchFinancialData(),
          fetchReceivablesData()
        ]);
        
        setPayables(payablesRes.data || []);
        setReceivables(receivablesRes.data || []);
      } catch (error) {
        console.error("Error loading cash flow data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

  // Filter Data
  const filteredData = useMemo(() => {
    const filterByBranch = (code: number | undefined) => {
      if (!branchFilter) return true;
      const codeStr = String(code);
      const name = BRANCH_MAP[codeStr];
      return name === branchFilter;
    };

    const filterDate = (dateStr: string | undefined) => {
      if (!dateStr || dateStr.length < 10) return false;
      const d = dateStr.split('T')[0];
      return d >= startDate && d <= endDate;
    };

    let filteredPayables: FinancialRecord[] = [];
    let filteredReceivables: ReceivableRecord[] = [];

    if (viewMode === 'predicted') {
      // PREVISTO: Filtra por Vencimento
      filteredPayables = payables.filter(p => filterDate(p.mov_dt_vencto) && filterByBranch(p.fil_in_codigo));
      filteredReceivables = receivables.filter(r => filterDate(r.dt_vencto) && filterByBranch(r.org_in_codigo));
    } else {
      // REALIZADO: Filtra por Data de Baixa (Pagamento)
      filteredPayables = payables.filter(p => {
        // Para contas a pagar, usa cheq_dt_data como data de baixa
        return filterDate(p.cheq_dt_data) && filterByBranch(p.fil_in_codigo);
      });

      filteredReceivables = receivables.filter(r => {
        // Para contas a receber, usa dt_baixa
        // IMPORTANTE: Ignora se tiver saldo em aberto (regra anterior)
        if ((Number(r.mov_re_saldocpacre) || 0) > 0) return false;
        return filterDate(r.dt_baixa) && filterByBranch(r.org_in_codigo);
      });
    }

    return { payables: filteredPayables, receivables: filteredReceivables };
  }, [payables, receivables, startDate, endDate, branchFilter, viewMode]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    let totalPayable = 0;
    let totalReceivable = 0;

    if (viewMode === 'predicted') {
      // PREVISTO: Soma Valor Original
      totalPayable = filteredData.payables.reduce((sum, item) => sum + Number(item.valor || 0), 0);
      totalReceivable = filteredData.receivables.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    } else {
      // REALIZADO: Soma Valor Pago / Baixado
      totalPayable = filteredData.payables.reduce((sum, item) => sum + Number(item.cheqbx_re_vrbaixa || 0), 0);
      
      totalReceivable = filteredData.receivables.reduce((sum, item) => {
        const valorOriginal = Number(item.valor || 0);
        const saldo = Number(item.mov_re_saldocpacre || 0);
        // Se saldo > 0, já foi filtrado fora no step anterior, mas por segurança:
        const baixado = Math.max(0, valorOriginal - saldo);
        return sum + baixado;
      }, 0);
    }

    const balance = totalReceivable - totalPayable;

    return { totalPayable, totalReceivable, balance };
  }, [filteredData, viewMode]);

  // Aggregate for Chart
  const chartData = useMemo(() => {
    const map = new Map<string, { dateKey: string, name: string, payable: number, receivable: number }>();

    // Helper to process items
    const processItem = (dateStr: string | undefined, value: number, type: 'payable' | 'receivable') => {
      if (!dateStr) return;
      const d = dateStr.split('T')[0];
      const [y, m] = d.split('-');
      const dateKey = `${y}-${m}`;
      
      if (!map.has(dateKey)) {
        const dateObj = new Date(Number(y), Number(m) - 1, 1);
        const name = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
        map.set(dateKey, { dateKey, name, payable: 0, receivable: 0 });
      }
      
      const entry = map.get(dateKey)!;
      if (type === 'payable') entry.payable += value;
      else entry.receivable += value;
    };

    // Process Payables
    filteredData.payables.forEach(item => {
      const date = viewMode === 'predicted' ? item.mov_dt_vencto : item.cheq_dt_data;
      const value = viewMode === 'predicted' ? Number(item.valor || 0) : Number(item.cheqbx_re_vrbaixa || 0);
      processItem(date, value, 'payable');
    });

    // Process Receivables
    filteredData.receivables.forEach(item => {
      const date = viewMode === 'predicted' ? item.dt_vencto : item.dt_baixa;
      let value = 0;
      if (viewMode === 'predicted') {
        value = Number(item.valor || 0);
      } else {
        const valorOriginal = Number(item.valor || 0);
        const saldo = Number(item.mov_re_saldocpacre || 0);
        value = Math.max(0, valorOriginal - saldo);
      }
      processItem(date, value, 'receivable');
    });

    return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [filteredData, viewMode]);

  const resetView = () => {
    setStartDate('2026-01-01');
    setEndDate('2026-12-31');
    setViewMode('predicted');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <RefreshCw size={32} className="animate-spin mb-4 text-emerald-600" />
        <p className="text-sm font-medium">Carregando Fluxo de Caixa...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-slate-50 min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-1 h-5 bg-blue-600 rounded-sm"></div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">FLUXO DE CAIXA</h1>
          </div>
          <p className="text-[10px] text-slate-500 font-medium ml-2.5 flex items-center gap-1.5">
            <span className="bg-slate-200 px-1 py-0.5 rounded text-[9px] font-bold text-slate-600">CONSOLIDADO</span>
            <span>VISÃO GERAL DE ENTRADAS E SAÍDAS</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-0.5 rounded border border-slate-300 shadow-sm">
           {/* View Mode Toggle */}
           <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200 mr-1.5">
              <button
                onClick={() => setViewMode('predicted')}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm transition-all ${viewMode === 'predicted' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Previsto
              </button>
              <button
                onClick={() => setViewMode('realized')}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm transition-all ${viewMode === 'realized' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Realizado
              </button>
           </div>

           {/* Branch Filter */}
           <div className="relative border-r border-slate-200 pr-1.5 mr-1.5">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="py-0.5 px-1.5 bg-transparent text-[10px] font-medium text-slate-700 focus:outline-none w-28 cursor-pointer"
              >
                <option value="">Todas as Filiais</option>
                {BRANCH_NAMES.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
           </div>

           <div className="flex items-center gap-1.5 px-1.5 border-r border-slate-200">
              <Calendar size={12} className="text-slate-400" />
              <span className="text-[9px] font-bold text-slate-500 uppercase">Período</span>
           </div>
           
           <input 
             type="date"
             value={startDate}
             onChange={(e) => setStartDate(e.target.value)}
             className="py-0.5 px-1.5 bg-transparent text-[10px] font-medium text-slate-700 focus:outline-none w-24"
           />
           <span className="text-slate-400 text-[9px]">-</span>
           <input 
             type="date"
             value={endDate}
             onChange={(e) => setEndDate(e.target.value)}
             className="py-0.5 px-1.5 bg-transparent text-[10px] font-medium text-slate-700 focus:outline-none w-24"
           />
           
           <button 
             onClick={resetView}
             className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-colors"
             title="Resetar Filtros"
           >
              <RotateCcw size={12} />
           </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard 
          title={viewMode === 'predicted' ? "Total a Receber (Previsto)" : "Total Recebido (Realizado)"}
          value={formatCurrency(kpis.totalReceivable)} 
          subtext={viewMode === 'predicted' ? "Baseado em Vencimento" : "Baseado em Data de Baixa"} 
          icon={ArrowUpRight} 
          color="emerald" 
        />
        <KPICard 
          title={viewMode === 'predicted' ? "Total a Pagar (Previsto)" : "Total Pago (Realizado)"}
          value={formatCurrency(kpis.totalPayable)} 
          subtext={viewMode === 'predicted' ? "Baseado em Vencimento" : "Baseado em Data de Baixa"} 
          icon={ArrowDownRight} 
          color="rose" 
        />
        <KPICard 
          title={viewMode === 'predicted' ? "Saldo Projetado" : "Saldo Realizado"}
          value={formatCurrency(kpis.balance)} 
          subtext="Receitas - Despesas" 
          icon={DollarSign} 
          color={kpis.balance >= 0 ? "blue" : "amber"} 
        />
      </div>

      {/* CHART SECTION */}
      <div className="bg-white p-4 border border-slate-300 shadow-sm">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-sm text-slate-700 uppercase flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Fluxo Mensal: Entradas vs Saídas
            </h3>
            <div className="flex items-center gap-4 text-xs font-bold uppercase">
               <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> A Receber
               </div>
               <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-rose-500 rounded-sm"></div> A Pagar
               </div>
            </div>
         </div>

         <div className="h-[400px] w-full">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={0}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
               <XAxis 
                 dataKey="name" 
                 axisLine={false} 
                 tickLine={false} 
                 tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} 
                 dy={10}
               />
               <YAxis 
                 axisLine={false} 
                 tickLine={false} 
                 tick={{fill: '#64748b', fontSize: 11}} 
                 tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} 
               />
               <Tooltip 
                 cursor={{fill: '#f8fafc'}}
                 contentStyle={{borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                 formatter={(val: number) => formatCurrency(val)}
                 labelStyle={{fontWeight: 'bold', color: '#334155', marginBottom: '4px'}}
               />
               <Bar dataKey="receivable" name="A Receber" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
               <Bar dataKey="payable" name="A Pagar" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={60} />
             </BarChart>
           </ResponsiveContainer>
         </div>
      </div>

    </div>
  );
};

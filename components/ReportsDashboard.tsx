import React, { useEffect, useState, useMemo } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Calendar,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { fetchFinancialData, fetchReceivablesData } from '../services/dataService';
import { FinancialRecord, ReceivableRecord } from '../types';

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// --- COMPONENTS ---
const ReportCard = ({ title, children, className = '' }: { title: string, children: React.ReactNode, className?: string }) => (
  <div className={`bg-white p-3 border border-slate-200 shadow-sm ${className}`}>
    <h3 className="text-[11px] font-bold text-slate-700 uppercase mb-3 border-b border-slate-100 pb-1.5 flex items-center gap-2">
      {title}
    </h3>
    {children}
  </div>
);

export const ReportsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [payables, setPayables] = useState<FinancialRecord[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [payRes, recRes] = await Promise.all([
          fetchFinancialData(),
          fetchReceivablesData()
        ]);
        setPayables(payRes.data || []);
        setReceivables(recRes.data || []);
      } catch (error) {
        console.error("Error loading report data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    const filterDate = (dateStr?: string) => {
      if (!dateStr || dateStr.length < 10) return false;
      const d = dateStr.split('T')[0];
      return d >= startDate && d <= endDate;
    };

    return {
      payables: payables.filter(p => filterDate(p.mov_dt_vencto)),
      receivables: receivables.filter(r => filterDate(r.dt_vencto))
    };
  }, [payables, receivables, startDate, endDate]);

  // --- ANALYTICS ---

  // Top 5 Suppliers (Payables)
  const topSuppliers = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.payables.forEach(p => {
      const name = p.fpa_st_favorecido || 'Desconhecido';
      const val = Number(p.valor || 0);
      map.set(name, (map.get(name) || 0) + val);
    });
    
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredData.payables]);

  // Top 5 Customers (Receivables)
  const topCustomers = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.receivables.forEach(r => {
      const name = r.fpa_st_favorecido || 'Desconhecido'; // Assuming this field holds customer name too, or check other fields
      // In receivables, usually 'fpa_st_favorecido' might be the payer? Let's assume so based on types.ts
      // Actually, let's check if there's a better field. 'rcb_st_nota'? No.
      // Let's stick with fpa_st_favorecido for now.
      const val = Number(r.valor || 0);
      map.set(name, (map.get(name) || 0) + val);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredData.receivables]);

  // Overdue Items (Vencidos)
  const overdueItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    const overduePayables = filteredData.payables.filter(p => {
      const vencto = p.mov_dt_vencto?.split('T')[0];
      const saldo = Number(p.mov_re_saldocpacre || 0);
      return vencto && vencto < today && saldo > 0;
    });

    const overdueReceivables = filteredData.receivables.filter(r => {
      const vencto = r.dt_vencto?.split('T')[0];
      const saldo = Number(r.mov_re_saldocpacre || 0);
      return vencto && vencto < today && saldo > 0;
    });

    const totalOverduePayable = overduePayables.reduce((sum, item) => sum + Number(item.mov_re_saldocpacre || 0), 0);
    const totalOverdueReceivable = overdueReceivables.reduce((sum, item) => sum + Number(item.mov_re_saldocpacre || 0), 0);

    return {
      payables: overduePayables,
      receivables: overdueReceivables,
      totalPayable: totalOverduePayable,
      totalReceivable: totalOverdueReceivable
    };
  }, [filteredData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <RefreshCw size={32} className="animate-spin mb-4 text-emerald-600" />
        <p className="text-sm font-medium">Gerando Relatórios...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-slate-50 min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-1 h-5 bg-purple-600 rounded-sm"></div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">RELATÓRIOS GERENCIAIS</h1>
          </div>
          <p className="text-[10px] text-slate-500 font-medium ml-2.5">
            ANÁLISE DE PARCEIROS E PENDÊNCIAS
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-0.5 rounded border border-slate-300 shadow-sm">
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
        </div>
      </div>

      {/* TOP PARTNERS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* TOP SUPPLIERS */}
        <ReportCard title="Top 5 Fornecedores (Volume Financeiro)">
          <div className="h-64 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={topSuppliers} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={150} tick={{fontSize: 10}} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20}>
                  {topSuppliers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>

        {/* TOP CUSTOMERS */}
        <ReportCard title="Top 5 Clientes (Volume Financeiro)">
          <div className="h-64 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={topCustomers} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={150} tick={{fontSize: 10}} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20}>
                   {topCustomers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>

      </div>

      {/* OVERDUE ALERTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportCard title="Pendências em Atraso (A Pagar)" className="border-l-4 border-l-rose-500">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-rose-600">
                 <AlertTriangle size={20} />
                 <span className="font-bold text-lg">{overdueItems.payables.length} Títulos Vencidos</span>
              </div>
              <span className="text-xl font-bold text-slate-800">{formatCurrency(overdueItems.totalPayable)}</span>
           </div>
           <div className="max-h-48 overflow-y-auto custom-scrollbar pr-2">
              <table className="w-full text-xs text-left">
                 <thead className="text-slate-500 border-b border-slate-100">
                    <tr>
                       <th className="py-1">Favorecido</th>
                       <th className="py-1">Vencimento</th>
                       <th className="py-1 text-right">Valor</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {overdueItems.payables.slice(0, 10).map((item, idx) => (
                       <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 truncate max-w-[150px]" title={item.fpa_st_favorecido}>{item.fpa_st_favorecido}</td>
                          <td className="py-1.5 text-rose-600 font-medium">
                            {item.mov_dt_vencto ? new Date(item.mov_dt_vencto).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="py-1.5 text-right font-bold text-slate-700">
                             {formatCurrency(Number(item.mov_re_saldocpacre || 0))}
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
              {overdueItems.payables.length > 10 && (
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  + {overdueItems.payables.length - 10} outros títulos...
                </p>
              )}
           </div>
        </ReportCard>

        <ReportCard title="Pendências em Atraso (A Receber)" className="border-l-4 border-l-amber-500">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-amber-600">
                 <AlertTriangle size={20} />
                 <span className="font-bold text-lg">{overdueItems.receivables.length} Títulos Vencidos</span>
              </div>
              <span className="text-xl font-bold text-slate-800">{formatCurrency(overdueItems.totalReceivable)}</span>
           </div>
           <div className="max-h-48 overflow-y-auto custom-scrollbar pr-2">
              <table className="w-full text-xs text-left">
                 <thead className="text-slate-500 border-b border-slate-100">
                    <tr>
                       <th className="py-1">Cliente</th>
                       <th className="py-1">Vencimento</th>
                       <th className="py-1 text-right">Valor</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {overdueItems.receivables.slice(0, 10).map((item, idx) => (
                       <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 truncate max-w-[150px]" title={item.fpa_st_favorecido}>{item.fpa_st_favorecido}</td>
                          <td className="py-1.5 text-amber-600 font-medium">
                            {item.dt_vencto ? new Date(item.dt_vencto).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="py-1.5 text-right font-bold text-slate-700">
                             {formatCurrency(Number(item.mov_re_saldocpacre || 0))}
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
              {overdueItems.receivables.length > 10 && (
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  + {overdueItems.receivables.length - 10} outros títulos...
                </p>
              )}
           </div>
        </ReportCard>
      </div>

    </div>
  );
};

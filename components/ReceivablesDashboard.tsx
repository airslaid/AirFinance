import React, { useEffect, useState, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  RefreshCw, 
  Calendar,
  AlertCircle,
  Database,
  Copy,
  Check,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Building,
  CreditCard,
  LayoutGrid,
  List,
  Clock,
  Settings2,
  Eye,
  EyeOff,
  X,
  CalendarDays,
  Info,
  Save,
  RotateCcw,
  GripHorizontal,
  Wallet,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  FileType,
  Landmark
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Cell
} from 'recharts';
import { ReceivableRecord, KPIData } from '../types';
import { fetchReceivablesData, syncDataFromPowerBI } from '../services/dataService';

// --- CONSTANTES DE ARMAZENAMENTO ---
const STORAGE_KEY_COLUMNS = 'FINBI_RECEIVABLES_COLUMNS_CONFIG_V1';
const STORAGE_KEY_FILTERS = 'FINBI_RECEIVABLES_FILTERS_CONFIG_V1';

// --- MAPA DE FILIAIS (Reutilizado ou ajustado se necessário) ---
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

// --- DEFINIÇÃO DE COLUNAS ---

interface ColumnDef {
  key: keyof ReceivableRecord;
  label: string;
  visible: boolean;
  type: 'text' | 'number' | 'currency' | 'date' | 'status';
  width?: string;
}

const INITIAL_COLUMNS: ColumnDef[] = [
  { key: 'org_in_codigo', label: 'FILIAL', visible: true, type: 'text', width: '150px' },
  { key: 'fre_tpd_st_codigo', label: 'TP DOC', visible: true, type: 'text', width: '80px' },
  { key: 'cre_st_documento', label: 'DOC', visible: true, type: 'text', width: '100px' },
  { key: 'agn_in_codigo', label: 'COD', visible: true, type: 'number', width: '60px' },
  { key: 'fpa_st_favorecido', label: 'CLIENTE', visible: true, type: 'text' }, 
  { key: 'cre_st_parcela', label: 'PARC', visible: true, type: 'text', width: '60px' },
  
  { key: 'fpa_dt_emissao', label: 'EMISSÃO', visible: true, type: 'date', width: '90px' },
  { key: 'dt_vencto', label: 'VENCTO', visible: true, type: 'date', width: '90px' },
  { key: 'fpa_st_doctointerno', label: 'DOC INT', visible: true, type: 'text' },
  { key: 'valor', label: 'VALOR', visible: true, type: 'currency', width: '110px' },
  { key: 'mov_re_saldocpacre', label: 'SALDO', visible: true, type: 'currency', width: '110px' },
  
  { key: 'dt_baixa', label: 'DT BAIXA', visible: true, type: 'date', width: '90px' },
  
  { key: 'mov_ch_conciliado', label: 'STATUS', visible: true, type: 'status', width: '100px' },
  
  // Colunas ocultas por padrão
  { key: 'dt_lancamento', label: 'DT LANC', visible: false, type: 'date' },
  { key: 'fre_in_numero', label: 'NUMERO', visible: false, type: 'number' },
  { key: 'mov_ch_natureza', label: 'NAT', visible: false, type: 'text' },
  { key: 'rcb_st_nota', label: 'NOTA', visible: false, type: 'text' },
];

// --- COMPONENTS AUXILIARES ---

const KPICard = ({ title, value, subtext, icon: Icon, trend, color, tooltip }: any) => {
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

export const ReceivablesDashboard: React.FC = () => {
  // State Basics
  const [activeTab, setActiveTab] = useState<'overview' | 'receivables'>('receivables');
  const [data, setData] = useState<ReceivableRecord[]>([]);
  const [filteredData, setFilteredData] = useState<ReceivableRecord[]>([]);
  const [totalDbCount, setTotalDbCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Column Management & DnD
  const [columns, setColumns] = useState<ColumnDef[]>(INITIAL_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // Export Menu
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof ReceivableRecord | null, direction: 'asc' | 'desc' }>({ 
    key: 'dt_vencto', 
    direction: 'desc' 
  });
  
  // Drag References
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Filters
  const currentYear = new Date().getFullYear();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateTypeFilter, setDateTypeFilter] = useState<'vencto' | 'emissao' | 'baixa'>('vencto');
  const [excludePDV, setExcludePDV] = useState(false);
  
  // Default to Current Year
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadData = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetchReceivablesData();
      setData(result.data);
      setTotalDbCount(result.totalDbCount || 0);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const handleSync = React.useCallback(async (silent = false) => {
    try {
      setSyncing(true);
      setSyncError(null);
      const result = await syncDataFromPowerBI('receivables');
      if (result.success) {
        await loadData(true);
        setLastSyncTime(new Date());
      } else {
        setSyncError(result.message);
      }
    } catch (error) {
      console.error("Erro crítico na sincronização:", error);
      setSyncError("Erro interno ao tentar sincronizar.");
    } finally {
      setSyncing(false);
    }
  }, [loadData]);

  // --- INITIAL LOAD & AUTO SYNC ---
  useEffect(() => {
    const init = async () => {
      // 1. Load initial data
      await loadData();
      // 2. Trigger background sync
      handleSync(true);
    };
    
    init();

    // 3. Load Saved Layout (Columns)
    const savedColumns = localStorage.getItem(STORAGE_KEY_COLUMNS);
    if (savedColumns) {
      try {
        setColumns(JSON.parse(savedColumns));
      } catch (e) {
        console.error("Erro ao carregar colunas salvas", e);
      }
    }

    // 4. Load Saved Filters
    const savedFilters = localStorage.getItem(STORAGE_KEY_FILTERS);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (parsed.branch) setBranchFilter(parsed.branch);
        if (parsed.status) setStatusFilter(parsed.status);
        if (parsed.dateType) setDateTypeFilter(parsed.dateType);
      } catch (e) {
        console.error("Erro ao carregar filtros salvos", e);
      }
    }

    // 5. Setup Interval
    const interval = setInterval(() => {
      handleSync(true);
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [loadData, handleSync]);

  // --- EXPORT FUNCTIONS ---
  
  const getExportData = () => {
    // Uses sortedData to respect current filters and sort order
    return sortedData.map(item => {
      const row: any = {};
      columns.filter(c => c.visible).forEach(col => {
        let val = item[col.key];
        
        // Format values for export
        if (col.type === 'currency') {
           row[col.label] = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));
        } else if (col.type === 'date') {
           row[col.label] = formatDate(val as string);
        } else if (col.type === 'status') {
           const saldo = Number(item.mov_re_saldocpacre || 0);
           row[col.label] = saldo <= 0 ? 'PAGO' : 'ABERTO';
        } else if (col.key === 'org_in_codigo') {
           row[col.label] = BRANCH_MAP[String(val)] || val;
        } else {
           row[col.label] = val;
        }
      });
      return row;
    });
  };

  const exportToCSV = () => {
    const dataToExport = getExportData();
    if (dataToExport.length === 0) return;

    const headers = Object.keys(dataToExport[0]);
    const csvContent = [
      headers.join(';'), // CSV Header
      ...dataToExport.map(row => headers.map(fieldName => {
        // Handle strings with commas or semicolons by wrapping in quotes
        let val = row[fieldName] ? String(row[fieldName]) : '';
        if (val.includes(';') || val.includes('\n')) {
          val = `"${val}"`;
        }
        return val;
      }).join(';'))
    ].join('\n');

    // Add BOM for Excel to recognize encoding correctly
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_receber_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportToPDF = () => {
    const dataToExport = getExportData();
    if (dataToExport.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    const headers = Object.keys(dataToExport[0]);
    const body = dataToExport.map(row => Object.values(row));

    doc.setFontSize(14);
    doc.text("Relatório Contas a Receber - AirFinance", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Filtro: ${dataToExport.length} registros`, 14, 22);

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [16, 185, 129] }, // Emerald-500 for Receivables
      theme: 'grid'
    });

    doc.save(`relatorio_receber_${new Date().toISOString().slice(0,10)}.pdf`);
    setShowExportMenu(false);
  };

  // --- SAVE & RESET PREFERENCES ---
  const saveView = () => {
    // Save Columns (Order & Visibility)
    localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(columns));
    
    // Save Main Filters
    const filters = {
      branch: branchFilter,
      status: statusFilter,
      dateType: dateTypeFilter
    };
    localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));

    // UI Feedback
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const resetView = () => {
    if (confirm("Deseja restaurar o layout e filtros para o padrão?")) {
      setColumns(INITIAL_COLUMNS);
      setBranchFilter('all');
      setStatusFilter('all');
      setDateTypeFilter('vencto');
      setSortConfig({ key: 'dt_vencto', direction: 'desc' });
      
      // Reset dates to Current Year
      setStartDate(`${currentYear}-01-01`);
      setEndDate(`${currentYear}-12-31`);

      localStorage.removeItem(STORAGE_KEY_COLUMNS);
      localStorage.removeItem(STORAGE_KEY_FILTERS);
    }
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent<HTMLTableHeaderCellElement>, index: number) => {
    dragItem.current = index;
    // Effect to look like dragging
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e: React.DragEvent<HTMLTableHeaderCellElement>, index: number) => {
    dragOverItem.current = index;
    e.preventDefault();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const _dragItem = dragItem.current;
    const _dragOverItem = dragOverItem.current;

    if (_dragItem === null || _dragOverItem === null || _dragItem === _dragOverItem) {
        dragItem.current = null;
        dragOverItem.current = null;
        return;
    }

    const visibleCols = columns.filter(c => c.visible);
    const draggedColKey = visibleCols[_dragItem].key;
    const targetColKey = visibleCols[_dragOverItem].key;

    const sourceIndex = columns.findIndex(c => c.key === draggedColKey);
    const targetIndex = columns.findIndex(c => c.key === targetColKey);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const newColumns = [...columns];
    const [draggedCol] = newColumns.splice(sourceIndex, 1);
    newColumns.splice(targetIndex, 0, draggedCol);

    setColumns(newColumns);
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // --- SORTING HANDLER ---
  const handleSort = (key: keyof ReceivableRecord) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // ... (Rest of useMemo and useEffect hooks remain same)
  const availableBranches = useMemo(() => {
    const branches = new Set<string>();
    data.forEach(item => {
      if (item.org_in_codigo) branches.add(String(item.org_in_codigo));
    });
    return Array.from(branches).sort((a, b) => Number(a) - Number(b));
  }, [data]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let result = data;

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.fpa_st_favorecido?.toLowerCase().includes(lowerTerm) ||
        item.cre_st_documento?.toLowerCase().includes(lowerTerm) ||
        String(item.valor).includes(lowerTerm)
      );
    }

    if (statusFilter !== 'all') {
      const wantPaid = statusFilter === 'paid';
      result = result.filter(item => {
        const saldo = Number(item.mov_re_saldocpacre || 0);
        const isPaid = saldo <= 0;
        return wantPaid ? isPaid : !isPaid;
      });
    }

    if (branchFilter !== 'all') {
      result = result.filter(item => String(item.org_in_codigo) === branchFilter);
    }

    if (excludePDV) {
      result = result.filter(item => item.fre_tpd_st_codigo !== 'PDV');
    }

    if (startDate || endDate) {
      result = result.filter(item => {
        let dateStr: string | undefined;
        
        switch(dateTypeFilter) {
            case 'vencto': dateStr = item.dt_vencto; break;
            case 'emissao': dateStr = item.fpa_dt_emissao; break;
            case 'baixa': 
               // Lógica solicitada: Se tiver saldo (mov_re_saldocpacre > 0), ignora a data de baixa para fins de filtro,
               // pois considera-se que o título ainda está em aberto.
               if ((Number(item.mov_re_saldocpacre) || 0) > 0) {
                 dateStr = undefined;
               } else {
                 dateStr = item.dt_baixa;
               }
               break;
            default: dateStr = item.dt_vencto;
        }

        if (!dateStr || dateStr.length < 10) return false;
        const itemDate = dateStr.split('T')[0]; 
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    setFilteredData(result);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, branchFilter, data, startDate, endDate, dateTypeFilter, excludePDV]);

  // Recalculate KPIs based on filtered data for the list view
  const filteredKpi = useMemo(() => {
      let totalPending = 0;
      let totalPaid = 0;
      let totalGeneral = 0;
      let countPending = 0;

      filteredData.forEach(record => {
        const valorOriginal = Number(record.valor || 0);
        const saldoPendente = Number(record.mov_re_saldocpacre || 0);
        
        // Assuming Paid = Original - Pending
        // If saldoPendente is 0, then Paid = Original.
        // If saldoPendente > 0, then Paid = Original - Pending (Partial payment)
        const valorBaixado = Math.max(0, valorOriginal - saldoPendente);

        totalGeneral += valorOriginal;
        totalPaid += valorBaixado;

        if (saldoPendente > 0) {
          totalPending += saldoPendente;
          countPending++;
        }
      });

      return { 
        totalPending, 
        totalPaid, 
        totalGeneral, 
        countPending 
      };
  }, [filteredData]);

  const toggleColumn = (key: keyof ReceivableRecord) => {
    setColumns(prev => prev.map(col => 
      col.key === key ? { ...col, visible: !col.visible } : col
    ));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const [y, m, d] = dateString.split('-');
    return `${d}/${m}/${y}`;
  };

  // --- MEMOIZED SORTED DATA ---
  const sortedData = useMemo(() => {
    // If no sort key, return filtered data as is
    if (!sortConfig.key) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key!];
      const bVal = b[sortConfig.key!];

      // Handle null/undefined values
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Numeric Sort
      if (typeof aVal === 'number' && typeof bVal === 'number') {
         return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String/Date Sort
      const aString = String(aVal).toLowerCase();
      const bString = String(bVal).toLowerCase();

      if (aString < bString) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aString > bString) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- AGGREGATION FOR NEW MONTHLY CHART ---
  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { dateKey: string, name: string, total: number, paid: number }>();

    filteredData.forEach(item => {
      // Use Due Date (vencto) for the monthly timeline as default
      if (!item.dt_vencto) return;
      
      const dateStr = item.dt_vencto.split('T')[0];
      const [y, m] = dateStr.split('-');
      
      const dateKey = `${y}-${m}`;
      
      // Create Label: JAN/26
      const dateObj = new Date(Number(y), Number(m) - 1, 1);
      const name = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();

      if (!map.has(dateKey)) {
        map.set(dateKey, { dateKey, name, total: 0, paid: 0 });
      }

      const entry = map.get(dateKey)!;
      const valorOriginal = Number(item.valor || 0);
      const saldoPendente = Number(item.mov_re_saldocpacre || 0);
      const baixado = Math.max(0, valorOriginal - saldoPendente);

      // Total General (Original Bill Value)
      entry.total += valorOriginal;
      // Total Paid
      entry.paid += baixado;
    });

    // Sort chronologically
    return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [filteredData]);

  const visibleCols = columns.filter(c => c.visible);

  // --- SHARED FILTER BAR RENDERER ---
  const renderFilterBar = (enableColumnPicker: boolean) => (
    <div className="bg-white p-1.5 border border-slate-300 flex flex-col xl:flex-row gap-1.5 justify-between items-start xl:items-center">
      <div className="flex flex-wrap gap-1.5 w-full xl:w-auto">
         <div className="relative w-40">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input 
              type="text"
              placeholder="Buscar cliente/doc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-2 py-0.5 bg-white border border-slate-300 text-[10px] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-sm"
            />
         </div>
         
         <div className="relative">
           <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-1.5 pr-5 py-0.5 bg-white border border-slate-300 text-[10px] appearance-none cursor-pointer focus:outline-none focus:border-emerald-500 rounded-sm min-w-[100px]"
           >
             <option value="all">Status: Todos</option>
             <option value="open">Em Aberto</option>
             <option value="paid">Pago</option>
           </select>
           <ChevronDownIcon />
         </div>

         <div className="relative">
           <select 
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="pl-1.5 pr-5 py-0.5 bg-white border border-slate-300 text-[10px] appearance-none cursor-pointer focus:outline-none focus:border-emerald-500 rounded-sm min-w-[100px]"
           >
             <option value="all">Filial: Todas</option>
             {availableBranches.map(branch => (
               <option key={branch} value={branch}>
                 {BRANCH_MAP[branch] || branch}
               </option>
             ))}
           </select>
           <ChevronDownIcon />
         </div>

         <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer select-none bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded-sm hover:bg-slate-100">
            <input 
              type="checkbox" 
              checked={excludePDV}
              onChange={(e) => setExcludePDV(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-2.5 h-2.5"
            />
            <span>Ocultar PDV</span>
         </label>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center w-full xl:w-auto p-0.5 bg-slate-50 border border-slate-200">
          <div className="relative">
             <select 
                value={dateTypeFilter}
                onChange={(e) => setDateTypeFilter(e.target.value as 'vencto' | 'emissao' | 'baixa')}
                className="pl-1 pr-4 py-0.5 bg-white border border-slate-300 text-[10px] focus:outline-none focus:border-emerald-500 font-medium"
             >
                <option value="vencto">Vencimento</option>
                <option value="emissao">Emissão</option>
                <option value="baixa">Data Baixa</option>
             </select>
             <ChevronDownIcon />
          </div>

          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="py-0.5 px-1 bg-white border border-slate-300 text-[10px] focus:outline-none focus:border-emerald-500 w-24"
          />
          
          <span className="text-slate-400 text-[9px]">-</span>

          <input 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="py-0.5 px-1 bg-white border border-slate-300 text-[10px] focus:outline-none focus:border-emerald-500 w-24"
          />
      </div>

      {enableColumnPicker ? (
        <div className="flex items-center gap-1.5 relative ml-auto xl:ml-0">
          
           {/* EXPORT DROPDOWN */}
           <div className="relative" ref={exportMenuRef}>
             <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`flex items-center gap-1 px-3 py-1 border text-xs font-bold uppercase transition-colors rounded-sm ${showExportMenu ? 'bg-slate-200 border-slate-400 text-slate-900' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
             >
                <Download size={12} />
                <span>Exportar</span>
             </button>
             {showExportMenu && (
                <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-400 shadow-lg z-50 p-0 rounded-none">
                   <button 
                      onClick={exportToCSV}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                   >
                      <FileSpreadsheet size={14} className="text-emerald-600"/> Excel (CSV)
                   </button>
                   <button 
                      onClick={exportToPDF}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 border-t border-slate-100"
                   >
                      <FileType size={14} className="text-rose-600"/> PDF
                   </button>
                </div>
             )}
           </div>

           {/* COLUMNS DROPDOWN */}
           <div className="relative" ref={columnPickerRef}>
              <button 
                  onClick={() => setShowColumnPicker(!showColumnPicker)}
                  className={`flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold uppercase transition-colors rounded-sm ${showColumnPicker ? 'bg-slate-200 border-slate-400 text-slate-900' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                  <Settings2 size={10} />
                  <span>Colunas</span>
              </button>

              {showColumnPicker && (
                  <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-400 shadow-lg z-50 p-0 rounded-none">
                      <div className="flex justify-between items-center px-2 py-1 bg-slate-100 border-b border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Exibir Colunas</span>
                        <button onClick={() => setShowColumnPicker(false)} className="text-slate-400 hover:text-slate-600"><X size={12}/></button>
                      </div>
                      <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {columns.map((col, idx) => (
                            <div 
                              key={col.key}
                              onClick={() => toggleColumn(col.key)}
                              className="flex items-center justify-between px-2 py-1 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                            >
                              <span className={`text-xs ${col.visible ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                                {col.label}
                              </span>
                              {col.visible ? (
                                <Eye size={12} className="text-blue-600" />
                              ) : (
                                <EyeOff size={12} className="text-slate-300" />
                              )}
                            </div>
                        ))}
                      </div>
                  </div>
              )}
           </div>
        </div>
      ) : (
         <div className="w-0 xl:w-20"></div> // Spacer
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-12">
      {/* System Toolbar */}
      <div className="bg-white p-2 border border-slate-300 flex justify-between items-center">
        <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-800 uppercase tracking-tight pl-2 border-l-4 border-emerald-600">Contas a Receber</h1>
            <span className="text-xs text-slate-400">|</span>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-mono leading-none">DATASET: REL_CONTAS_RECEBER</span>
              {lastSyncTime && (
                <span className="text-[9px] text-emerald-600 font-bold uppercase mt-0.5">
                  Atualizado: {lastSyncTime.toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-100 p-0.5 border border-slate-300">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 text-xs font-bold uppercase transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 border border-slate-300 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Visão Geral
            </button>
            <button 
              onClick={() => setActiveTab('receivables')}
              className={`px-3 py-1 text-xs font-bold uppercase transition-all ${activeTab === 'receivables' ? 'bg-white text-slate-900 border border-slate-300 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Lançamentos
            </button>
          </div>

          <div className="h-6 w-px bg-slate-300 mx-2"></div>

          <button 
            onClick={saveView}
            className={`flex items-center space-x-1 px-3 py-1 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase transition-all rounded-sm ${settingsSaved ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : ''}`}
            title="Salvar layout e filtros atuais"
          >
             {settingsSaved ? <Check size={12} /> : <Save size={12} />}
             <span>{settingsSaved ? 'Salvo!' : 'Salvar Visão'}</span>
          </button>
          
          <button 
            onClick={resetView}
            className="p-1.5 border border-slate-300 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 text-xs rounded-sm transition-all"
            title="Restaurar padrão"
          >
             <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {syncError && (
         <div className="bg-red-100 border-l-4 border-red-500 text-red-800 px-4 py-2 text-xs font-medium">
            ERRO: {syncError}
         </div>
      )}
      
      {/* ---------------- OVERVIEW TAB ---------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Shared Filter Bar (No Column Picker) */}
          {renderFilterBar(false)}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KPICard title="Total a Receber (Aberto)" value={formatCurrency(filteredKpi.totalPending)} subtext={`${filteredKpi.countPending} títulos`} icon={Clock} color="amber" />
            <KPICard 
              title="Total Recebido" 
              value={formatCurrency(filteredKpi.totalPaid)} 
              subtext="Baixado" 
              icon={Check} 
              color="emerald" 
              tooltip="Soma dos valores já quitados, incluindo amortizações parciais de títulos em aberto."
            />
            <KPICard title="Total Geral" value={formatCurrency(filteredKpi.totalGeneral)} subtext="Volume Total" icon={DollarSign} color="slate" />
            <KPICard title="Fluxo Futuro" value={formatCurrency(filteredKpi.totalPending)} subtext="Previsão" icon={ArrowUpRight} color="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[400px]">
            {/* GRÁFICO MENSAL (100% Width for now, removed top accounts as we don't have account info) */}
            <div className="lg:col-span-3 bg-white p-4 border border-slate-300 flex flex-col h-full">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xs text-slate-700 uppercase">Fluxo Mensal: Total a Receber vs Total Recebido</h3>
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase">
                     <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-slate-500"></div> Total a Receber
                     </div>
                     <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-emerald-500"></div> Total Recebido
                     </div>
                  </div>
               </div>
               
               <div className="flex-1 w-full min-h-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={monthlyChartData} barGap={4}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                     <Tooltip 
                       cursor={{fill: '#f1f5f9'}}
                       contentStyle={{borderRadius: '0px', border: '1px solid #cbd5e1', fontSize: '12px'}}
                       formatter={(val: number, name: string) => [formatCurrency(val), name]}
                     />
                     <Legend content={() => null} />
                     <Bar dataKey="total" name="Total a Receber" fill="#64748b" radius={[2, 2, 0, 0]} maxBarSize={50} />
                     <Bar dataKey="paid" name="Total Recebido" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={50} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- RECEIVABLES TAB ---------------- */}
      {activeTab === 'receivables' && (
        <div className="space-y-3 animate-in fade-in duration-200">
           
           {/* Dynamic KPI Strip for List View */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white px-3 py-2 border-l-4 border-slate-400 border-y border-r border-slate-300 shadow-sm">
                 <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Total Original</p>
                      <p className="text-lg font-bold text-slate-700 leading-none">{formatCurrency(filteredKpi.totalGeneral)}</p>
                    </div>
                    <DollarSign size={14} className="text-slate-400" />
                 </div>
              </div>

              <div className="bg-white px-3 py-2 border-l-4 border-emerald-500 border-y border-r border-slate-300 shadow-sm">
                 <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-emerald-600 mb-0.5">Total Recebido</p>
                      <p className="text-lg font-bold text-emerald-700 leading-none">{formatCurrency(filteredKpi.totalPaid)}</p>
                    </div>
                    <Check size={14} className="text-emerald-500" />
                 </div>
              </div>

              <div className="bg-white px-3 py-2 border-l-4 border-amber-500 border-y border-r border-slate-300 shadow-sm">
                 <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-amber-600 mb-0.5">Saldo em Aberto</p>
                      <p className="text-lg font-bold text-amber-700 leading-none">{formatCurrency(filteredKpi.totalPending)}</p>
                    </div>
                    <AlertCircle size={14} className="text-amber-500" />
                 </div>
              </div>

              <div className="bg-white px-3 py-2 border-l-4 border-blue-500 border-y border-r border-slate-300 shadow-sm">
                 <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-blue-600 mb-0.5">Qtd. Registros</p>
                      <p className="text-lg font-bold text-blue-700 leading-none">{filteredData.length}</p>
                    </div>
                    <List size={14} className="text-blue-500" />
                 </div>
              </div>
           </div>

           {/* Shared Filter Bar (With Column Picker) */}
           {renderFilterBar(true)}

           {/* Stats Strip */}
           <div className="flex items-center justify-between px-2 py-1 bg-slate-200 border border-slate-300 text-xs">
             <div className="flex items-center gap-4">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <Database size={10} /> DB: <span className="font-bold">{totalDbCount}</span>
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <ArrowDownRight size={10} /> Local: <span className="font-bold">{data.length}</span>
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600 font-medium flex items-center gap-1">
                   <Eye size={10} /> Filtro: <span className="font-bold text-emerald-700">{filteredData.length}</span>
                </span>
             </div>
             {data.length < totalDbCount && (
               <div className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                  <Info size={10} /> Parcial
               </div>
             )}
           </div>

           {/* High Density Grid */}
           <div className="bg-white border border-slate-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      {visibleCols.map((col, idx) => (
                         <th 
                            key={col.key} 
                            onClick={() => handleSort(col.key)}
                            className="px-2 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap border-r border-slate-200 last:border-0 group cursor-pointer hover:bg-slate-200 select-none relative transition-colors" 
                            style={{ minWidth: col.width || 'auto' }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragEnter={(e) => handleDragEnter(e, idx)}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                         >
                            <div className="flex items-center gap-1">
                              <GripHorizontal size={10} className="text-slate-300 group-hover:text-slate-500" />
                              {col.label}
                              {sortConfig.key === col.key && (
                                <span className="ml-0.5 text-emerald-600">
                                   {sortConfig.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                </span>
                              )}
                            </div>
                         </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan={visibleCols.length} className="px-6 py-12 text-center text-slate-500 text-xs">
                          <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-emerald-600" />
                          Processando...
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                         <td colSpan={visibleCols.length} className="px-6 py-8 text-center text-slate-400 text-xs italic">
                           Nenhum registro encontrado.
                         </td>
                      </tr>
                    ) : (
                      paginatedData.map((item, idx) => {
                        const saldo = Number(item.mov_re_saldocpacre || 0);
                        const isPaid = saldo <= 0;
                        
                        return (
                          <tr key={item.id || idx} className="hover:bg-blue-50 transition-colors even:bg-slate-50/50">
                            {visibleCols.map(col => {
                               let content: React.ReactNode = item[col.key] as React.ReactNode;
                               let className = "px-2 py-0.5 text-[11px] text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-0";

                               if (col.type === 'currency') {
                                  const val = Number(content || 0);
                                  content = formatCurrency(val);
                                  className += ' text-right';
                                  
                                  if (col.key === 'mov_re_saldocpacre') {
                                    className += ' font-bold text-amber-700';
                                  } else if (col.key === 'valor') {
                                    className += ' font-mono text-slate-600';
                                  } else {
                                    className += ' font-mono text-slate-600';
                                  }

                               } else if (col.type === 'date') {
                                  // Lógica específica para Data de Baixa:
                                  // Se o título tem saldo (mov_re_saldocpacre > 0), não deve exibir data de baixa,
                                  // pois isso indica que ainda está em aberto (ou parcialmente aberto), e a data de baixa pode estar incorreta na origem.
                                  if (col.key === 'dt_baixa' && (item.mov_re_saldocpacre || 0) > 0) {
                                    content = ''; // Oculta data de baixa se tiver saldo
                                  } else {
                                    content = formatDate(content as string);
                                  }
                                  className += " text-slate-500 font-mono";
                               } else if (col.type === 'status') {
                                  content = isPaid ? (
                                    <span className="block text-center text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1 py-0.5">
                                      PAGO
                                    </span>
                                  ) : (
                                    <span className="block text-center text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1 py-0.5">
                                      ABERTO
                                    </span>
                                  );
                               } else if (col.key === 'org_in_codigo') {
                                  const code = String(content);
                                  content = BRANCH_MAP[code] || content;
                                  className += " font-semibold text-slate-800";
                               }

                               return (
                                 <td key={col.key} className={className}>
                                   {content}
                                 </td>
                               );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="bg-slate-100 border-t border-slate-300 px-2 py-1 flex items-center justify-between">
                 <div className="text-[10px] text-slate-500 uppercase font-bold">
                    Reg. <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, sortedData.length)}</span> de <span className="text-slate-900">{sortedData.length}</span>
                 </div>
                 
                 <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-0.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                    >
                       <ChevronLeft size={14} className="text-slate-600" />
                    </button>
                    <div className="text-[10px] font-bold text-slate-700 px-2">
                       {currentPage} / {totalPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-0.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
                    >
                       <ChevronRight size={14} className="text-slate-600" />
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const ChevronDownIcon = () => (
  <ChevronLeft className="absolute right-2 top-1/2 -translate-y-1/2 rotate-[-90deg] pointer-events-none text-slate-400" size={10} />
);

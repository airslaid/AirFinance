
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, PieChart, Wallet, Settings, Menu, X, Database, Bell, Search, ChevronDown, FileText, CircleDollarSign, LogOut, Users, ArrowUpRight, TrendingUp } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { PageView } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: PageView;
  onNavigate?: (page: PageView) => void;
}

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active = false, 
  badge, 
  onClick 
}: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  badge?: string,
  onClick?: () => void
}) => (
  <div 
    onClick={onClick}
    className={`group flex items-center justify-between px-4 py-1.5 cursor-pointer transition-colors duration-150 border-l-4 ${active ? 'bg-rose-50 border-rose-600 text-rose-700' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
  >
    <div className="flex items-center space-x-2.5">
      <Icon size={16} className={active ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-600'} />
      <span className="font-medium text-xs">{label}</span>
    </div>
    {badge && (
      <span className={`text-[9px] px-1 py-0.5 font-bold border ${active ? 'bg-white border-rose-200 text-rose-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
        {badge}
      </span>
    )}
  </div>
);

export const Layout: React.FC<LayoutProps> = ({ children, currentPage = 'dashboard', onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const email = user.email || '';
        setUserEmail(email);

        // FAILSAFE: Lista de Super Admins (Hardcoded)
        // Garante acesso ao menu mesmo se o banco de dados falhar ou demorar para atualizar
        const SUPER_ADMINS = ['ti@grupoairslaid.com.br', 'cassia@grupoairslaid.com.br'];
        
        if (SUPER_ADMINS.includes(email)) {
            setIsAdmin(true);
        }

        // Tenta buscar a role do banco para outros usuários ou confirmação
        const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        if (data && data.role === 'admin') {
            setIsAdmin(true);
        }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNav = (page: PageView) => {
    if (onNavigate) onNavigate(page);
    setIsOpen(false); // Close mobile menu on nav
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-inter text-slate-800">
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - ENTERPRISE LIGHT THEME (Sharper edges) */}
      <aside className={`fixed lg:sticky top-0 h-screen w-56 bg-white flex flex-col transition-transform z-50 border-r border-slate-200 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Logo Header */}
        <div className="h-12 flex items-center px-4 border-b border-slate-200 bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 bg-rose-700 rounded-sm flex items-center justify-center shadow-sm">
              <CircleDollarSign size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="block text-base font-bold tracking-tight text-slate-800 leading-none">
                Air<span className="text-rose-600">Finance</span>
              </span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden ml-auto text-slate-400 hover:text-rose-600">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar">
          <div className="px-4 mb-1.5 mt-0.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Financeiro</p>
          </div>
          <SidebarItem 
            icon={TrendingUp} 
            label="Fluxo de Caixa" 
            active={currentPage === 'cashflow'} 
            onClick={() => handleNav('cashflow')}
          />
          <SidebarItem 
            icon={FileText} 
            label="Contas a Pagar" 
            badge="ERP" 
            active={currentPage === 'dashboard'} 
            onClick={() => handleNav('dashboard')}
          />
          <SidebarItem 
            icon={ArrowUpRight} 
            label="Contas a Receber" 
            badge="ERP" 
            active={currentPage === 'receivables'} 
            onClick={() => handleNav('receivables')}
          />
          <SidebarItem 
            icon={PieChart} 
            label="Relatórios" 
            active={currentPage === 'reports'} 
            onClick={() => handleNav('reports')}
          />
          
          <div className="px-4 mt-4 mb-1.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sistema</p>
          </div>
          
          {/* ADMIN ONLY LINK */}
          {isAdmin && (
             <SidebarItem 
               icon={Users} 
               label="Gestão de Usuários" 
               active={currentPage === 'users'}
               onClick={() => handleNav('users')}
             />
          )}

          <SidebarItem icon={Settings} label="Configurações" />
          <SidebarItem icon={Database} label="Integração de Dados" />
        </nav>

        {/* User Profile Footer */}
        <div className="p-0 border-t border-slate-200 bg-white">
          <div className="flex items-center px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer group relative">
            <div className="w-7 h-7 bg-slate-100 flex items-center justify-center rounded-sm border border-slate-300 text-slate-600 font-bold text-[10px]">
                 {userEmail.substring(0, 2).toUpperCase()}
            </div>
            <div className="ml-2.5 flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-rose-700">
                {isAdmin ? 'Administrador' : 'Usuário'}
              </p>
              <p className="text-[10px] text-slate-500 truncate" title={userEmail}>{userEmail}</p>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-all"
              title="Sair do sistema"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f1f5f9]">
        {/* Top Header */}
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-3 lg:px-4 sticky top-0 z-30">
          <div className="flex items-center">
            <button onClick={() => setIsOpen(true)} className="lg:hidden mr-3 text-slate-500 hover:text-slate-800">
              <Menu size={18} />
            </button>
            
            {/* Search Bar - Square Style */}
            <div className="hidden md:flex items-center space-x-2 text-slate-500 bg-slate-100 px-2.5 py-1 border border-slate-300 w-64 focus-within:ring-1 focus-within:ring-rose-500 focus-within:border-rose-500 rounded-sm transition-all">
              <Search size={12} />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="bg-transparent border-none outline-none text-[11px] text-slate-700 w-full placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 px-1.5 py-0.5 bg-white border border-slate-200 shadow-sm rounded-sm">
                <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wide">Conectado</span>
            </div>
            
            <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>
            
            <button className="relative text-slate-500 hover:text-slate-800 transition-colors">
              <Bell size={16} />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-600 border border-white rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 lg:p-4">
          <div className="max-w-[1920px] mx-auto space-y-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

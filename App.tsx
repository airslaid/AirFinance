
import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ReceivablesDashboard } from './components/ReceivablesDashboard';
import { CashFlowDashboard } from './components/CashFlowDashboard';
import { ReportsDashboard } from './components/ReportsDashboard';
import { UserManagement } from './components/UserManagement';
import { Login } from './components/Login';
import { supabase } from './services/supabaseClient';
import { Session } from 'https://esm.sh/@supabase/supabase-js@2';
import { Loader2 } from 'lucide-react';
import { PageView } from './types';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageView>('cashflow');

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <Loader2 size={32} className="animate-spin mb-4 text-rose-600" />
        <p className="text-sm font-medium animate-pulse">Carregando AirFinance...</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'receivables' && <ReceivablesDashboard />}
      {currentPage === 'cashflow' && <CashFlowDashboard />}
      {currentPage === 'reports' && <ReportsDashboard />}
      {currentPage === 'users' && <UserManagement />}
    </Layout>
  );
}

export default App;

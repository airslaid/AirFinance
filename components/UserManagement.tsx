
import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { fetchProfiles, updateUserRole, createUser, deleteUser, resetPassword } from '../services/userService';
import { 
  Users, 
  Shield, 
  User, 
  Plus, 
  MoreHorizontal, 
  Search, 
  Check, 
  X, 
  Loader2, 
  Mail, 
  Lock,
  Trash2,
  Key
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export const UserManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>('');

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset Password Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetting, setResetting] = useState(false);

  // Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email);
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchProfiles();
    setProfiles(data);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    // Prevent removing own admin access
    const user = profiles.find(p => p.id === userId);
    if (user?.email === currentUserEmail) {
        alert("Você não pode remover seu próprio acesso de administrador.");
        return;
    }

    try {
      // Optimistic update
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
      await updateUserRole(userId, newRole);
    } catch (err) {
      alert("Erro ao atualizar permissão.");
      loadData(); // Revert
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    if (userToDelete.email === currentUserEmail) {
        alert("Você não pode excluir seu próprio usuário.");
        return;
    }

    setDeleting(true);
    try {
        await deleteUser(userToDelete.id);
        alert("Usuário excluído com sucesso!");
        setShowDeleteModal(false);
        setUserToDelete(null);
        loadData();
    } catch (err: any) {
        alert("Erro ao excluir usuário: " + err.message);
    } finally {
        setDeleting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;

    setResetting(true);
    try {
        await resetPassword(userToReset.id, resetPasswordValue);
        alert("Senha alterada com sucesso!");
        setShowResetModal(false);
        setUserToReset(null);
        setResetPasswordValue('');
    } catch (err: any) {
        alert("Erro ao alterar senha: " + err.message);
    } finally {
        setResetting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
        await createUser(newUserEmail, newUserPass, newUserName, newUserRole);
        alert("Usuário criado com sucesso!");
        setShowAddModal(false);
        setNewUserEmail('');
        setNewUserPass('');
        setNewUserName('');
        loadData();
    } catch (err: any) {
        setCreateError(err.message);
    } finally {
        setCreating(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
       {/* Toolbar */}
       <div className="bg-white p-4 border border-slate-300 flex flex-col md:flex-row justify-between items-center gap-4 rounded-sm shadow-sm">
          <div>
             <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-rose-600" />
                Gestão de Usuários
             </h1>
             <p className="text-xs text-slate-500 mt-1">Gerencie acessos e permissões do sistema.</p>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar usuário..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:border-rose-500"
                />
             </div>
             <button 
               onClick={() => setShowAddModal(true)}
               className="bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-sm text-sm font-bold flex items-center gap-2 transition-colors"
             >
                <Plus size={16} />
                <span className="hidden sm:inline">Novo Usuário</span>
             </button>
          </div>
       </div>

       {/* Grid */}
       <div className="bg-white border border-slate-300 rounded-sm overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
               <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Usuário</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Permissão</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Cadastro</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {loading ? (
                  <tr>
                     <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        <Loader2 className="animate-spin mx-auto mb-2 text-rose-600" />
                        Carregando usuários...
                     </td>
                  </tr>
               ) : filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4">
                        <div className="flex items-center">
                           <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold border-2 border-white shadow-sm">
                              {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : profile.email.charAt(0).toUpperCase()}
                           </div>
                           <div className="ml-3">
                              <p className="text-sm font-bold text-slate-800">{profile.full_name || 'Sem nome'}</p>
                              <p className="text-xs text-slate-500">{profile.email}</p>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        {profile.role === 'admin' ? (
                           <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <Shield size={12} /> Admin
                           </span>
                        ) : (
                           <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <User size={12} /> Usuário
                           </span>
                        )}
                     </td>
                     <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                     </td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                            <button 
                               onClick={() => {
                                   setUserToReset(profile);
                                   setShowResetModal(true);
                               }}
                               className="text-slate-400 hover:text-blue-600 p-1.5 rounded-sm hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-200"
                               title="Alterar Senha"
                            >
                               <Key size={16} />
                            </button>
                            
                            <button 
                               onClick={() => handleRoleChange(profile.id, profile.role)}
                               className="text-slate-400 hover:text-rose-600 font-medium text-xs border border-slate-200 px-3 py-1.5 rounded-sm hover:border-rose-200 transition-all bg-white min-w-[80px]"
                               title="Alterar permissão"
                            >
                               {profile.role === 'admin' ? 'Rebaixar' : 'Promover'}
                            </button>

                            <button 
                               onClick={() => {
                                   setUserToDelete(profile);
                                   setShowDeleteModal(true);
                               }}
                               className="text-slate-400 hover:text-red-600 p-1.5 rounded-sm hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
                               title="Excluir Usuário"
                            >
                               <Trash2 size={16} />
                            </button>
                        </div>
                     </td>
                  </tr>
               ))}
            </tbody>
          </table>
       </div>

       {/* DELETE CONFIRMATION MODAL */}
       {showDeleteModal && userToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                   <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="text-red-600" size={24} />
                   </div>
                   <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir Usuário?</h3>
                   <p className="text-sm text-slate-500 mb-6">
                      Tem certeza que deseja excluir <strong>{userToDelete.full_name || userToDelete.email}</strong>? Esta ação não pode ser desfeita.
                   </p>
                   
                   <div className="flex gap-3">
                      <button 
                        onClick={() => setShowDeleteModal(false)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-bold text-sm rounded-sm hover:bg-slate-50 transition-colors"
                      >
                         Cancelar
                      </button>
                      <button 
                        onClick={handleDeleteUser}
                        disabled={deleting}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-bold text-sm rounded-sm hover:bg-red-700 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                      >
                         {deleting && <Loader2 size={16} className="animate-spin" />}
                         Excluir
                      </button>
                   </div>
                </div>
             </div>
          </div>
       )}

       {/* RESET PASSWORD MODAL */}
       {showResetModal && userToReset && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <h3 className="font-bold text-slate-800">Alterar Senha</h3>
                   <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                   <div className="bg-blue-50 p-3 rounded-sm border border-blue-100 mb-4">
                      <p className="text-xs text-blue-800">
                         Alterando senha para: <strong>{userToReset.email}</strong>
                      </p>
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nova Senha</label>
                      <div className="relative">
                         <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" />
                         <input 
                           type="password" 
                           required
                           minLength={6}
                           value={resetPasswordValue}
                           onChange={e => setResetPasswordValue(e.target.value)}
                           className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-rose-500 focus:outline-none"
                           placeholder="Mínimo 6 caracteres"
                         />
                      </div>
                   </div>

                   <div className="pt-2 flex gap-3">
                      <button 
                        type="button" 
                        onClick={() => setShowResetModal(false)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-bold text-sm rounded-sm hover:bg-slate-50 transition-colors"
                      >
                         Cancelar
                      </button>
                      <button 
                        type="submit" 
                        disabled={resetting}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-sm hover:bg-blue-700 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                      >
                         {resetting && <Loader2 size={16} className="animate-spin" />}
                         Salvar Senha
                      </button>
                   </div>
                </form>
             </div>
          </div>
       )}

       {/* ADD MODAL */}
       {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-md rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <h3 className="font-bold text-slate-800">Novo Usuário</h3>
                   <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                   {createError && (
                      <div className="bg-red-50 text-red-700 p-3 text-xs border border-red-200 rounded-sm">
                         {createError}
                      </div>
                   )}
                   
                   <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nome Completo</label>
                      <input 
                        type="text" 
                        required
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-rose-500 focus:outline-none"
                      />
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">E-mail</label>
                      <div className="relative">
                         <Mail size={16} className="absolute left-3 top-2.5 text-slate-400" />
                         <input 
                           type="email" 
                           required
                           value={newUserEmail}
                           onChange={e => setNewUserEmail(e.target.value)}
                           className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-rose-500 focus:outline-none"
                           placeholder="colaborador@airfinance.com"
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Senha Provisória</label>
                      <div className="relative">
                         <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" />
                         <input 
                           type="password" 
                           required
                           minLength={6}
                           value={newUserPass}
                           onChange={e => setNewUserPass(e.target.value)}
                           className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-sm focus:border-rose-500 focus:outline-none"
                           placeholder="Mínimo 6 caracteres"
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Perfil de Acesso</label>
                      <div className="flex gap-4 mt-2">
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="role" 
                              checked={newUserRole === 'user'} 
                              onChange={() => setNewUserRole('user')}
                              className="accent-rose-600"
                            />
                            <span className="text-sm text-slate-700">Usuário Padrão</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="role" 
                              checked={newUserRole === 'admin'} 
                              onChange={() => setNewUserRole('admin')}
                              className="accent-rose-600"
                            />
                            <span className="text-sm text-slate-700 font-bold">Administrador</span>
                         </label>
                      </div>
                   </div>

                   <div className="pt-4 flex gap-3">
                      <button 
                        type="button" 
                        onClick={() => setShowAddModal(false)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-bold text-sm rounded-sm hover:bg-slate-50 transition-colors"
                      >
                         Cancelar
                      </button>
                      <button 
                        type="submit" 
                        disabled={creating}
                        className="flex-1 px-4 py-2 bg-rose-700 text-white font-bold text-sm rounded-sm hover:bg-rose-800 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                      >
                         {creating && <Loader2 size={16} className="animate-spin" />}
                         Criar Usuário
                      </button>
                   </div>
                </form>
             </div>
          </div>
       )}
    </div>
  );
};

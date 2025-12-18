import { useState, useEffect } from 'react';
import { adminService, User, Clinic } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';

export default function UserManagement() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<User> & { password?: string; clinicIds?: string[] }>({});
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersData, clinicsData] = await Promise.all([
                adminService.getUsers(),
                adminService.getClinics()
            ]);
            setUsers(usersData);
            setClinics(clinicsData);
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && formData.id) {
                await adminService.updateUser(formData.id, formData);
            } else {
                const dataToSave = {
                    ...formData,
                    tenantId: formData.tenantId || currentUser?.tenantId
                };
                await adminService.createUser(dataToSave);
            }
            loadData();
            setIsModalOpen(false);
            setFormData({});
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save user', error);
        }
    };

    const handleEdit = (user: User) => {
        setFormData({
            ...user,
            clinicIds: user.clinics?.map(c => c.id) || []
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
        try {
            await adminService.deleteUser(id);
            loadData();
        } catch (error) {
            console.error('Failed to delete user', error);
        }
    };

    const toggleClinic = (clinicId: string) => {
        const current = formData.clinicIds || [];
        if (current.includes(clinicId)) {
            setFormData({ ...formData, clinicIds: current.filter(id => id !== clinicId) });
        } else {
            setFormData({ ...formData, clinicIds: [...current, clinicId] });
        }
    };

    if (isLoading) return <div className="p-8 text-white">Carregando...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Gerenciar Usuários
                </h1>
                <button
                    onClick={() => {
                        setFormData({ clinicIds: [] });
                        setIsEditing(false);
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition"
                >
                    Novo Usuário
                </button>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Nome</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Clínicas</th>
                            <th className="px-6 py-4">Admin?</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-700/30 transition">
                                <td className="px-6 py-4 font-medium text-white">{user.name}</td>
                                <td className="px-6 py-4">{user.email}</td>
                                <td className="px-6 py-4">
                                    {user.clinics?.length ? (
                                        <div className="flex flex-wrap gap-1">
                                            {user.clinics.map(c => (
                                                <span key={c.id} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                                                    {c.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-slate-500 text-xs">Nenhuma</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {user.isSuperAdmin ? (
                                        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">Sim</span>
                                    ) : (
                                        <span className="text-slate-500 text-xs">Não</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleEdit(user)} className="text-blue-400 hover:text-blue-300 transition">
                                        Editar
                                    </button>
                                    <button onClick={() => handleDelete(user.id)} className="text-red-400 hover:text-red-300 transition">
                                        Excluir
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    required
                                />
                            </div>
                            {!isEditing && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Senha</label>
                                    <input
                                        type="password"
                                        value={formData.password || ''}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    />
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isSuperAdmin"
                                    checked={formData.isSuperAdmin || false}
                                    onChange={(e) => setFormData({ ...formData, isSuperAdmin: e.target.checked })}
                                    className="rounded bg-slate-800 border-slate-700"
                                />
                                <label htmlFor="isSuperAdmin" className="text-sm text-slate-400">Super Admin?</label>
                            </div>

                            {/* Clinic Assignment */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Clínicas Permitidas</label>
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                                    {clinics.length === 0 ? (
                                        <p className="text-slate-500 text-sm">Nenhuma clínica disponível</p>
                                    ) : (
                                        clinics.map(clinic => (
                                            <label key={clinic.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 rounded p-1">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.clinicIds?.includes(clinic.id) || false}
                                                    onChange={() => toggleClinic(clinic.id)}
                                                    className="rounded bg-slate-700 border-slate-600"
                                                />
                                                <span className="text-sm text-slate-300">{clinic.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Super Admins têm acesso a todas as clínicas automaticamente.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition font-medium"
                                >
                                    {isEditing ? 'Salvar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

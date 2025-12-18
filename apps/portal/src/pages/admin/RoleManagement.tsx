import { useState, useEffect } from 'react';
import { adminService, Role, Permission } from '../../services/adminService';

export default function RoleManagement() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Role> & { permissionIds: string[] }>({ permissionIds: [] });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [rolesData, permissionsData] = await Promise.all([
                adminService.getRoles(),
                adminService.getPermissions()
            ]);
            setRoles(rolesData);
            setPermissions(permissionsData);
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
                await adminService.updateRole(formData.id, formData);
            } else {
                await adminService.createRole(formData as any);
            }
            loadData();
            setIsModalOpen(false);
            setFormData({ permissionIds: [] });
            setIsEditing(false);
        } catch (error: any) {
            console.error('Failed to save role', error);
            alert(error.message || 'Erro ao salvar o perfil');
        }
    };

    const handleEdit = (role: Role) => {
        setFormData({
            ...role,
            permissionIds: role.permissions.map(p => p.id)
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await adminService.deleteRole(id);
            loadData();
        } catch (error) {
            console.error('Failed to delete role', error);
        }
    };

    const togglePermission = (permissionId: string) => {
        setFormData(prev => {
            const ids = prev.permissionIds || [];
            if (ids.includes(permissionId)) {
                return { ...prev, permissionIds: ids.filter(id => id !== permissionId) };
            } else {
                return { ...prev, permissionIds: [...ids, permissionId] };
            }
        });
    };

    if (isLoading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Gerenciar Perfis e Permissões
                </h1>
                <button
                    onClick={() => {
                        setFormData({ permissionIds: [] });
                        setIsEditing(false);
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition"
                >
                    Novo Perfil
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((role) => (
                    <div key={role.id} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-6 shadow-xl hover:bg-slate-800/70 transition">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-white">{role.name}</h3>
                                <p className="text-slate-400 text-sm mt-1">{role.description || 'Sem descrição'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(role)} className="text-blue-400 hover:text-blue-300 text-sm">Editar</button>
                                <button onClick={() => handleDelete(role.id)} className="text-red-400 hover:text-red-300 text-sm">Excluir</button>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Permissões</h4>
                            <div className="flex flex-wrap gap-2">
                                {role.permissions.length > 0 ? role.permissions.map(p => (
                                    <span key={p.id} className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600">
                                        {p.resource}:{p.action}
                                    </span>
                                )) : <span className="text-slate-600 text-xs italic">Nenhuma permissão</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {isEditing ? 'Editar Perfil' : 'Novo Perfil'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Nome do Perfil</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
                                <input
                                    type="text"
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-700">
                                <label className="block text-sm font-medium text-slate-400 mb-3">Permissões de Acesso</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {Object.entries(
                                        permissions.reduce((acc, p) => {
                                            const appName = p.application?.displayName || 'Sistema / Geral';
                                            if (!acc[appName]) acc[appName] = [];
                                            acc[appName].push(p);
                                            return acc;
                                        }, {} as Record<string, Permission[]>)
                                    ).map(([appName, appPermissions]) => (
                                        <div key={appName} className="col-span-full mt-4 first:mt-0">
                                            <h4 className="text-sm font-semibold text-purple-400 mb-2 border-b border-slate-700 pb-1">{appName}</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {appPermissions.map((p) => (
                                                    <label key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-800 border border-transparent hover:border-slate-700 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.permissionIds?.includes(p.id) || false}
                                                            onChange={() => togglePermission(p.id)}
                                                            className="rounded bg-slate-900 border-slate-600 text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-slate-200 font-medium">{p.resource}</span>
                                                            <span className="text-xs text-slate-500">{p.description || p.action}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {permissions.length === 0 && <p className="text-slate-500 text-sm col-span-full">Nenhuma permissão disponível no sistema.</p>}
                                </div>
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

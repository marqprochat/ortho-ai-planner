import { useState, useEffect } from 'react';
import { adminService, Role, Permission } from '../../services/adminService';
import { ArrowLeft, UserCog, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RoleManagement() {
    const navigate = useNavigate();
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
        if (!confirm('Tem certeza que deseja excluir este perfil?')) return;
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

    if (isLoading) return (
        <div className="min-h-screen bg-sidebar flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-sidebar">
            {/* Header */}
            <header className="border-b border-sidebar-border bg-sidebar-accent/50 backdrop-blur-sm">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center text-warning">
                                <UserCog className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-sidebar-foreground">Perfis e Permissões</h1>
                                <p className="text-sidebar-foreground/60 text-sm">Definir o que cada perfil pode fazer</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setFormData({ permissionIds: [] });
                            setIsEditing(false);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Perfil
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roles.map((role) => (
                        <div key={role.id} className="bg-sidebar-accent/30 backdrop-blur-xl border border-sidebar-border rounded-xl p-6 shadow-xl hover:bg-sidebar-accent/50 transition">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-sidebar-foreground">{role.name}</h3>
                                    <p className="text-sidebar-foreground/60 text-sm mt-1">{role.description || 'Sem descrição'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(role)} className="text-info hover:text-info/80 text-sm font-medium">Editar</button>
                                    <button onClick={() => handleDelete(role.id)} className="text-destructive hover:text-destructive/80 text-sm font-medium">Excluir</button>
                                </div>
                            </div>
                            <div className="mt-4">
                                <h4 className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">Permissões</h4>
                                <div className="flex flex-wrap gap-2">
                                    {role.permissions.length > 0 ? role.permissions.map(p => (
                                        <span key={p.id} className="px-2 py-1 bg-sidebar-accent text-sidebar-foreground/80 text-xs rounded border border-sidebar-border">
                                            {p.resource}:{p.action}
                                        </span>
                                    )) : <span className="text-sidebar-foreground/40 text-xs italic">Nenhuma permissão</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-sidebar border border-sidebar-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h2 className="text-xl font-bold text-sidebar-foreground mb-4">
                            {isEditing ? 'Editar Perfil' : 'Novo Perfil'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Nome do Perfil</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Descrição</label>
                                <input
                                    type="text"
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>

                            <div className="pt-4 border-t border-sidebar-border">
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-3">Permissões de Acesso</label>
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
                                            <h4 className="text-sm font-semibold text-primary mb-2 border-b border-sidebar-border pb-1">{appName}</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {appPermissions.map((p) => (
                                                    <label key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-sidebar-accent border border-transparent hover:border-sidebar-border cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.permissionIds?.includes(p.id) || false}
                                                            onChange={() => togglePermission(p.id)}
                                                            className="rounded bg-sidebar border-sidebar-border text-primary focus:ring-primary"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-sidebar-foreground font-medium">{p.resource}</span>
                                                            <span className="text-xs text-sidebar-foreground/40">{p.description || p.action}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {permissions.length === 0 && <p className="text-sidebar-foreground/40 text-sm col-span-full">Nenhuma permissão disponível no sistema.</p>}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sidebar-foreground/60 hover:text-sidebar-foreground transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition font-medium"
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

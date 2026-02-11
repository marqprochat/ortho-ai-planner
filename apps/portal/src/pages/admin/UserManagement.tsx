import { useState, useEffect } from 'react';
import { adminService, User, Clinic } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Users, Plus, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserManagement() {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<User> & { password?: string; clinicIds?: string[]; roleId?: string; nickname?: string; cro?: string; canTransferPatient?: boolean }>({});
    const [showPassword, setShowPassword] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersData, clinicsData, rolesData] = await Promise.all([
                adminService.getUsers(),
                adminService.getClinics(),
                adminService.getRoles()
            ]);
            setUsers(usersData);
            setClinics(clinicsData);
            setRoles(rolesData);
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
        setShowPassword(false);
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
                            <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center text-info">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-sidebar-foreground">Gerenciar Usuários</h1>
                                <p className="text-sidebar-foreground/60 text-sm">Contas de acesso e permissões</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setFormData({ clinicIds: [] });
                            setIsEditing(false);
                            setShowPassword(false);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Usuário
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-6 py-8">
                <div className="bg-sidebar-accent/30 backdrop-blur-xl rounded-xl border border-sidebar-border overflow-hidden shadow-xl">
                    <table className="w-full text-left text-sidebar-foreground/80">
                        <thead className="bg-sidebar-accent/50 text-sidebar-foreground/60 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Clínicas</th>
                                <th className="px-6 py-4">Perfil</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sidebar-border/50">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-sidebar-accent/30 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-sidebar-foreground">{user.name}</div>
                                        {user.nickname && (
                                            <div className="text-xs text-sidebar-foreground/60">{user.nickname}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">{user.email}</td>
                                    <td className="px-6 py-4">
                                        {user.clinics?.length ? (
                                            <div className="flex flex-wrap gap-1">
                                                {user.clinics.map(c => (
                                                    <span key={c.id} className="px-2 py-0.5 bg-info/20 text-info rounded text-xs">
                                                        {c.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-sidebar-foreground/40 text-xs">Nenhuma</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {roles.find(r => r.id === user.roleId)?.name || (
                                            user.isSuperAdmin ? (
                                                <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs border border-primary/30">Super Admin</span>
                                            ) : (
                                                <span className="text-sidebar-foreground/40 text-xs italic">Sem perfil</span>
                                            )
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => handleEdit(user)} className="text-info hover:text-info/80 transition font-medium">
                                            Editar
                                        </button>
                                        <button onClick={() => handleDelete(user.id)} className="text-destructive hover:text-destructive/80 transition font-medium">
                                            Excluir
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-sidebar border border-sidebar-border rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-sidebar-foreground mb-4">
                            {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Apelido (Opcional)</label>
                                <input
                                    type="text"
                                    value={formData.nickname || ''}
                                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Como o usuário será chamado no sistema"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">CRO (Opcional)</label>
                                <input
                                    type="text"
                                    value={formData.cro || ''}
                                    onChange={(e) => setFormData({ ...formData, cro: e.target.value })}
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Registro no Conselho Regional de Odontologia"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">
                                    {isEditing ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password || ''}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none pr-10"
                                        required={!isEditing}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground transition"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isSuperAdmin"
                                    checked={formData.isSuperAdmin || false}
                                    onChange={(e) => setFormData({ ...formData, isSuperAdmin: e.target.checked })}
                                    className="rounded bg-sidebar-accent border-sidebar-border text-primary focus:ring-primary"
                                />
                                <label htmlFor="isSuperAdmin" className="text-sm text-sidebar-foreground/60">Super Admin?</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="canTransferPatient"
                                    checked={formData.canTransferPatient || false}
                                    onChange={(e) => setFormData({ ...formData, canTransferPatient: e.target.checked })}
                                    className="rounded bg-sidebar-accent border-sidebar-border text-primary focus:ring-primary"
                                />
                                <label htmlFor="canTransferPatient" className="text-sm text-sidebar-foreground/60">Pode transferir pacientes?</label>
                            </div>

                            {!formData.isSuperAdmin && (
                                <div>
                                    <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Perfil (Apenas para o Planner)</label>
                                    <select
                                        value={formData.roleId || ''}
                                        onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                                        className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="">Sem perfil atribuído</option>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-sidebar-foreground/40 mt-1">
                                        Isso define as permissões que este usuário terá no aplicativo de planejamento.
                                    </p>
                                </div>
                            )}

                            {/* Clinic Assignment */}
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-2">Clínicas Permitidas</label>
                                <div className="bg-sidebar-accent border border-sidebar-border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                                    {clinics.length === 0 ? (
                                        <p className="text-sidebar-foreground/40 text-sm">Nenhuma clínica disponível</p>
                                    ) : (
                                        clinics.map(clinic => (
                                            <label key={clinic.id} className="flex items-center gap-2 cursor-pointer hover:bg-sidebar/50 rounded p-1">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.clinicIds?.includes(clinic.id) || false}
                                                    onChange={() => toggleClinic(clinic.id)}
                                                    className="rounded bg-sidebar border-sidebar-border text-primary focus:ring-primary"
                                                />
                                                <span className="text-sm text-sidebar-foreground/80">{clinic.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-sidebar-foreground/40 mt-1">
                                    Super Admins têm acesso a todas as clínicas automaticamente.
                                </p>
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

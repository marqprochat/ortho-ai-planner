import { useState, useEffect } from 'react';
import { adminService, Clinic } from '../../services/adminService';
import { ArrowLeft, Building2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ClinicManagement() {
    const navigate = useNavigate();
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Clinic>>({});
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadClinics();
    }, []);

    const loadClinics = async () => {
        try {
            const data = await adminService.getClinics();
            setClinics(data);
        } catch (error) {
            console.error('Failed to load clinics', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && formData.id) {
                await adminService.updateClinic(formData.id, formData);
            } else {
                await adminService.createClinic(formData);
            }
            loadClinics();
            setIsModalOpen(false);
            setFormData({});
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save clinic', error);
        }
    };

    const handleEdit = (clinic: Clinic) => {
        setFormData(clinic);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta clínica?')) return;
        try {
            await adminService.deleteClinic(id);
            loadClinics();
        } catch (error) {
            console.error('Failed to delete clinic', error);
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
                            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center text-success">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-sidebar-foreground">Gerenciar Clínicas</h1>
                                <p className="text-sidebar-foreground/60 text-sm">Criar e editar clínicas do sistema</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setFormData({});
                            setIsEditing(false);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Clínica
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
                                <th className="px-6 py-4">Endereço</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sidebar-border/50">
                            {clinics.map((clinic) => (
                                <tr key={clinic.id} className="hover:bg-sidebar-accent/30 transition">
                                    <td className="px-6 py-4 font-medium text-sidebar-foreground">{clinic.name}</td>
                                    <td className="px-6 py-4">{clinic.address || '-'}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => handleEdit(clinic)}
                                            className="text-info hover:text-info/80 transition font-medium"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(clinic.id)}
                                            className="text-destructive hover:text-destructive/80 transition font-medium"
                                        >
                                            Excluir
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {clinics.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-sidebar-foreground/40">
                                        Nenhuma clínica encontrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-sidebar border border-sidebar-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-sidebar-foreground mb-4">
                            {isEditing ? 'Editar Clínica' : 'Nova Clínica'}
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
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Endereço</label>
                                <input
                                    type="text"
                                    value={formData.address || ''}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-2 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
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
                                    {isEditing ? 'Salvar Alterações' : 'Criar Clínica'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

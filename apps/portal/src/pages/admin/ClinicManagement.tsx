import { useState, useEffect } from 'react';
import { adminService, Clinic } from '../../services/adminService';

export default function ClinicManagement() {
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
        if (!confirm('Are you sure you want to delete this clinic?')) return;
        try {
            await adminService.deleteClinic(id);
            loadClinics();
        } catch (error) {
            console.error('Failed to delete clinic', error);
        }
    };

    if (isLoading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Gerenciar Clínicas
                </h1>
                <button
                    onClick={() => {
                        setFormData({});
                        setIsEditing(false);
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition"
                >
                    Nova Clínica
                </button>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Nome</th>
                            <th className="px-6 py-4">Endereço</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {clinics.map((clinic) => (
                            <tr key={clinic.id} className="hover:bg-slate-700/30 transition">
                                <td className="px-6 py-4 font-medium text-white">{clinic.name}</td>
                                <td className="px-6 py-4">{clinic.address || '-'}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button
                                        onClick={() => handleEdit(clinic)}
                                        className="text-blue-400 hover:text-blue-300 transition"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(clinic.id)}
                                        className="text-red-400 hover:text-red-300 transition"
                                    >
                                        Excluir
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {clinics.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                    Nenhuma clínica encontrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {isEditing ? 'Editar Clínica' : 'Nova Clínica'}
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
                                <label className="block text-sm font-medium text-slate-400 mb-1">Endereço</label>
                                <input
                                    type="text"
                                    value={formData.address || ''}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            {/* Assuming tenantId is handled automatically or by select if super admin. 
                                For now simplistic approach: user context handles it, or explicit input if super admin. 
                                We'll leave tenantId blank for now, assuming user creation handles it or backend defaults.
                            */}
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

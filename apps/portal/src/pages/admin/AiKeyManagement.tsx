import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAiKeys, createAiKey, updateAiKey, deleteAiKey, AiApiKey } from '../../services/aiKeyService';
import { Plus, Trash2, Edit2, X, Key, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AiKeyManagement() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [keys, setKeys] = useState<AiApiKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form states
    const [newProvider, setNewProvider] = useState('');
    const [newKey, setNewKey] = useState('');

    // Edit states
    const [editKey, setEditKey] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);

    useEffect(() => {
        loadKeys();
    }, []);

    const loadKeys = async () => {
        try {
            setIsLoading(true);
            const data = await getAiKeys();
            setKeys(data);
        } catch (error) {
            console.error('Failed to load keys', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createAiKey(newProvider, newKey);
            setNewProvider('');
            setNewKey('');
            setIsCreating(false);
            loadKeys();
        } catch (error) {
            console.error('Failed to create key', error);
            alert('Erro ao criar chave');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            await updateAiKey(id, editKey, editIsActive);
            setEditingId(null);
            loadKeys();
        } catch (error) {
            console.error('Failed to update key', error);
            alert('Erro ao atualizar chave');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja deletar esta chave?')) return;
        try {
            await deleteAiKey(id);
            loadKeys();
        } catch (error) {
            console.error('Failed to delete key', error);
            alert('Erro ao deletar chave');
        }
    };

    const startEdit = (key: AiApiKey) => {
        setEditingId(key.id);
        setEditKey(key.key);
        setEditIsActive(key.isActive);
    };

    if (!user?.isSuperAdmin) {
        return (
            <div className="flex h-screen bg-gray-50 items-center justify-center">
                <p className="text-red-500 text-xl font-semibold">Acesso Restrito: Apenas Super Admins</p>
            </div>
        );
    }

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
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-500">
                                <Key className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-sidebar-foreground">Gerenciar Chaves IA</h1>
                                <p className="text-sidebar-foreground/60 text-sm">Configuração de APIs de Inteligência Artificial</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Chave
                    </button>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                {/* Create Modal */}
                {isCreating && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-sidebar border border-sidebar-border rounded-xl shadow-xl p-6 w-full max-w-md">
                            <h2 className="text-xl font-bold text-sidebar-foreground mb-4">Adicionar Nova Chave</h2>
                            <form onSubmit={handleCreate}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Provedor (ex: openai)</label>
                                    <input
                                        type="text"
                                        value={newProvider}
                                        onChange={(e) => setNewProvider(e.target.value)}
                                        className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg p-2 text-sidebar-foreground outline-none focus:ring-2 focus:ring-primary"
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-sidebar-foreground/60 mb-1">Chave API</label>
                                    <input
                                        type="text"
                                        value={newKey}
                                        onChange={(e) => setNewKey(e.target.value)}
                                        className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg p-2 text-sidebar-foreground outline-none focus:ring-2 focus:ring-primary"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="px-4 py-2 text-sidebar-foreground/60 hover:text-sidebar-foreground transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className="bg-sidebar-accent/30 backdrop-blur-xl rounded-xl border border-sidebar-border overflow-hidden shadow-xl">
                    {isLoading ? (
                        <div className="p-8 text-center text-sidebar-foreground/60">Carregando...</div>
                    ) : (
                        <div className="divide-y divide-sidebar-border/50">
                            {keys.map((key) => (
                                <div key={key.id} className="p-6 hover:bg-sidebar-accent/30 transition">
                                    {editingId === key.id ? (
                                        <div className="flex flex-col gap-4">
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-lg text-sidebar-foreground">{key.provider}</span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleUpdate(key.id)}
                                                        className="text-green-500 hover:text-green-600 p-1"
                                                        title="Salvar"
                                                    >
                                                        <Save size={20} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="text-sidebar-foreground/40 hover:text-sidebar-foreground/60 p-1"
                                                        title="Cancelar"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs text-sidebar-foreground/60 mb-1">Chave</label>
                                                    <input
                                                        type="text"
                                                        value={editKey}
                                                        onChange={(e) => setEditKey(e.target.value)}
                                                        className="w-full bg-sidebar-accent border border-sidebar-border rounded p-2 text-sidebar-foreground outline-none focus:ring-2 focus:ring-primary"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={editIsActive}
                                                        onChange={(e) => setEditIsActive(e.target.checked)}
                                                        id={`active - ${key.id} `}
                                                        className="rounded bg-sidebar border-sidebar-border text-primary focus:ring-primary"
                                                    />
                                                    <label htmlFor={`active - ${key.id} `} className="text-sm text-sidebar-foreground cursor-pointer">Ativo</label>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-medium text-primary">{key.provider}</h3>
                                                    <span className={`px - 2 py - 0.5 inline - flex text - xs leading - 5 font - semibold rounded - full ${key.isActive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'} `}>
                                                        {key.isActive ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-sidebar-foreground/60 mt-1 font-mono">
                                                    {key.key.substring(0, 8)}...{key.key.substring(key.key.length - 4)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => startEdit(key)}
                                                    className="text-indigo-400 hover:text-indigo-300 transition"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(key.id)}
                                                    className="text-red-400 hover:text-red-300 transition"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {keys.length === 0 && (
                                <div className="p-8 text-center text-sidebar-foreground/40">
                                    Nenhuma chave cadastrada.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}



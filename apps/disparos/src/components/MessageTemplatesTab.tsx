import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Plus, Pencil, Trash2, Copy, Check, MessageSquare, Megaphone,
    Loader2, HelpCircle, Settings2
} from 'lucide-react';
import { api } from '../services/api';
import type { MessageTemplate } from '../types';

export default function MessageTemplatesTab() {
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<MessageTemplate | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    
    // Form states
    const [name, setName] = useState('');
    const [category, setCategory] = useState<'utilidade' | 'marketing'>('utilidade');
    const [code, setCode] = useState('');
    const [dayOffset, setDayOffset] = useState(0);
    const [statusKeyword, setStatusKeyword] = useState('');

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await api.listMessageTemplates();
            setTemplates(data);
        } catch (err: any) {
            toast.error('Erro ao carregar modelos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success('Código copiado!');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const openCreateModal = () => {
        setEditTarget(null);
        setName('');
        setCategory('utilidade');
        setCode('');
        setDayOffset(0);
        setStatusKeyword('');
        setIsModalOpen(true);
    };

    const openEditModal = (tpl: MessageTemplate) => {
        setEditTarget(tpl);
        setName(tpl.name);
        setCategory(tpl.category);
        setCode(tpl.code);
        setDayOffset(tpl.dayOffset);
        setStatusKeyword(tpl.statusKeyword);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !code) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name,
                category,
                code,
                dayOffset,
                statusKeyword
            };

            if (editTarget) {
                await api.updateMessageTemplate(editTarget.id, payload);
                toast.success('Modelo atualizado com sucesso!');
            } else {
                await api.createMessageTemplate(payload);
                toast.success('Modelo criado com sucesso!');
            }
            setIsModalOpen(false);
            fetchTemplates();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao salvar modelo');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir o modelo "${name}"?`)) return;

        try {
            await api.deleteMessageTemplate(id);
            toast.success('Modelo excluído com sucesso!');
            fetchTemplates();
        } catch (err: any) {
            toast.error('Erro ao excluir: ' + err.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header section with gradient */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white shadow-xl shadow-teal-900/10">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-white/5 blur-xl" />
                
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 z-10">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-extrabold tracking-tight">Gerenciamento de Modelos</h2>
                        <p className="text-emerald-100/90 text-sm max-w-xl">
                            Configure e cadastre os modelos de mensagens disparados pelo BotConversa. 
                            Classifique por tipo e associe filtros padrão de status e deslocamento de datas.
                        </p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="self-start md:self-center inline-flex items-center gap-2 bg-white text-teal-800 px-5 py-2.5 rounded-xl font-semibold shadow hover:bg-emerald-50 active:scale-95 transition-all text-sm shrink-0"
                    >
                        <Plus className="w-4 h-4 text-emerald-600 stroke-[3]" />
                        Adicionar Modelo
                    </button>
                </div>
            </div>

            {/* List View */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">Carregando modelos de mensagens...</span>
                </div>
            ) : templates.length === 0 ? (
                <div className="glass-card py-20 text-center flex flex-col items-center justify-center gap-4">
                    <div className="p-4 bg-muted rounded-full">
                        <MessageSquare className="w-10 h-10 text-muted-foreground/60" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-semibold text-foreground">Nenhum modelo cadastrado</p>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                            Cadastre seu primeiro modelo para iniciar os disparos manuais e automáticos.
                        </p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="mt-2 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium shadow hover:opacity-90 transition-all text-xs"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Cadastrar Agora
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {templates.map(tpl => {
                        const isUtil = tpl.category === 'utilidade';
                        return (
                            <div
                                key={tpl.id}
                                className="glass-card group relative p-6 hover:shadow-lg hover:border-emerald-200/50 transition-all flex flex-col justify-between"
                            >
                                <div className="space-y-4">
                                    {/* Card Header: Category & Actions */}
                                    <div className="flex items-start justify-between">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            isUtil
                                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                                        }`}>
                                            {isUtil ? (
                                                <>
                                                    <MessageSquare className="w-3 h-3 text-blue-600" />
                                                    Utilidade
                                                </>
                                            ) : (
                                                <>
                                                    <Megaphone className="w-3 h-3 text-amber-600" />
                                                    Marketing
                                                </>
                                            )}
                                        </span>

                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <button
                                                onClick={() => openEditModal(tpl)}
                                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                title="Editar modelo"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(tpl.id, tpl.name)}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                                                title="Excluir modelo"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Info */}
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-foreground text-lg truncate group-hover:text-primary transition-colors">
                                            {tpl.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-muted-foreground">Código de Saída:</span>
                                            <div className="flex items-center gap-1.5 bg-muted/60 px-2 py-1 rounded-md border border-border/80 font-mono text-xs font-bold text-foreground select-all">
                                                {tpl.code}
                                                <button
                                                    onClick={() => handleCopy(tpl.id, tpl.code)}
                                                    className="hover:text-primary p-0.5 rounded transition-colors"
                                                    title="Copiar código"
                                                >
                                                    {copiedId === tpl.id ? (
                                                        <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Advanced Rules section inside card */}
                                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/10 -mx-6 -mb-6 px-6 py-3 rounded-b-xl">
                                    <span className="flex items-center gap-1">
                                        <Settings2 className="w-3.5 h-3.5 opacity-70" />
                                        Filtro:
                                    </span>
                                    <div className="flex items-center gap-2 font-medium text-foreground">
                                        <span>
                                            {tpl.dayOffset === 0 
                                                ? 'Hoje' 
                                                : tpl.dayOffset > 0 
                                                    ? `+${tpl.dayOffset}d` 
                                                    : `${tpl.dayOffset}d`
                                            }
                                        </span>
                                        {tpl.statusKeyword && (
                                            <>
                                                <span className="text-muted-foreground/50">•</span>
                                                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/15 text-[10px] uppercase font-bold">
                                                    {tpl.statusKeyword}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Creation/Edition Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl relative border border-border/50">
                        <div className="flex items-center justify-between pb-4 border-b border-border">
                            <h3 className="font-bold text-foreground text-lg">
                                {editTarget ? 'Editar Modelo' : 'Cadastrar Novo Modelo'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Plus className="w-5 h-5 rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                            {/* Nome */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground">Nome do Modelo *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Confirmação de Avaliação"
                                    className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                />
                            </div>

                            {/* Categoria */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground">Categoria *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCategory('utilidade')}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${
                                            category === 'utilidade'
                                                ? 'border-blue-500 bg-blue-50/40 text-blue-700 font-semibold ring-2 ring-blue-500/20'
                                                : 'border-border bg-background hover:bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        <MessageSquare className={`w-5 h-5 ${category === 'utilidade' ? 'text-blue-600' : ''}`} />
                                        <span className="text-xs">Utilidade</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategory('marketing')}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${
                                            category === 'marketing'
                                                ? 'border-amber-500 bg-amber-50/40 text-amber-700 font-semibold ring-2 ring-amber-500/20'
                                                : 'border-border bg-background hover:bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        <Megaphone className={`w-5 h-5 ${category === 'marketing' ? 'text-amber-600' : ''}`} />
                                        <span className="text-xs">Marketing</span>
                                    </button>
                                </div>
                            </div>

                            {/* Código de Saída */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground">Código de Saída (BotConversa) *</label>
                                <input
                                    type="text"
                                    required
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    placeholder="Ex: 22180"
                                    className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono"
                                />
                            </div>

                            {/* Advanced configurations */}
                            <div className="border-t border-border pt-4 mt-2 space-y-3">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Settings2 className="w-3.5 h-3.5" />
                                    Automação de Filtros (Opcional)
                                </p>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Day Offset */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                            Deslocamento de Dias
                                            <span className="group relative">
                                                <HelpCircle className="w-3 h-3 cursor-pointer opacity-70" />
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity leading-tight z-50">
                                                    Dias relativos a hoje. Ex: 1 para amanhã, -1 para ontem, 0 para hoje.
                                                </span>
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            value={dayOffset}
                                            onChange={e => setDayOffset(parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Keyword Status */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                            Filtro de Status (Chave)
                                            <span className="group relative">
                                                <HelpCircle className="w-3 h-3 cursor-pointer opacity-70" />
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity leading-tight z-50">
                                                    Busca por status que contenham esse texto. Ex: "agenda" seleciona Agendado, "atend" seleciona Atendido.
                                                </span>
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            value={statusKeyword}
                                            onChange={e => setStatusKeyword(e.target.value)}
                                            placeholder="Ex: agenda"
                                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-primary/10 disabled:opacity-50"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Salvar Modelo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

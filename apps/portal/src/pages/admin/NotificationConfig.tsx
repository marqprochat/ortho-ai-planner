import { useState, useEffect } from "react";
import { getCookie } from "../../lib/cookieUtils";
import { ArrowLeft, Bell, Megaphone, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Clinic {
    id: string;
    name: string;
}

interface AutomationConfig {
    type: string;
    isActive: boolean;
    daysConfig: number;
    clinicIds: string[];
}

export default function NotificationConfig() {
    const navigate = useNavigate();
    const [clinics, setClinics] = useState<Clinic[]>([]);
    
    const [broadcastTitle, setBroadcastTitle] = useState("");
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [selectedClinics, setSelectedClinics] = useState<string[]>([]);
    
    const [configs, setConfigs] = useState<Record<string, AutomationConfig>>({});

    const API_URL = import.meta.env.VITE_API_URL || "/api";

    useEffect(() => {
        fetchClinics();
        fetchConfigs();
    }, []);

    const getHeaders = () => {
        const token = getCookie('token');
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };
    };

    const fetchClinics = async () => {
        try {
            const res = await fetch(`${API_URL}/clinics`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setClinics(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchConfigs = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/notifications/config`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                const map: Record<string, AutomationConfig> = {};
                data.forEach((c: AutomationConfig) => {
                    map[c.type] = c;
                });
                setConfigs(map);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastTitle || !broadcastMessage) {
            toast.error("Preencha título e mensagem");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/admin/notifications/broadcast`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    title: broadcastTitle,
                    message: broadcastMessage,
                    clinicIds: selectedClinics.length > 0 ? selectedClinics : []
                })
            });

            if (res.ok) {
                toast.success("Notificação enviada com sucesso!");
                setBroadcastTitle("");
                setBroadcastMessage("");
                setSelectedClinics([]);
            } else {
                toast.error("Erro ao enviar a notificação");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro interno ao enviar");
        }
    };

    const saveConfig = async (type: string, data: Partial<AutomationConfig>) => {
        const current = configs[type] || { isActive: true, daysConfig: 0, clinicIds: [] };
        const updated = { ...current, ...data };
        
        try {
            const res = await fetch(`${API_URL}/admin/notifications/config/${type}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(updated)
            });

            if (res.ok) {
                toast.success("Configuração salva com sucesso!");
                setConfigs({ ...configs, [type]: updated });
            } else {
                toast.error("Erro ao salvar configuração");
            }
        } catch (error) {
            toast.error("Erro de conexão");
        }
    };

    const renderAutomationRow = (type: string, title: string, desc: string, defaultDays: number) => {
        const config = configs[type] || { isActive: true, daysConfig: defaultDays, clinicIds: [] };
        
        return (
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between p-6 border-b border-sidebar-border last:border-0 hover:bg-sidebar-accent/20 transition">
                <div className="flex-1">
                    <h4 className="font-medium text-sidebar-foreground flex items-center gap-2 mb-1">
                        <Settings className="w-4 h-4 opacity-70" /> {title}
                    </h4>
                    <p className="text-sm text-sidebar-foreground/60">{desc}</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">Dias Ref.</label>
                        <input 
                            type="number" 
                            className="w-24 px-3 py-2 bg-sidebar-accent border border-sidebar-border rounded-lg text-sm text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                            value={config.daysConfig}
                            onChange={(e) => saveConfig(type, { daysConfig: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">Status</label>
                        <select 
                            className="bg-sidebar-accent border border-sidebar-border rounded-lg px-3 py-2 text-sm text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                            value={config.isActive ? "1" : "0"}
                            onChange={(e) => saveConfig(type, { isActive: e.target.value === "1" })}
                        >
                            <option value="1">Ativo</option>
                            <option value="0">Desativado</option>
                        </select>
                    </div>
                </div>
            </div>
        );
    };

    const toggleClinicSelection = (clinicId: string) => {
        if (selectedClinics.includes(clinicId)) {
            setSelectedClinics(selectedClinics.filter(id => id !== clinicId));
        } else {
            setSelectedClinics([...selectedClinics, clinicId]);
        }
    };

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
                            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-sidebar-foreground">Notificações e Automações</h1>
                                <p className="text-sidebar-foreground/60 text-sm">Avisos globais e regras de disparo</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    
                    {/* Left Column - Broadcast */}
                    <div className="bg-sidebar-accent/30 backdrop-blur-xl rounded-xl border border-sidebar-border shadow-xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-sidebar-border/50 bg-sidebar-accent/20">
                            <h2 className="text-lg font-bold text-sidebar-foreground flex items-center gap-2">
                                <Megaphone className="w-5 h-5 text-primary" />
                                Comunicado Global
                            </h2>
                            <p className="text-sidebar-foreground/60 text-sm mt-1">
                                Envie notificações em massa para usuários do sistema.
                            </p>
                        </div>
                        <form onSubmit={handleBroadcast} className="p-6 space-y-6 flex-1">
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-2">Título do Aviso</label>
                                <input 
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-3 text-sidebar-foreground focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Ex: Nova atualização do sistema"
                                    value={broadcastTitle}
                                    onChange={(e) => setBroadcastTitle(e.target.value)}
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-2">Mensagem (Corpo)</label>
                                <textarea 
                                    className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-4 py-3 text-sidebar-foreground h-32 resize-none focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Descreva o comunicado detalhadamente..."
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-sidebar-foreground/60 mb-2">Público-Alvo (Clínicas)</label>
                                <div className="bg-sidebar-accent/50 border border-sidebar-border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                                    {clinics.length === 0 ? (
                                        <p className="text-sidebar-foreground/40 text-sm p-2">Nenhuma clínica disponível</p>
                                    ) : (
                                        clinics.map(clinic => (
                                            <label key={clinic.id} className="flex items-center gap-3 cursor-pointer hover:bg-sidebar-accent p-2 rounded-md transition">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedClinics.includes(clinic.id)}
                                                    onChange={() => toggleClinicSelection(clinic.id)}
                                                    className="w-4 h-4 rounded bg-sidebar border-sidebar-border text-primary focus:ring-primary"
                                                />
                                                <span className="text-sm text-sidebar-foreground/80">{clinic.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-sidebar-foreground/40 mt-2">
                                    Se nenhuma clínica for selecionada, o envio será feito para <strong>TODAS as clínicas do seu tenant</strong>.
                                </p>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button type="submit" className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition font-medium">
                                    <Megaphone className="w-4 h-4" /> 
                                    Disparar Notificação
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right Column - Automations */}
                    <div className="bg-sidebar-accent/30 backdrop-blur-xl rounded-xl border border-sidebar-border shadow-xl overflow-hidden flex flex-col h-fit">
                        <div className="p-6 border-b border-sidebar-border/50 bg-sidebar-accent/20">
                            <h2 className="text-lg font-bold text-sidebar-foreground flex items-center gap-2">
                                <Settings className="w-5 h-5 text-info" />
                                Regras de Automação
                            </h2>
                            <p className="text-sidebar-foreground/60 text-sm mt-1">
                                Defina quando o sistema criará avisos automaticamente para as telas dos usuários.
                            </p>
                        </div>
                        <div className="flex flex-col">
                            {renderAutomationRow(
                                "PAST_DUE_APPOINTMENT",
                                "Consulta Atrasada",
                                "Notifica a recepção quando a data estipulada da próxima consulta de um tratamento em andamento já passou e ainda não foi remarcada.",
                                0
                            )}
                            {renderAutomationRow(
                                "UPCOMING_APPOINTMENT",
                                "Aviso de Retorno Próximo",
                                "Notifica na véspera da próxima consulta (ou quantos dias desejar) para que a recepção contate o paciente se necessário.",
                                1
                            )}
                            {renderAutomationRow(
                                "TREATMENT_END_APPROACHING",
                                "Encerramento do Convênio Aproximando",
                                "Alerta X dias antes do vencimento do prazo do tratamento para renovar contrato ou efetuar alta.",
                                20
                            )}
                        </div>
                        
                        <div className="p-6 bg-info/5 border-t border-info/20 mt-auto">
                            <p className="text-xs text-sidebar-foreground/60 flex items-start gap-2">
                                <span className="text-info text-base leading-none">ℹ</span> 
                                As configurações de dias referem-se à data definida nos Tratamentos ativos dos pacientes. Disparos ocorrem automaticamente todos os dias de madrugada pelo Cron Job do servidor.
                            </p>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}

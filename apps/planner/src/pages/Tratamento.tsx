import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Activity, Calendar, Clock, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import { patientService, Treatment } from "@/services/patientService";

const statusLabels: Record<string, string> = {
    EM_ANDAMENTO: "Em Andamento",
    CONCLUIDO: "Concluído",
    CANCELADO: "Cancelado",
};

const statusColors: Record<string, string> = {
    EM_ANDAMENTO: "bg-blue-500",
    CONCLUIDO: "bg-emerald-500",
    CANCELADO: "bg-red-500",
};

const Tratamento = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { planningId, patientName, patientId } = (location.state || {}) as {
        planningId?: string;
        patientName?: string;
        patientId?: string;
    };

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [existingTreatment, setExistingTreatment] = useState<Treatment | null>(null);

    // Form fields
    const [startDate, setStartDate] = useState("");
    const [deadline, setDeadline] = useState("");
    const [endDate, setEndDate] = useState("");
    const [lastAppointment, setLastAppointment] = useState("");
    const [status, setStatus] = useState("EM_ANDAMENTO");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (!planningId) {
            toast.error("Planejamento não encontrado");
            navigate(-1);
            return;
        }
        loadTreatment();
    }, [planningId]);

    const formatDateForInput = (dateString?: string) => {
        if (!dateString) return "";
        return new Date(dateString).toISOString().split("T")[0];
    };

    const loadTreatment = async () => {
        try {
            setIsLoading(true);
            const treatment = await patientService.getTreatment(planningId!);
            setExistingTreatment(treatment);
            setStartDate(formatDateForInput(treatment.startDate));
            setDeadline(formatDateForInput(treatment.deadline));
            setEndDate(formatDateForInput(treatment.endDate));
            setLastAppointment(formatDateForInput(treatment.lastAppointment));
            setStatus(treatment.status);
            setNotes(treatment.notes || "");
        } catch {
            // No treatment yet — set default startDate to today
            setStartDate(new Date().toISOString().split("T")[0]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!startDate) {
            toast.error("A data de início é obrigatória");
            return;
        }

        setIsSaving(true);
        try {
            const data = {
                startDate,
                deadline: deadline || undefined,
                endDate: endDate || undefined,
                lastAppointment: lastAppointment || undefined,
                status,
                notes: notes || undefined,
            };

            if (existingTreatment) {
                const updated = await patientService.updateTreatment(existingTreatment.id, data);
                setExistingTreatment(updated);
                toast.success("Tratamento atualizado com sucesso!");
            } else {
                const created = await patientService.createTreatment({
                    planningId: planningId!,
                    ...data,
                });
                setExistingTreatment(created);
                toast.success("Tratamento criado com sucesso!");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar tratamento");
        } finally {
            setIsSaving(false);
        }
    };

    if (!planningId) return null;

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="ml-20 p-8 transition-all duration-300">
                <div className="max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                                <Activity className="h-8 w-8 text-teal-500" />
                                Tratamento
                            </h1>
                            {patientName && (
                                <p className="text-muted-foreground">
                                    Paciente: {patientName}
                                </p>
                            )}
                        </div>
                        {existingTreatment && (
                            <Badge className={statusColors[existingTreatment.status]}>
                                {statusLabels[existingTreatment.status] || existingTreatment.status}
                            </Badge>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-teal-500" />
                                    {existingTreatment ? "Editar Tratamento" : "Iniciar Tratamento"}
                                </CardTitle>
                                <CardDescription>
                                    Preencha as informações do tratamento ortodôntico
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Status */}
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status do Tratamento</Label>
                                    <Select value={status} onValueChange={setStatus}>
                                        <SelectTrigger id="status">
                                            <SelectValue placeholder="Selecione o status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                                            <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                                            <SelectItem value="CANCELADO">Cancelado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Dates Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="startDate" className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4 text-teal-500" />
                                            Data de Início *
                                        </Label>
                                        <Input
                                            id="startDate"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="deadline" className="flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4 text-orange-500" />
                                            Prazo Final (Convênio/Estipulado)
                                        </Label>
                                        <Input
                                            id="deadline"
                                            type="date"
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="endDate" className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4 text-emerald-500" />
                                            Data de Finalização
                                        </Label>
                                        <Input
                                            id="endDate"
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="lastAppointment" className="flex items-center gap-1">
                                            <Clock className="h-4 w-4 text-blue-500" />
                                            Última Consulta / Agendamento
                                        </Label>
                                        <Input
                                            id="lastAppointment"
                                            type="date"
                                            value={lastAppointment}
                                            onChange={(e) => setLastAppointment(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Observações</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Observações sobre o tratamento..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={4}
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="outline" onClick={() => navigate(-1)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving || !startDate}
                                        className="bg-teal-600 hover:bg-teal-700"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        {existingTreatment ? "Atualizar Tratamento" : "Iniciar Tratamento"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Tratamento;

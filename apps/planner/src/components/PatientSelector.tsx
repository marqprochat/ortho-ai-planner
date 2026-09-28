import { useState, useEffect } from "react";
import { Search, User, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { patientService, Patient } from "@/services/patientService";
import { toast } from "sonner";

interface PatientSelectorProps {
    onSelect: (patient: Patient) => void;
}

export const PatientSelector = ({ onSelect }: PatientSelectorProps) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchingEasyDental, setIsSearchingEasyDental] = useState(false);

    useEffect(() => {
        loadPatients();
    }, []);

    const loadPatients = async () => {
        try {
            setIsLoading(true);
            const data = await patientService.getPatients();
            setPatients(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchEasyDental = async () => {
        const query = searchQuery.trim();
        if (!query) {
            toast.error("Digite o CPF, Celular ou Código para buscar no EasyDental");
            return;
        }

        setIsSearchingEasyDental(true);
        try {
            const clean = query.replace(/\D/g, '');
            const isCelular = clean.length === 10 || (clean.length === 11 && clean[2] === '9');
            const isCpf = clean.length === 11;
            const isCodigo = !isCpf && !isCelular;

            const result = await patientService.searchEasyDental({
                query,
                cpf: isCpf ? clean : undefined,
                celular: isCelular ? clean : undefined,
                codigo: isCodigo ? query : undefined,
            });

            if (result.found && result.easyDental) {
                toast.success(`Paciente localizado no EasyDental: ${result.easyDental.nome}`);
                // Se já estiver no Planner, seleciona ele
                if (result.plannerPatient) {
                    onSelect(result.plannerPatient);
                } else {
                    // Cria ou formata como Patient para preencher
                    const dummyPatient: Patient = {
                        id: '',
                        name: result.easyDental.nome,
                        cpf: result.easyDental.cpf,
                        phone: result.easyDental.celular,
                        birthDate: result.easyDental.dtNascimento,
                        patientNumber: result.easyDental.codigo,
                        easyDentalId: result.easyDental.id,
                        tenantId: '',
                        userId: '',
                        createdAt: '',
                        updatedAt: '',
                    };
                    onSelect(dummyPatient);
                }
            } else {
                toast.info("Nenhum paciente localizado no EasyDental com este dado.");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erro ao consultar EasyDental");
        } finally {
            setIsSearchingEasyDental(false);
        }
    };

    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.cpf?.includes(searchQuery) ||
        p.patientNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone?.includes(searchQuery)
    );

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, CPF ou código..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSearchEasyDental();
                            }
                        }}
                        className="pl-9"
                        autoFocus
                    />
                </div>
                {searchQuery.trim().length >= 2 && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSearchEasyDental}
                        disabled={isSearchingEasyDental}
                        className="text-xs shrink-0"
                    >
                        {isSearchingEasyDental ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                            <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                        )}
                        EasyDental
                    </Button>
                )}
            </div>

            <ScrollArea className="h-[300px] border rounded-md p-2">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : filteredPatients.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground space-y-3">
                        <p className="text-sm">Nenhum paciente cadastrado localmente encontrado.</p>
                        {searchQuery.replace(/\D/g, '').length >= 8 && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleSearchEasyDental}
                                disabled={isSearchingEasyDental}
                                className="text-xs"
                            >
                                <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                                Consultar no EasyDental
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredPatients.map(patient => (
                            <Button
                                key={patient.id}
                                variant="ghost"
                                className="w-full justify-start gap-2 h-auto py-2 px-3 text-left"
                                onClick={() => onSelect(patient)}
                            >
                                <User className="h-4 w-4 text-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium flex items-center justify-between gap-2">
                                        <span className="truncate">{patient.name}</span>
                                        <div className="flex gap-1 shrink-0">
                                            {patient.patientNumber && (
                                                <span className="text-xs text-muted-foreground font-normal">#{patient.patientNumber}</span>
                                            )}
                                            {patient.easyDentalId && (
                                                <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-normal">
                                                    EasyDental
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex gap-3 truncate">
                                        {patient.cpf && <span>CPF: {patient.cpf}</span>}
                                        {patient.phone && <span>Tel: {patient.phone}</span>}
                                        {!patient.cpf && !patient.phone && <span>{patient.email || "Sem contato"}</span>}
                                    </div>
                                </div>
                            </Button>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Search, User, FileText, Calendar, Phone, Mail, Loader2, Hash, Shield, Send, CheckCircle2, AlertCircle, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { patientService, Patient, EasyDentalSearchResult } from "../services/patientService";
import Sidebar from "@/components/Sidebar";
import { useHasPermission } from "../hooks/useHasPermission";
import { useAuth } from "@/context/AuthContext";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Helpers para formatação de máscaras
const formatCpfMask = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

const formatPhoneMask = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const Patients = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    
    // EasyDental Search State
    const [easySearchQuery, setEasySearchQuery] = useState("");
    const [isSearchingEasyDental, setIsSearchingEasyDental] = useState(false);
    const [easySearchResult, setEasySearchResult] = useState<EasyDentalSearchResult | null>(null);

    const [newPatientData, setNewPatientData] = useState({
        name: "",
        cpf: "",
        patientNumber: "",
        easyDentalId: "",
        paymentType: "",
        insuranceCompany: "",
        email: "",
        phone: "",
        birthDate: "",
    });
    const { user } = useAuth();
    const canTransfer = user?.canTransferPatient || user?.isSuperAdmin;
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [targetEmail, setTargetEmail] = useState("");

    const canWritePatient = useHasPermission('write', 'patient');

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
            toast.error("Erro ao carregar pacientes");
        } finally {
            setIsLoading(false);
        }
    };

    // Consulta paciente no EasyDental pelo CPF, Celular ou Código/Número do Cliente
    const handleSearchEasyDental = async () => {
        const query = easySearchQuery.trim();
        if (!query) {
            toast.error("Digite o CPF, Celular ou Código/Nº do Cliente para buscar no EasyDental");
            return;
        }

        setIsSearchingEasyDental(true);
        setEasySearchResult(null);
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

            setEasySearchResult(result);

            if (result.found && result.easyDental) {
                toast.success(`Paciente encontrado no EasyDental: ${result.easyDental.nome}`);
                // Preenche formulário automaticamente com os dados do EasyDental
                setNewPatientData(prev => ({
                    ...prev,
                    name: result.easyDental?.nome || prev.name,
                    cpf: result.easyDental?.cpf ? formatCpfMask(result.easyDental.cpf) : prev.cpf,
                    phone: result.easyDental?.celular ? formatPhoneMask(result.easyDental.celular) : prev.phone,
                    birthDate: result.easyDental?.dtNascimento || prev.birthDate,
                    patientNumber: result.easyDental?.codigo || prev.patientNumber,
                    easyDentalId: result.easyDental?.id || prev.easyDentalId,
                }));
            } else {
                toast.info("Paciente não localizado no EasyDental. Preencha os campos para cadastrar.");
                if (clean.length === 11) {
                    setNewPatientData(prev => ({ ...prev, cpf: formatCpfMask(clean) }));
                } else if (clean.length >= 10) {
                    setNewPatientData(prev => ({ ...prev, phone: formatPhoneMask(clean) }));
                } else if (query) {
                    setNewPatientData(prev => ({ ...prev, patientNumber: query }));
                }
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erro ao consultar EasyDental");
        } finally {
            setIsSearchingEasyDental(false);
        }
    };

    const handleCreatePatient = async () => {
        if (!newPatientData.name.trim()) {
            toast.error("Nome é obrigatório");
            return;
        }
        if (!newPatientData.cpf.trim()) {
            toast.error("CPF é obrigatório para cadastrar o paciente");
            return;
        }

        setIsCreating(true);
        try {
            const patient = await patientService.createPatient(newPatientData);
            setPatients(prev => [patient, ...prev]);
            setIsCreateDialogOpen(false);
            setNewPatientData({ 
                name: "", 
                cpf: "",
                patientNumber: "", 
                easyDentalId: "",
                paymentType: "", 
                insuranceCompany: "", 
                email: "", 
                phone: "", 
                birthDate: "" 
            });
            setEasySearchQuery("");
            setEasySearchResult(null);

            if (patient.warning) {
                toast.warning(patient.warning);
            } else {
                toast.success("Paciente cadastrado com sucesso em ambos os sistemas!");
            }
            navigate(`/patients/${patient.id}`);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erro ao criar paciente");
        } finally {
            setIsCreating(false);
        }
    };

    const filteredPatients = patients.filter(patient =>
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.cpf?.includes(searchQuery) ||
        patient.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone?.includes(searchQuery) ||
        patient.patientNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.paymentType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.insuranceCompany?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="ml-20 p-8 transition-all duration-300">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-4xl font-bold text-foreground">Pacientes</h1>
                            <p className="text-muted-foreground">Gerencie seus pacientes e planejamentos</p>
                        </div>
                        {canWritePatient && (
                            <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
                                <Plus className="mr-2 h-5 w-5" />
                                Novo Paciente
                            </Button>
                        )}
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome, email ou telefone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Patients Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredPatients.length === 0 ? (
                        <Card className="text-center py-16">
                            <CardContent>
                                <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Nenhum paciente encontrado</h3>
                                <p className="text-muted-foreground mb-4">
                                    {searchQuery ? "Tente uma busca diferente" : "Comece adicionando seu primeiro paciente"}
                                </p>
                                {!searchQuery && canWritePatient && (
                                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Adicionar Paciente
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPatients.map((patient) => (
                                <Card
                                    key={patient.id}
                                    className="cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => navigate(`/patients/${patient.id}`)}
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <CardTitle className="flex items-center gap-2">
                                                <User className="h-5 w-5 text-primary shrink-0" />
                                                {patient.patientNumber && (
                                                    <span className="text-sm font-normal text-muted-foreground">#{patient.patientNumber}</span>
                                                )}
                                                <span className="line-clamp-1">{patient.name}</span>
                                            </CardTitle>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {(patient.easyDentalId || patient.patientNumber) && (
                                                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                                                        EasyDental
                                                    </Badge>
                                                )}
                                                {patient.easyDentalSyncStatus === 'PENDENTE' && (
                                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10 font-medium">
                                                        Sync Pendente
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {patient.cpf && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Hash className="h-4 w-4" />
                                                CPF: {patient.cpf}
                                            </div>
                                        )}
                                        {patient.email && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Mail className="h-4 w-4" />
                                                {patient.email}
                                            </div>
                                        )}
                                        {patient.phone && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Phone className="h-4 w-4" />
                                                {patient.phone}
                                            </div>
                                        )}
                                        {patient.birthDate && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-4 w-4" />
                                                {formatDate(patient.birthDate)}
                                            </div>
                                        )}
                                        {patient.paymentType && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Shield className="h-4 w-4" />
                                                {patient.paymentType}
                                                {patient.paymentType === 'Convênio' && patient.insuranceCompany && ` (${patient.insuranceCompany})`}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 pt-2 border-t">
                                            <div className="flex items-center gap-1 text-sm">
                                                <FileText className="h-4 w-4 text-blue-500" />
                                                <span>{patient._count?.plannings || 0} planejamentos</span>
                                            </div>
                                            {canTransfer && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="ml-auto h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPatientId(patient.id);
                                                        setIsTransferDialogOpen(true);
                                                    }}
                                                >
                                                    <Send className="h-4 w-4 mr-1" />
                                                    Transferir
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Create Patient Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                setIsCreateDialogOpen(open);
                if (!open) {
                    setEasySearchQuery("");
                    setEasySearchResult(null);
                }
            }}>
                <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Novo Paciente
                        </DialogTitle>
                        <DialogDescription>
                            Consulte o EasyDental para carregar um paciente existente ou cadastre diretamente em ambos os sistemas.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Bloco de Busca no EasyDental */}
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                <Sparkles className="h-4 w-4" />
                                <span>Buscar no EasyDental</span>
                            </div>
                            <span className="text-xs text-muted-foreground">Por CPF, Celular ou Código/Nº do Cliente</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <Input
                                placeholder="Digite CPF, Celular ou Código/Nº do Cliente..."
                                value={easySearchQuery}
                                onChange={(e) => setEasySearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSearchEasyDental();
                                    }
                                }}
                                className="bg-background"
                            />
                            <Button 
                                type="button" 
                                onClick={handleSearchEasyDental} 
                                disabled={isSearchingEasyDental || !easySearchQuery.trim()}
                                variant="default"
                                className="shrink-0"
                            >
                                {isSearchingEasyDental ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Search className="h-4 w-4 mr-2" />
                                )}
                                Consultar
                            </Button>
                        </div>

                        {/* Feedback da Busca EasyDental */}
                        {easySearchResult && easySearchResult.found && easySearchResult.easyDental && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-3 text-sm space-y-2">
                                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span>Paciente localizado no EasyDental! Dados importados:</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-950">
                                    <div><strong>Nome:</strong> {easySearchResult.easyDental.nome}</div>
                                    <div><strong>Código:</strong> #{easySearchResult.easyDental.codigo}</div>
                                    <div><strong>CPF:</strong> {easySearchResult.easyDental.cpf || '-'}</div>
                                    <div><strong>Celular:</strong> {easySearchResult.easyDental.celular || '-'}</div>
                                    {easySearchResult.easyDental.dtNascimento && (
                                        <div><strong>Nascimento:</strong> {easySearchResult.easyDental.dtNascimento}</div>
                                    )}
                                </div>

                                {easySearchResult.alreadyInPlanner && easySearchResult.plannerPatient && (
                                    <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs text-amber-800 bg-amber-500/10 p-2 rounded">
                                        <div className="flex items-center gap-1.5">
                                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                                            <span>Este paciente já está cadastrado no Planner.</span>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs bg-white text-amber-900 border-amber-300"
                                            onClick={() => navigate(`/patients/${easySearchResult.plannerPatient?.id}`)}
                                        >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Ver Ficha
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {easySearchResult && !easySearchResult.found && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-xs text-amber-800 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                                <span>Paciente não localizado no EasyDental. Ao salvar abaixo, o cadastro será criado automaticamente no EasyDental e no Planner.</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo *</Label>
                                <Input
                                    id="name"
                                    value={newPatientData.name}
                                    onChange={(e) => setNewPatientData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Nome completo do paciente"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cpf">CPF * <span className="text-xs text-muted-foreground">(Obrigatório)</span></Label>
                                <Input
                                    id="cpf"
                                    value={newPatientData.cpf}
                                    onChange={(e) => setNewPatientData(prev => ({ ...prev, cpf: formatCpfMask(e.target.value) }))}
                                    placeholder="000.000.000-00"
                                    maxLength={14}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Telefone / Celular</Label>
                                <Input
                                    id="phone"
                                    value={newPatientData.phone}
                                    onChange={(e) => setNewPatientData(prev => ({ ...prev, phone: formatPhoneMask(e.target.value) }))}
                                    placeholder="(00) 00000-0000"
                                    maxLength={15}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="birthDate">Data de Nascimento</Label>
                                <Input
                                    id="birthDate"
                                    type="date"
                                    value={newPatientData.birthDate}
                                    onChange={(e) => setNewPatientData(prev => ({ ...prev, birthDate: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="patientNumber">
                                    Código EasyDental / Número
                                    {newPatientData.easyDentalId && (
                                        <Badge variant="secondary" className="ml-2 text-[10px] bg-emerald-500/15 text-emerald-700">Importado</Badge>
                                    )}
                                </Label>
                                <Input
                                    id="patientNumber"
                                    value={newPatientData.patientNumber}
                                    onChange={(e) => setNewPatientData(prev => ({ ...prev, patientNumber: e.target.value }))}
                                    placeholder="Gerado automaticamente se novo"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newPatientData.email}
                                    onChange={(e) => setNewPatientData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="paymentType">Pagamento</Label>
                                <Select
                                    value={newPatientData.paymentType}
                                    onValueChange={(v) => setNewPatientData(prev => ({
                                        ...prev,
                                        paymentType: v,
                                        insuranceCompany: v === 'Convênio' ? prev.insuranceCompany : ""
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Convênio">Convênio</SelectItem>
                                        <SelectItem value="Particular">Particular</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {newPatientData.paymentType === 'Convênio' && (
                                <div className="space-y-2">
                                    <Label htmlFor="insuranceCompany">Convênio</Label>
                                    <Select
                                        value={newPatientData.insuranceCompany}
                                        onValueChange={(v) => setNewPatientData(prev => ({ ...prev, insuranceCompany: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["Amil", "Odontoprev", "Hapvida", "Uniodonto", "Porto Seguro", "Sulamérica"].map(opt => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreatePatient} disabled={isCreating}>
                            {isCreating ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="mr-2 h-4 w-4" />
                            )}
                            {easySearchResult?.found ? "Importar e Salvar no Planner" : "Cadastrar em Ambos os Sistemas"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transfer Patient Dialog */}
            <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transferir Paciente</DialogTitle>
                        <DialogDescription>
                            Informe o e-mail do usuário para quem deseja transferir este paciente.
                            <strong> Atenção:</strong> Você perderá o acesso a este paciente e todos os seus dados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="targetEmail">E-mail do Destinatário</Label>
                            <Input
                                id="targetEmail"
                                type="email"
                                value={targetEmail}
                                onChange={(e) => setTargetEmail(e.target.value)}
                                placeholder="dentista@exemplo.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!selectedPatientId || !targetEmail) return;
                                setIsTransferring(true);
                                try {
                                    await patientService.transferPatient(selectedPatientId, targetEmail);
                                    toast.success("Paciente transferido com sucesso!");
                                    setIsTransferDialogOpen(false);
                                    setTargetEmail("");
                                    loadPatients(); // Reload list
                                } catch (error: unknown) {
                                    const errorMessage = error instanceof Error ? error.message : "Erro ao transferir paciente";
                                    toast.error(errorMessage);
                                } finally {
                                    setIsTransferring(false);
                                }
                            }}
                            disabled={isTransferring || !targetEmail}
                        >
                            {isTransferring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Confirmar Transferência
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Patients;

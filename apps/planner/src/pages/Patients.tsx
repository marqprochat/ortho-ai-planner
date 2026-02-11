import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Search, User, FileText, Calendar, Phone, Mail, Loader2, Hash, Shield, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { patientService, Patient } from "../services/patientService";
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

const Patients = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newPatientData, setNewPatientData] = useState({
        name: "",
        patientNumber: "",
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

    const handleCreatePatient = async () => {
        if (!newPatientData.name.trim()) {
            toast.error("Nome é obrigatório");
            return;
        }

        setIsCreating(true);
        try {
            const patient = await patientService.createPatient(newPatientData);
            setPatients(prev => [patient, ...prev]);
            setIsCreateDialogOpen(false);
            setNewPatientData({ name: "", patientNumber: "", paymentType: "", insuranceCompany: "", email: "", phone: "", birthDate: "" });
            toast.success("Paciente criado com sucesso!");
            navigate(`/patients/${patient.id}`);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao criar paciente");
        } finally {
            setIsCreating(false);
        }
    };

    const filteredPatients = patients.filter(patient =>
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
                                        <CardTitle className="flex items-center gap-2">
                                            <User className="h-5 w-5 text-primary" />
                                            {patient.patientNumber && (
                                                <span className="text-sm font-normal text-muted-foreground">#{patient.patientNumber}</span>
                                            )}
                                            {patient.name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
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
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Paciente</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do paciente para cadastrá-lo no sistema.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome *</Label>
                                <Input
                                    id="name"
                                    value={newPatientData.name}
                                    onChange={(e) => setNewPatientData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Nome completo"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="patientNumber">Número do Paciente</Label>
                                <Input
                                    id="patientNumber"
                                    value={newPatientData.patientNumber}
                                    onChange={(e) => setNewPatientData(prev => ({ ...prev, patientNumber: e.target.value }))}
                                    placeholder="Ex: 12345"
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
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input
                                id="phone"
                                value={newPatientData.phone}
                                onChange={(e) => setNewPatientData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="(00) 00000-0000"
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreatePatient} disabled={isCreating}>
                            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Criar Paciente
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

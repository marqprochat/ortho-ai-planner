import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, User, FileText, Calendar, Phone, Mail, Edit, Loader2, Brain, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { patientService, Patient, Planning, Contract } from "../services/patientService";
import Sidebar from "@/components/Sidebar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PlanningViewer } from "@/components/PlanningViewer";
import { ContractViewer } from "@/components/ContractViewer";
import { EditPatientDialog } from "@/components/EditPatientDialog";

const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-500",
    GENERATING: "bg-yellow-500",
    COMPLETED: "bg-green-500",
    REVIEWED: "bg-blue-500",
};

const statusLabels: Record<string, string> = {
    DRAFT: "Rascunho",
    GENERATING: "Gerando",
    COMPLETED: "Concluído",
    REVIEWED: "Revisado",
};

const PatientDetail = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPlanning, setSelectedPlanning] = useState<Planning | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [isContractViewerOpen, setIsContractViewerOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    useEffect(() => {
        if (id) {
            loadPatient();
        }
    }, [id]);

    const loadPatient = async () => {
        try {
            setIsLoading(true);
            const data = await patientService.getPatient(id!);
            setPatient(data);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar paciente");
            navigate("/patients");
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const handleNewPlanning = () => {
        // Save patient info to localStorage for use in NovoPlanejamentoIA
        if (patient) {
            const formData = {
                nomePaciente: patient.name,
                dataNascimento: patient.birthDate ? patient.birthDate.split('T')[0] : "",
                telefone: patient.phone || "",
                patientId: patient.id,
            };
            localStorage.setItem("planejamentoFormData", JSON.stringify(formData));
            navigate("/novo-planejamento");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <Sidebar />
                <main className="ml-20 flex items-center justify-center py-16 transition-all duration-300">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
            </div>
        );
    }

    if (!patient) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="ml-20 p-8 transition-all duration-300">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" onClick={() => navigate("/patients")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                                <User className="h-8 w-8 text-primary" />
                                {patient.name}
                            </h1>
                            <p className="text-muted-foreground">
                                Cadastrado em {formatDate(patient.createdAt)}
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                        </Button>
                    </div>

                    {/* Patient Info Card */}
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Informações do Paciente</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Email</p>
                                    <p className="text-muted-foreground">{patient.email || "-"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Telefone</p>
                                    <p className="text-muted-foreground">{patient.phone || "-"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Data de Nascimento</p>
                                    <p className="text-muted-foreground">{formatDate(patient.birthDate)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Plannings Section */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Brain className="h-6 w-6 text-primary" />
                                Planejamentos
                            </h2>
                            <Button onClick={handleNewPlanning}>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Planejamento
                            </Button>
                        </div>

                        {patient.plannings && patient.plannings.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {patient.plannings.map((planning) => (
                                    <Card
                                        key={planning.id}
                                        className="cursor-pointer hover:shadow-lg transition-shadow"
                                        onClick={() => {
                                            // Navigate to planning detail (if implemented)
                                            setSelectedPlanning(planning);
                                            setIsViewerOpen(true);
                                        }}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-lg">{planning.title}</CardTitle>
                                                <Badge className={statusColors[planning.status]}>
                                                    {statusLabels[planning.status] || planning.status}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Criado em {formatDate(planning.createdAt)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {planning.originalReport && (
                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                    {planning.originalReport.substring(0, 150)}...
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="text-center py-8">
                                <CardContent>
                                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground mb-4">Nenhum planejamento registrado</p>
                                    <Button onClick={handleNewPlanning}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Criar Primeiro Planejamento
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Contracts Section */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <FileSignature className="h-6 w-6 text-primary" />
                                Contratos
                            </h2>
                            <Button variant="outline" onClick={() => navigate("/termo-de-compromisso")}>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Contrato
                            </Button>
                        </div>

                        {patient.contracts && patient.contracts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {patient.contracts.map((contract) => (
                                    <Card
                                        key={contract.id}
                                        className="cursor-pointer hover:shadow-lg transition-shadow"
                                        onClick={() => {
                                            setSelectedContract(contract);
                                            setIsContractViewerOpen(true);
                                        }}
                                    >
                                        <CardHeader>
                                            <CardTitle className="text-lg">Termo de Compromisso</CardTitle>
                                            <CardDescription>
                                                Gerado em {formatDate(contract.createdAt)}
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="text-center py-8">
                                <CardContent>
                                    <FileSignature className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground mb-4">Nenhum contrato registrado</p>
                                    <Button variant="outline" onClick={() => navigate("/termo-de-compromisso")}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Criar Contrato
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>


            <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
                    <div className="flex-1 overflow-hidden">
                        {selectedPlanning && (
                            <PlanningViewer
                                initialPlan={selectedPlanning.aiResponse || selectedPlanning.originalReport || "Sem conteúdo"}
                                patientName={patient?.name}
                                onSave={async (newPlan) => {
                                    try {
                                        await patientService.updatePlanning(selectedPlanning.id, { aiResponse: newPlan });
                                        // Update local state to avoid full reload flickering
                                        setPatient(prev => prev ? ({
                                            ...prev,
                                            plannings: prev.plannings?.map(p =>
                                                p.id === selectedPlanning.id ? { ...p, aiResponse: newPlan } : p
                                            )
                                        }) : null);
                                    } catch (error) {
                                        console.error(error);
                                        throw error; // Re-throw to be caught by PlanningViewer
                                    }
                                }}
                                onClose={() => setIsViewerOpen(false)}
                                showGenerateContract={true}
                                onGenerateContract={() => {
                                    setIsViewerOpen(false);
                                    navigate("/termo-de-compromisso", {
                                        state: {
                                            patientId: patient?.id,
                                            planningId: selectedPlanning.id,
                                            patientName: patient?.name
                                        }
                                    });
                                }}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isContractViewerOpen} onOpenChange={setIsContractViewerOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
                    <div className="flex-1 overflow-hidden">
                        {selectedContract && (
                            <ContractViewer
                                content={selectedContract.content}
                                patientName={patient?.name}
                                onClose={() => setIsContractViewerOpen(false)}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <EditPatientDialog
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                patient={patient}
                onSuccess={(updated) => setPatient(updated)}
            />
        </div >
    );
};

export default PatientDetail;

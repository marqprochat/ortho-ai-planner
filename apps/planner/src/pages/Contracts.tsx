import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Calendar, User, Loader2, Plus, Trash2, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import { contractService, Contract } from "../services/contractService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ContractViewer } from "@/components/ContractViewer";
import { PatientSelector } from "@/components/PatientSelector";
import { Patient } from "@/services/patientService";

const Contracts = () => {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
    const [isPatientDialogOpen, setIsPatientDialogOpen] = useState(false);
    const [contractToDelete, setContractToDelete] = useState<string | null>(null);
    const [contractToSign, setContractToSign] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSigning, setIsSigning] = useState(false);

    useEffect(() => {
        loadContracts();
    }, []);

    const loadContracts = async () => {
        try {
            setIsLoading(true);
            const data = await contractService.getAllContracts();
            setContracts(data);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar contratos");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!contractToDelete) return;

        try {
            setIsDeleting(true);
            await contractService.deleteContract(contractToDelete);
            setContracts(prev => prev.filter(c => c.id !== contractToDelete));
            toast.success("Contrato excluído com sucesso");
            setIsDeleteDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao excluir contrato");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSign = async () => {
        if (!contractToSign) return;

        try {
            setIsSigning(true);
            const updatedContract = await contractService.signContract(contractToSign);
            setContracts(prev => prev.map(c => c.id === contractToSign ? updatedContract : c));
            toast.success("Contrato assinado com sucesso");
            setIsSignDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao assinar contrato");
        } finally {
            setIsSigning(false);
        }
    };

    const filteredContracts = contracts.filter(contract =>
        contract.patient?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="ml-20 p-8 transition-all duration-300">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-4xl font-bold text-foreground">Contratos</h1>
                            <p className="text-muted-foreground">Gerencie os termos de compromisso dos seus pacientes</p>
                        </div>
                        <Button onClick={() => setIsPatientDialogOpen(true)} size="lg">
                            <Plus className="mr-2 h-5 w-5" />
                            Novo Contrato
                        </Button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por paciente ou conteúdo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Contracts Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredContracts.length === 0 ? (
                        <Card className="text-center py-16">
                            <CardContent>
                                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Nenhum contrato encontrado</h3>
                                <p className="text-muted-foreground mb-4">
                                    {searchQuery ? "Tente uma busca diferente" : "Comece gerando seu primeiro contrato"}
                                </p>
                                {!searchQuery && (
                                    <Button onClick={() => setIsPatientDialogOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Gerar Contrato
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredContracts.map((contract) => (
                                <Card
                                    key={contract.id}
                                    className="hover:shadow-lg transition-shadow group flex flex-col"
                                >
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <User className="h-5 w-5 text-primary" />
                                            {contract.patient?.name || "Paciente"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="h-4 w-4" />
                                                    {formatDate(contract.createdAt)}
                                                </div>
                                                {contract.isSigned ? (
                                                    <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Assinado
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-200">
                                                        Pendente
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-3 italic bg-muted/30 p-3 rounded-md border">
                                                {contract.content.substring(0, 150)}...
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2 pt-4 border-t mt-auto">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 gap-2"
                                                    onClick={() => {
                                                        setSelectedContract(contract);
                                                        setIsViewerOpen(true);
                                                    }}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    Visualizar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => {
                                                        setContractToDelete(contract.id);
                                                        setIsDeleteDialogOpen(true);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {!contract.isSigned && (
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white border-none"
                                                    onClick={() => {
                                                        setContractToSign(contract.id);
                                                        setIsSignDialogOpen(true);
                                                    }}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Confirmar Assinatura
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

            {/* Patient Selection Dialog */}
            <Dialog open={isPatientDialogOpen} onOpenChange={setIsPatientDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Selecionar Paciente</DialogTitle>
                        <DialogDescription>
                            Selecione o paciente para o qual deseja gerar o contrato.
                        </DialogDescription>
                    </DialogHeader>
                    <PatientSelector onSelect={(patient) => {
                        navigate("/termo-de-compromisso", {
                            state: {
                                patientId: patient.id,
                                patientName: patient.name
                            }
                        });
                    }} />
                </DialogContent>
            </Dialog>

            {/* Contract Viewer Dialog */}
            <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    {selectedContract && (
                        <div className="flex-1 overflow-y-auto p-6 pt-12">
                            <ContractViewer
                                content={selectedContract.content}
                                patientName={selectedContract.patient?.name}
                                logoUrl={selectedContract.logoUrl}
                                onClose={() => setIsViewerOpen(false)}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir Contrato</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sign Confirmation Dialog */}
            <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Assinatura</DialogTitle>
                        <DialogDescription>
                            Você confirma que o contrato foi assinado?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSignDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleSign}
                            disabled={isSigning}
                        >
                            {isSigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Contracts;

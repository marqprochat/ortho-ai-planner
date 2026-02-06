import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Calendar, User, Brain, Loader2, Filter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import { planningService, Planning } from "../services/planningService";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { patientService } from "../services/patientService";
import { useHasPermission } from "../hooks/useHasPermission";

const Plannings = () => {
    const navigate = useNavigate();
    const [plannings, setPlannings] = useState<Planning[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'COMPLETED'>('ALL');
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [planningToDelete, setPlanningToDelete] = useState<Planning | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const canDeletePlanning = useHasPermission('delete', 'planning');

    useEffect(() => {
        loadPlannings();
    }, []);

    const loadPlannings = async () => {
        try {
            setIsLoading(true);
            const data = await planningService.getAllPlannings();
            setPlannings(data);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar planejamentos");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredPlannings = plannings.filter(planning => {
        const matchesSearch =
            planning.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            planning.patient?.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || planning.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const handleDeletePlanning = async () => {
        if (!planningToDelete) return;
        setIsDeleting(true);
        try {
            await patientService.deletePlanning(planningToDelete.id);
            setPlannings(prev => prev.filter(p => p.id !== planningToDelete.id));
            toast.success("Planejamento excluído com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao excluir planejamento");
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
            setPlanningToDelete(null);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="ml-20 p-8 transition-all duration-300">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-4xl font-bold text-foreground">Planejamentos</h1>
                            <p className="text-muted-foreground">Gerencie todos os planejamentos dos seus pacientes</p>
                        </div>
                        <Button onClick={() => navigate('/novo-planejamento', { state: { isNew: true } })} size="lg">
                            <Brain className="mr-2 h-5 w-5" />
                            Novo Planejamento com IA
                        </Button>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por título ou paciente..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Filter className="h-4 w-4" />
                                    {statusFilter === 'ALL' ? 'Todos os Status' : statusFilter === 'DRAFT' ? 'Rascunho' : 'Concluído'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setStatusFilter('ALL')}>
                                    Todos os Status
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter('DRAFT')}>
                                    Rascunho
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter('COMPLETED')}>
                                    Concluído
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Plannings Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredPlannings.length === 0 ? (
                        <Card className="text-center py-16">
                            <CardContent>
                                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Nenhum planejamento encontrado</h3>
                                <p className="text-muted-foreground mb-4">
                                    {searchQuery || statusFilter !== 'ALL'
                                        ? "Tente alterar seus filtros de busca"
                                        : "Comece criando seu primeiro planejamento com IA"}
                                </p>
                                {(!searchQuery && statusFilter === 'ALL') && (
                                    <Button onClick={() => navigate('/novo-planejamento', { state: { isNew: true } })}>
                                        <Brain className="mr-2 h-4 w-4" />
                                        Criar Planejamento
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPlannings.map((planning) => (
                                <Card
                                    key={planning.id}
                                    className="cursor-pointer hover:shadow-lg transition-shadow group"
                                    onClick={() => navigate(`/patients/${planning.patientId}`)} // Navigate to patient usually, or planning detail if we had one. Going to patient for now as per context. Or maybe open viewing modal? Context implies "listing". Let's link to patient for now or if we can view planning directly? The PlanningViewer is a component.
                                // Actually, usually users want to edit/view. But plannings are sub-resources of patients in this app structure so far. 
                                // Let's assume clicking takes you to patient detail, where plannings are usually listed. 
                                // OR, we can navigate to a specific planning view if `PlanoDeTratamento` supports ID param. 
                                // `PlanoDeTratamento` seems to be "Current Plan" context based. 
                                // Let's stick to navigating to the patient page as a safe default, or maybe just list them purely.
                                // User asked for "responder a role de visualização de planejamento".
                                // So maybe we should be able to view it.
                                // But `PlanningViewer` is a component.
                                // Let's navigate to `patient` page for now, as that's where context is usually set.
                                >
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-start justify-between gap-2">
                                            <span className="line-clamp-1 text-lg">{planning.title}</span>
                                            <span className={`text-xs px-2 py-1 rounded-full ${planning.status === 'COMPLETED'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {planning.status === 'COMPLETED' ? 'Concluído' : 'Rascunho'}
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <User className="h-4 w-4" />
                                            <span className="font-medium text-foreground">{planning.patient?.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            {formatDate(planning.createdAt)}
                                        </div>
                                        {canDeletePlanning && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPlanningToDelete(planning);
                                                    setIsDeleteOpen(true);
                                                }}
                                            >
                                                <Trash2 className="mr-1 h-4 w-4" />
                                                Excluir
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <ConfirmationDialog
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                title="Excluir Planejamento"
                description={`Tem certeza que deseja excluir o planejamento "${planningToDelete?.title}"? Esta ação não pode ser desfeita.`}
                onConfirm={handleDeletePlanning}
                isLoading={isDeleting}
                confirmText="Excluir Planejamento"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default Plannings;

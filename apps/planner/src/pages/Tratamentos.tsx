import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Activity, Calendar, User, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import { patientService, Treatment } from "../services/patientService";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TreatmentWithPlanning = Treatment & {
    planning: {
        id: string;
        title: string;
        patient: { id: string; name: string };
    };
};

const statusLabels: Record<string, string> = {
    EM_ANDAMENTO: "Em Andamento",
    CONCLUIDO: "Concluído",
    CANCELADO: "Cancelado",
};

const statusBadgeClass: Record<string, string> = {
    EM_ANDAMENTO: "bg-blue-100 text-blue-700",
    CONCLUIDO: "bg-emerald-100 text-emerald-700",
    CANCELADO: "bg-red-100 text-red-700",
};

const Tratamentos = () => {
    const navigate = useNavigate();
    const [treatments, setTreatments] = useState<TreatmentWithPlanning[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO">("ALL");

    useEffect(() => {
        loadTreatments();
    }, []);

    const loadTreatments = async () => {
        try {
            setIsLoading(true);
            const data = await patientService.getAllTreatments();
            setTreatments(data);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar tratamentos");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredTreatments = treatments.filter((t) => {
        const matchesSearch =
            t.planning?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.planning?.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const formatDate = (dateString?: string) => {
        if (!dateString) return "—";
        return new Date(dateString).toLocaleDateString("pt-BR");
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="ml-20 p-8 transition-all duration-300">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
                                <Activity className="h-9 w-9 text-teal-500" />
                                Tratamentos
                            </h1>
                            <p className="text-muted-foreground">Gerencie todos os tratamentos dos seus pacientes</p>
                        </div>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por paciente ou planejamento..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Filter className="h-4 w-4" />
                                    {statusFilter === "ALL" ? "Todos" : statusLabels[statusFilter]}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setStatusFilter("ALL")}>Todos</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("EM_ANDAMENTO")}>Em Andamento</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("CONCLUIDO")}>Concluído</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("CANCELADO")}>Cancelado</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Treatments Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredTreatments.length === 0 ? (
                        <Card className="text-center py-16">
                            <CardContent>
                                <Activity className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Nenhum tratamento encontrado</h3>
                                <p className="text-muted-foreground">
                                    {searchQuery || statusFilter !== "ALL"
                                        ? "Tente alterar seus filtros de busca"
                                        : "Inicie um tratamento a partir da página do paciente"}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTreatments.map((treatment) => (
                                <Card
                                    key={treatment.id}
                                    className="cursor-pointer hover:shadow-lg transition-shadow group"
                                    onClick={() =>
                                        navigate("/tratamento", {
                                            state: {
                                                planningId: treatment.planningId,
                                                patientName: treatment.planning?.patient?.name,
                                                patientId: treatment.planning?.patient?.id,
                                            },
                                        })
                                    }
                                >
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-start justify-between gap-2">
                                            <span className="line-clamp-1 text-lg">{treatment.planning?.title || "Tratamento"}</span>
                                            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${statusBadgeClass[treatment.status] || "bg-gray-100 text-gray-700"}`}>
                                                {statusLabels[treatment.status] || treatment.status}
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <User className="h-4 w-4" />
                                            <span className="font-medium text-foreground">{treatment.planning?.patient?.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            Início: {formatDate(treatment.startDate)}
                                        </div>
                                        {treatment.deadline && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-4 w-4 text-orange-500" />
                                                Prazo: {formatDate(treatment.deadline)}
                                            </div>
                                        )}
                                        {treatment.lastAppointment && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-4 w-4 text-blue-500" />
                                                Última consulta: {formatDate(treatment.lastAppointment)}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Tratamentos;

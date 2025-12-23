import { Link } from "react-router-dom";
import { Plus, Users, FileText, Brain, FolderOpen, ClipboardList, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import { useEffect, useState } from "react";
import { patientService, Patient } from "@/services/patientService";
import { planningService, Planning } from "@/services/planningService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Dashboard = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [contractsCount, setContractsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientsData, planningsData, contractsData] = await Promise.all([
          patientService.getPatients(),
          planningService.getAllPlannings(),
          planningService.getContracts()
        ]);
        setPatients(patientsData);
        setPlannings(planningsData);
        setContractsCount(contractsData.length);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pendingPlannings = plannings.filter(p => p.status === 'DRAFT').length;
  const completedPlannings = plannings.filter(p => p.status === 'COMPLETED').length;
  const recentPlannings = plannings.slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main Content */}
      <main className="ml-20 p-8 transition-all duration-300">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Bem-vindo</h2>
          <p className="text-muted-foreground">Aqui está um resumo dos seus casos e atividades</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">Total</span>
              </div>
              <div className="text-3xl font-bold mb-1">{loading ? "..." : patients.length}</div>
              <div className="text-sm text-muted-foreground">Pacientes</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Brain className="h-8 w-8 text-warning" />
                <span className="text-sm font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">Pendentes</span>
              </div>
              <div className="text-3xl font-bold mb-1">{loading ? "..." : pendingPlannings}</div>
              <div className="text-sm text-muted-foreground">Aguardando IA</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <span className="text-sm font-medium text-success bg-success/10 px-2 py-1 rounded-full">Concluídos</span>
              </div>
              <div className="text-3xl font-bold mb-1">{loading ? "..." : completedPlannings}</div>
              <div className="text-sm text-muted-foreground">Planejamentos</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-secondary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <FileText className="h-8 w-8 text-secondary" />
                <span className="text-sm font-medium text-secondary bg-secondary/10 px-2 py-1 rounded-full">Contratos</span>
              </div>
              <div className="text-3xl font-bold mb-1">{loading ? "..." : contractsCount}</div>
              <div className="text-sm text-muted-foreground">Contratos Gerados</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/plannings">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-secondary text-secondary-foreground">
                <CardContent className="p-8 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3" />
                  <h4 className="font-semibold text-lg">Planejamentos</h4>
                </CardContent>
              </Card>
            </Link>

            <Link to="/patients">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-primary text-primary-foreground">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto mb-3" />
                  <h4 className="font-semibold text-lg">Gerenciar Pacientes</h4>
                </CardContent>
              </Card>
            </Link>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-accent text-accent-foreground">
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3" />
                <h4 className="font-semibold text-lg">Ver Relatórios</h4>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Cases */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Casos Recentes</h3>
            <Link to="/plannings">
              <Button variant="link" className="text-primary">Ver todos</Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-4 font-semibold">Paciente</th>
                      <th className="p-4 font-semibold">Título</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          Carregando...
                        </td>
                      </tr>
                    ) : recentPlannings.length > 0 ? (
                      recentPlannings.map((planning) => (
                        <tr key={planning.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-4 font-medium">{planning.patient?.name}</td>
                          <td className="p-4">{planning.title}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planning.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}>
                              {planning.status === 'COMPLETED' ? 'Concluído' : 'Processando'}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {format(new Date(planning.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          Nenhum caso recente para exibir
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
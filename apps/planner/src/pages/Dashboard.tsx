import { Link } from "react-router-dom";
import { Plus, Users, FileText, Brain, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";

const Dashboard = () => {
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
                <FileText className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">+64</span>
              </div>
              <div className="text-3xl font-bold mb-1">49</div>
              <div className="text-sm text-muted-foreground">Casos Ativos</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Brain className="h-8 w-8 text-warning" />
                <span className="text-sm font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">-2</span>
              </div>
              <div className="text-3xl font-bold mb-1">0</div>
              <div className="text-sm text-muted-foreground">Planejamentos Pendentes</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-success bg-success/10 px-2 py-1 rounded-full">+5</span>
              </div>
              <div className="text-3xl font-bold mb-1">15</div>
              <div className="text-sm text-muted-foreground">Concluídos</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-secondary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <svg className="h-8 w-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-sm font-medium text-secondary bg-secondary/10 px-2 py-1 rounded-full">+2%</span>
              </div>
              <div className="text-3xl font-bold mb-1">23%</div>
              <div className="text-sm text-muted-foreground">Taxa de Sucesso</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/novo-planejamento">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-secondary text-secondary-foreground">
                <CardContent className="p-8 text-center">
                  <Brain className="h-12 w-12 mx-auto mb-3" />
                  <h4 className="font-semibold text-lg">Planejamento com IA</h4>
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
            <Button variant="link" className="text-primary">Ver todos</Button>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground py-8">
                Nenhum caso recente para exibir
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
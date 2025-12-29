import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, ClipboardList, Users, Calendar, Settings, ExternalLink, Building2, UserCog } from "lucide-react";
import { ClinicSelector } from "@/components/ClinicSelector";

// Default apps if user has no specific access configured
const defaultApps = [
    {
        id: "planner",
        name: "planner",
        displayName: "Planejamento Ortodôntico",
        description: "Planejamento de tratamento assistido por IA",
        icon: "ClipboardList",
        url: import.meta.env.VITE_PLANNER_APP_URL || import.meta.env.VITE_PLANNER_URL || "http://localhost:8080",
    },
];

const iconMap: Record<string, React.ReactNode> = {
    ClipboardList: <ClipboardList className="w-8 h-8" />,
    Users: <Users className="w-8 h-8" />,
    Calendar: <Calendar className="w-8 h-8" />,
    Settings: <Settings className="w-8 h-8" />,
};

export default function DashboardPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const handleAppClick = (app: typeof defaultApps[0]) => {
        if (app.url) {
            const token = authService.getToken();
            const url = new URL(app.url);
            if (token) {
                url.searchParams.set("token", token);
            }
            window.open(url.toString(), "_blank");
        }
    };

    // Use user's app access or default apps
    const apps = user?.appAccess?.length
        ? user.appAccess.map((access) => ({
            ...access.application,
            role: access.role.name,
        }))
        : defaultApps;

    return (
        <div className="min-h-screen bg-sidebar">
            {/* Header */}
            <header className="border-b border-sidebar-border bg-sidebar-accent/50 backdrop-blur-sm">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                                {user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div>
                                <h2 className="text-sidebar-foreground font-semibold">{user?.name || "Usuário"}</h2>
                                <p className="text-sidebar-foreground/60 text-sm">{user?.tenant?.name || "Portal"}</p>
                            </div>
                        </div>

                        {/* Clinic Selector */}
                        <div className="h-8 w-px bg-sidebar-border mx-2"></div>
                        <ClinicSelector />
                    </div>

                    <Button
                        variant="ghost"
                        className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sair
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-6 py-12">

                {/* Admin Section */}
                {user?.isSuperAdmin && (
                    <div className="mb-12">
                        <div className="mb-8 border-b border-sidebar-border pb-4">
                            <h1 className="text-3xl font-bold text-sidebar-foreground mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                                Administração
                            </h1>
                            <p className="text-sidebar-foreground/60">Gerenciamento do sistema</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card
                                className="bg-sidebar-accent/30 border-sidebar-border hover:bg-sidebar-accent/50 hover:border-primary/50 transition-all cursor-pointer group"
                                onClick={() => navigate('/admin/clinics')}
                            >
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-lg bg-success/20 flex items-center justify-center text-success mb-4">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-sidebar-foreground">Gerenciar Clínicas</CardTitle>
                                    <CardDescription className="text-sidebar-foreground/60">Criar e editar clínicas do sistema</CardDescription>
                                </CardHeader>
                            </Card>
                            <Card
                                className="bg-sidebar-accent/30 border-sidebar-border hover:bg-sidebar-accent/50 hover:border-primary/50 transition-all cursor-pointer group"
                                onClick={() => navigate('/admin/users')}
                            >
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-lg bg-info/20 flex items-center justify-center text-info mb-4">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-sidebar-foreground">Gerenciar Usuários</CardTitle>
                                    <CardDescription className="text-sidebar-foreground/60">Contas de acesso e permissões</CardDescription>
                                </CardHeader>
                            </Card>
                            <Card
                                className="bg-sidebar-accent/30 border-sidebar-border hover:bg-sidebar-accent/50 hover:border-primary/50 transition-all cursor-pointer group"
                                onClick={() => navigate('/admin/roles')}
                            >
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-lg bg-warning/20 flex items-center justify-center text-warning mb-4">
                                        <UserCog className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-sidebar-foreground">Perfis e Permissões</CardTitle>
                                    <CardDescription className="text-sidebar-foreground/60">Definir o que cada perfil pode fazer</CardDescription>
                                </CardHeader>
                            </Card>
                        </div>
                    </div>
                )}

                <div className="mb-10">
                    <h1 className="text-4xl font-bold text-sidebar-foreground mb-2">Seus Aplicativos</h1>
                    <p className="text-sidebar-foreground/60">Selecione um aplicativo para começar</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {apps.map((app) => (
                        <Card
                            key={app.id || app.name}
                            className="bg-sidebar-accent/30 border-sidebar-border hover:bg-sidebar-accent/50 hover:border-primary/50 transition-all cursor-pointer group"
                            onClick={() => handleAppClick(app as typeof defaultApps[0])}
                        >
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white">
                                        {iconMap[app.icon || "ClipboardList"] || <ClipboardList className="w-8 h-8" />}
                                    </div>
                                    <ExternalLink className="w-5 h-5 text-sidebar-foreground/40 group-hover:text-primary transition-colors" />
                                </div>
                                <CardTitle className="text-sidebar-foreground mt-4">{app.displayName}</CardTitle>
                                <CardDescription className="text-sidebar-foreground/60">
                                    {(app as any).description || "Clique para acessar"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {"role" in app && (
                                    <span className="inline-block px-3 py-1 bg-primary/20 text-primary text-xs rounded-full">
                                        {app.role}
                                    </span>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </main>
        </div>
    );
}

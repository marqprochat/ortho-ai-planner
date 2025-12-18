import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, ClipboardList, Users, Calendar, Settings, ExternalLink } from "lucide-react";
import { ClinicSelector } from "@/components/ClinicSelector";

// Default apps if user has no specific access configured
const defaultApps = [
    {
        id: "planner",
        name: "planner",
        displayName: "Planejamento Ortodôntico",
        description: "Planejamento de tratamento assistido por IA",
        icon: "ClipboardList",
        url: "http://localhost:8080",
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
            window.open(app.url, "_blank");
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                {user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div>
                                <h2 className="text-white font-semibold">{user?.name || "Usuário"}</h2>
                                <p className="text-gray-400 text-sm">{user?.tenant?.name || "Portal"}</p>
                            </div>
                        </div>

                        {/* Clinic Selector */}
                        <div className="h-8 w-px bg-white/10 mx-2"></div>
                        <ClinicSelector />
                    </div>

                    <Button
                        variant="ghost"
                        className="text-gray-300 hover:text-white hover:bg-white/10"
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
                        <div className="mb-8 border-b border-white/10 pb-4">
                            <h1 className="text-3xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                                Administração
                            </h1>
                            <p className="text-gray-400">Gerenciamento do sistema</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card
                                className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/50 transition-all cursor-pointer group"
                                onClick={() => navigate('/admin/clinics')}
                            >
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 mb-4">
                                        <Settings className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-white">Gerenciar Clínicas</CardTitle>
                                    <CardDescription className="text-gray-400">Criar e editar clínicas do sistema</CardDescription>
                                </CardHeader>
                            </Card>
                            <Card
                                className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/50 transition-all cursor-pointer group"
                                onClick={() => navigate('/admin/users')}
                            >
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-white">Gerenciar Usuários</CardTitle>
                                    <CardDescription className="text-gray-400">Contas de acesso e permissões</CardDescription>
                                </CardHeader>
                            </Card>
                            <Card
                                className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/50 transition-all cursor-pointer group"
                                onClick={() => navigate('/admin/roles')}
                            >
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 mb-4">
                                        <ClipboardList className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-white">Perfis e Permissões</CardTitle>
                                    <CardDescription className="text-gray-400">Definir o que cada perfil pode fazer</CardDescription>
                                </CardHeader>
                            </Card>
                        </div>
                    </div>
                )}

                <div className="mb-10">
                    <h1 className="text-4xl font-bold text-white mb-2">Seus Aplicativos</h1>
                    <p className="text-gray-400">Selecione um aplicativo para começar</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {apps.map((app) => (
                        <Card
                            key={app.id || app.name}
                            className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/50 transition-all cursor-pointer group"
                            onClick={() => handleAppClick(app as typeof defaultApps[0])}
                        >
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                                        {iconMap[app.icon || "ClipboardList"] || <ClipboardList className="w-8 h-8" />}
                                    </div>
                                    <ExternalLink className="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors" />
                                </div>
                                <CardTitle className="text-white mt-4">{app.displayName}</CardTitle>
                                <CardDescription className="text-gray-400">
                                    {(app as any).description || "Clique para acessar"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {"role" in app && (
                                    <span className="inline-block px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
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

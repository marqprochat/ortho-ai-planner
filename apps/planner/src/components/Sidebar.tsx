import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, Users, FileText, Brain, FolderOpen, LogOut, Stethoscope, ClipboardList } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useHasPermission } from "../hooks/useHasPermission";

import { ClinicSelector } from "./ClinicSelector";

const Sidebar = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);

    const canReadPatients = useHasPermission('read', 'patient');
    const canReadPlannings = useHasPermission('read', 'planning');
    const canWritePlanning = useHasPermission('write', 'planning');
    const canReadContracts = useHasPermission('read', 'contract');

    const isActive = (path: string) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    const linkClass = (path: string) =>
        `flex items-center rounded-lg py-3 transition-all duration-300 ${isExpanded ? "px-3 gap-3" : "px-0 justify-center"
        } ${isActive(path)
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent"
        }`;

    return (
        <aside
            className={`fixed left-0 top-0 h-full bg-sidebar p-4 z-50 transition-all duration-300 ease-in-out ${isExpanded ? "w-64" : "w-16"
                }`}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >

            {/* Logo */}
            <div className={`mb-4 flex items-center overflow-hidden ${isExpanded ? "gap-3" : "justify-center"}`}>
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Stethoscope className="h-5 w-5 text-primary-foreground" />
                </div>
                {isExpanded && (
                    <h1 className="text-xl font-bold text-sidebar-foreground whitespace-nowrap">OrtoPlan</h1>
                )}
            </div>

            {/* Clinic Selector */}
            <ClinicSelector isExpanded={isExpanded} />

            {/* Navigation */}
            <nav className="space-y-2">
                <Link to="/" className={linkClass("/")}>
                    <FolderOpen className="h-5 w-5 flex-shrink-0" />
                    {isExpanded && <span className="whitespace-nowrap">Dashboard</span>}
                </Link>

                {canReadPatients && (
                    <Link to="/patients" className={linkClass("/patients")}>
                        <Users className="h-5 w-5 flex-shrink-0" />
                        {isExpanded && <span className="whitespace-nowrap">Pacientes</span>}
                    </Link>
                )}

                {canReadPlannings && (
                    <Link to="/plannings" className={linkClass("/plannings")}>
                        <ClipboardList className="h-5 w-5 flex-shrink-0" />
                        {isExpanded && <span className="whitespace-nowrap">Planejamentos</span>}
                    </Link>
                )}

                {canWritePlanning && (
                    <Link to="/novo-planejamento" className={linkClass("/novo-planejamento")}>
                        <Plus className="h-5 w-5 flex-shrink-0" />
                        {isExpanded && <span className="whitespace-nowrap">Novo Planejamento</span>}
                    </Link>
                )}

                {canReadContracts && (
                    <Link to="/contracts" className={linkClass("/contracts")}>
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        {isExpanded && <span className="whitespace-nowrap">Contratos</span>}
                    </Link>
                )}
            </nav>

            {/* User Info at Bottom */}
            <div className="absolute bottom-4 left-4 right-4">
                <div className={`flex items-center rounded-lg py-3 bg-sidebar-accent/50 ${isExpanded ? "px-3 gap-3" : "px-0 justify-center"
                    }`}>
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                            {user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </span>
                    </div>
                    {isExpanded && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-sidebar-foreground truncate">
                                    {user?.name || "Usuário"}
                                </p>
                                <p className="text-xs text-sidebar-foreground/60 truncate">
                                    {user?.email || ""}
                                </p>
                            </div>
                            <button
                                onClick={logout}
                                className="flex-shrink-0 p-1 rounded hover:bg-sidebar-accent"
                                title="Sair"
                            >
                                <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Users, FileText, Brain, FolderOpen, LogOut, Stethoscope, ClipboardList, Activity, Settings, BarChart3 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useHasPermission } from "../hooks/useHasPermission";

import { ClinicSelector } from "./ClinicSelector";

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);

    const canReadPatients = useHasPermission('read', 'patient');
    const canReadPlannings = useHasPermission('read', 'planning');
    const canWritePlanning = useHasPermission('write', 'planning');
    const canReadContracts = useHasPermission('read', 'contract');
    const canReadReports = useHasPermission('read', 'report_pacientes') || 
                          useHasPermission('read', 'report_planejamentos') ||
                          useHasPermission('read', 'report_financeiro') ||
                          useHasPermission('read', 'report_tratamentos');

    const canReportPacientes = useHasPermission('read', 'report_pacientes');
    const canReportPlanejamentos = useHasPermission('read', 'report_planejamentos');
    const canReportFinanceiro = useHasPermission('read', 'report_financeiro');
    const canReportTratamentos = useHasPermission('read', 'report_tratamentos');

    const [isReportsOpen, setIsReportsOpen] = useState(false);
 
    useEffect(() => {
        if (location.pathname.startsWith("/reports")) {
            setIsReportsOpen(true);
        }
    }, [location.pathname]);

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
    
    const subLinkClass = (path: string) =>
        `flex items-center rounded-lg py-2 pl-10 pr-3 transition-all duration-300 text-sm ${
            isActive(path)
            ? "text-sidebar-primary font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
                    <Link to="/novo-planejamento" state={{ isNew: true }} className={linkClass("/novo-planejamento")}>
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

                {canReadPlannings && (
                    <Link to="/tratamentos" className={linkClass("/tratamentos")}>
                        <Activity className="h-5 w-5 flex-shrink-0" />
                        {isExpanded && <span className="whitespace-nowrap">Tratamentos</span>}
                    </Link>
                )}

                {canReadReports && (
                    <div className="relative">
                        <button 
                            onClick={() => {
                                if (isExpanded) {
                                    setIsReportsOpen(!isReportsOpen);
                                } else {
                                    navigate("/reports/patients");
                                }
                            }}
                            className={`${linkClass("/reports")} w-full justify-between`}
                        >
                            <div className="flex items-center gap-3">
                                <BarChart3 className="h-5 w-5 flex-shrink-0" />
                                {isExpanded && <span className="whitespace-nowrap">Relatórios</span>}
                            </div>
                            {isExpanded && (
                                <svg 
                                    className={`w-4 h-4 transition-transform duration-200 ${isReportsOpen ? 'rotate-180' : ''}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            )}
                        </button>
                        
                        {isExpanded && isReportsOpen && (
                            <div className="mt-1 flex flex-col gap-1 overflow-hidden transition-all duration-300">
                                {canReportPacientes && (
                                    <Link to="/reports/patients" className={subLinkClass("/reports/patients")}>
                                        Pacientes
                                    </Link>
                                )}
                                {canReportPlanejamentos && (
                                    <Link to="/reports/plannings" className={subLinkClass("/reports/plannings")}>
                                        Planejamentos
                                    </Link>
                                )}
                                {canReportFinanceiro && (
                                    <Link to="/reports/contracts" className={subLinkClass("/reports/contracts")}>
                                        Financeiro
                                    </Link>
                                )}
                                {canReportTratamentos && (
                                    <Link to="/reports/treatments" className={subLinkClass("/reports/treatments")}>
                                        Tratamentos
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="pt-4 mt-4 border-t border-sidebar-border">
                    <Link to="/settings/clinic" className={linkClass("/settings/clinic")}>
                        <Settings className="h-5 w-5 flex-shrink-0" />
                        {isExpanded && <span className="whitespace-nowrap">Minha Clínica</span>}
                    </Link>
                </div>
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
                                    {(user?.nickname || user?.name) || "Usuário"}
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

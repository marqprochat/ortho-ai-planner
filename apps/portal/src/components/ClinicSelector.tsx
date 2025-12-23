import { ChevronDown, Building2 } from "lucide-react";
import { useClinic } from "../context/ClinicContext";
import { useState, useRef, useEffect } from "react";

export function ClinicSelector() {
    const { clinics, currentClinic, setSelectedClinicId, isLoading } = useClinic();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (isLoading) return <div className="h-10 w-32 bg-sidebar-accent animate-pulse rounded"></div>;

    if (clinics.length === 0) return <span className="text-sidebar-foreground/40 text-sm">Sem clínicas</span>;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent/30 hover:bg-sidebar-accent/50 rounded-lg border border-sidebar-border transition-all group"
            >
                <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white">
                    <Building2 className="w-4 h-4" />
                </div>
                <div className="text-left hidden md:block">
                    <p className="text-xs text-sidebar-foreground/60">Clínica Atual</p>
                    <p className="text-sm font-medium text-sidebar-foreground group-hover:text-primary transition-colors">
                        {currentClinic?.name || "Selecione..."}
                    </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-sidebar-foreground/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-sidebar border border-sidebar-border rounded-xl shadow-2xl p-1 z-50">
                    <div className="max-h-64 overflow-y-auto">
                        <div className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/40 uppercase">
                            Minhas Clínicas
                        </div>
                        {clinics.map((clinic) => (
                            <button
                                key={clinic.id}
                                onClick={() => {
                                    setSelectedClinicId(clinic.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${currentClinic?.id === clinic.id
                                    ? "bg-primary/20 text-primary"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                    }`}
                            >
                                <Building2 className="w-4 h-4 opacity-50" />
                                <span className="truncate">{clinic.name}</span>
                                {currentClinic?.id === clinic.id && (
                                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"></span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

import { Building2, ChevronDown } from "lucide-react";
import { useClinic } from "../context/ClinicContext";
import { useState, useRef, useEffect } from "react";

interface ClinicSelectorProps {
    isExpanded: boolean;
}

export function ClinicSelector({ isExpanded }: ClinicSelectorProps) {
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

    if (isLoading) return <div className="h-10 w-full bg-white/10 animate-pulse rounded"></div>;

    if (clinics.length <= 1) {
        // If 1 or 0, just show static if expanded, or icon
        if (!isExpanded) return null; // Or just icon?
        // Requirement: "se tiver acesso a mais de uma... seletor"
        // If only 1, user "vai trabalhar com os dados somente dessa".
        // So selector is not strictly required if only 1.
        // But showing context is nice.
        if (clinics.length === 1 && isExpanded) {
            return (
                <div className="px-3 py-2 text-sm text-sidebar-foreground/70 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span className="truncate">{currentClinic?.name}</span>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="relative mb-4 px-2" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center gap-2 py-2 rounded-lg 
                    ${isExpanded
                        ? "px-3 bg-sidebar-accent/30 border border-sidebar-border hover:bg-sidebar-accent"
                        : "justify-center p-2 hover:bg-sidebar-accent"}`}
                title={currentClinic?.name}
            >
                <div className={`flex-shrink-0 w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-primary`}>
                    <Building2 className="w-3 h-3" />
                </div>

                {isExpanded && (
                    <>
                        <div className="flex-1 text-left overflow-hidden">
                            <p className="text-xs text-sidebar-foreground/60">Clínica</p>
                            <p className="text-sm font-medium text-sidebar-foreground truncate">
                                {(currentClinic?.nickname || currentClinic?.name) || "Selecione..."}
                            </p>
                        </div>
                        <ChevronDown className={`w-3 h-3 text-sidebar-foreground/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                )}
            </button>

            {isOpen && isExpanded && (
                <div className="absolute top-full left-2 right-2 mt-1 bg-popover border border-border rounded-lg shadow-xl p-1 z-50">
                    <div className="max-h-48 overflow-y-auto">
                        {clinics.map((clinic) => (
                            <button
                                key={clinic.id}
                                onClick={() => {
                                    setSelectedClinicId(clinic.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors
                                    ${currentClinic?.id === clinic.id
                                        ? "bg-primary/10 text-primary"
                                        : "text-popover-foreground hover:bg-muted"
                                    }`}
                            >
                                <Building2 className="w-3 h-3 opacity-70" />
                                <span className="truncate">{clinic.nickname || clinic.name}</span>
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

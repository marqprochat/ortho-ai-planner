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

    if (isLoading) return <div className="h-10 w-32 bg-white/10 animate-pulse rounded"></div>;

    // If only 1 clinic, maybe just show the name static? 
    // Requirement says "always exposed for choice" but if only 1 choice...
    // Let's keep it interactive or just static if length <= 1?
    // "se ele tiver acesso a mais de uma clinica... se somente uma, trabalhar somente com essa"
    // "sempre exposto" implies visibility.

    if (clinics.length === 0) return <span className="text-gray-400 text-sm">Sem clínicas</span>;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all group"
            >
                <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white">
                    <Building2 className="w-4 h-4" />
                </div>
                <div className="text-left hidden md:block">
                    <p className="text-xs text-gray-400">Clínica Atual</p>
                    <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                        {currentClinic?.name || "Selecione..."}
                    </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50">
                    <div className="max-h-64 overflow-y-auto">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
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
                                        ? "bg-purple-500/20 text-purple-300"
                                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                <Building2 className="w-4 h-4 opacity-50" />
                                <span className="truncate">{clinic.name}</span>
                                {currentClinic?.id === clinic.id && (
                                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

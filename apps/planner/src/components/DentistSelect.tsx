import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClinic } from "@/context/ClinicContext";
import { dentistService, Dentist } from "@/services/dentistService";

const NONE = "__none__";

interface DentistSelectProps {
    value: string | null | undefined;
    onChange: (dentist: Dentist | null) => void;
    id?: string;
    fallbackLabel?: string;
    disabled?: boolean;
}

export function DentistSelect({ value, onChange, id, fallbackLabel, disabled }: DentistSelectProps) {
    const { selectedClinicId } = useClinic();
    const [dentists, setDentists] = useState<Dentist[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        dentistService
            .list()
            .then((data) => { if (!cancelled) setDentists(data); })
            .catch(() => { if (!cancelled) setDentists([]); })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
    }, [selectedClinicId]);

    const isKnown = !value || dentists.some((d) => d.id === value);

    const handleChange = (next: string) => {
        if (next === NONE) return onChange(null);
        const dentist = dentists.find((d) => d.id === next);
        // Item de fallback (dentista inativo/fora da lista): manter a seleção atual.
        if (dentist) onChange(dentist);
    };

    return (
        <Select value={value || NONE} onValueChange={handleChange} disabled={disabled || isLoading}>
            <SelectTrigger id={id}>
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione o dentista"} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {value && !isKnown && (
                    <SelectItem value={value}>{fallbackLabel || "Dentista inativo"}</SelectItem>
                )}
                {dentists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                        {d.name} — CRO {d.cro}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

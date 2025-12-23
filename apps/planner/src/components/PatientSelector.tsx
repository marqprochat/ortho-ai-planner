import { useState, useEffect } from "react";
import { Search, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { patientService, Patient } from "@/services/patientService";

interface PatientSelectorProps {
    onSelect: (patient: Patient) => void;
}

export const PatientSelector = ({ onSelect }: PatientSelectorProps) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        loadPatients();
    }, []);

    const loadPatients = async () => {
        try {
            setIsLoading(true);
            const data = await patientService.getPatients();
            setPatients(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar paciente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    autoFocus
                />
            </div>
            <ScrollArea className="h-[300px] border rounded-md p-2">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : filteredPatients.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhum paciente encontrado.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredPatients.map(patient => (
                            <Button
                                key={patient.id}
                                variant="ghost"
                                className="w-full justify-start gap-2 h-12"
                                onClick={() => onSelect(patient)}
                            >
                                <User className="h-4 w-4 text-primary" />
                                <div className="text-left">
                                    <div className="font-medium">{patient.name}</div>
                                    <div className="text-xs text-muted-foreground">{patient.email || "Sem email"}</div>
                                </div>
                            </Button>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};

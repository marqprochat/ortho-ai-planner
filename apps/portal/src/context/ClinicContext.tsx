import React, { createContext, useContext, useState, useEffect } from "react";
import { adminService, Clinic } from "../services/adminService";
import { useAuth } from "./AuthContext";

interface ClinicContextType {
    clinics: Clinic[];
    selectedClinicId: string | null;
    setSelectedClinicId: (id: string) => void;
    currentClinic: Clinic | null;
    isLoading: boolean;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [selectedClinicId, setSelectedClinicId] = useState<string | null>(() => {
        return localStorage.getItem("selectedClinicId");
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            loadClinics();
        } else {
            setClinics([]);
            setSelectedClinicId(null);
        }
    }, [isAuthenticated]);

    const loadClinics = async () => {
        setIsLoading(true);
        try {
            // Fetch clinics available to the user
            // In a real scenario, this endpoint should just return user's clinics
            // We use adminService.getClinics() which currently needs auth and returns all for tenant/admin
            // We might need to filter or have a dedicated "my clinics" endpoint.
            // Using existing logic for now.
            const data = await adminService.getClinics();
            setClinics(data);

            // Auto-select if only one or if none selected but available
            if (data.length > 0) {
                // Read directly from localStorage to avoid stale closure
                const storedClinicId = localStorage.getItem("selectedClinicId");
                const isValidSelection = storedClinicId && data.find(c => c.id === storedClinicId);

                if (!isValidSelection) {
                    setSelectedClinicId(data[0].id);
                    localStorage.setItem("selectedClinicId", data[0].id);
                } else if (storedClinicId !== selectedClinicId) {
                    // Sync state with localStorage if different
                    setSelectedClinicId(storedClinicId);
                }
            } else {
                setSelectedClinicId(null);
                localStorage.removeItem("selectedClinicId");
            }

        } catch (error) {
            console.error("Failed to load clinics", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetSelectedClinic = (id: string) => {
        if (clinics.find(c => c.id === id)) {
            setSelectedClinicId(id);
            localStorage.setItem("selectedClinicId", id);
            // Optionally reload page or trigger data refetch
            // For SPA, simpler to let components react to context change
        }
    };

    const currentClinic = clinics.find(c => c.id === selectedClinicId) || null;

    return (
        <ClinicContext.Provider
            value={{
                clinics,
                selectedClinicId,
                setSelectedClinicId: handleSetSelectedClinic,
                currentClinic,
                isLoading,
            }}
        >
            {children}
        </ClinicContext.Provider>
    );
}

export function useClinic() {
    const context = useContext(ClinicContext);
    if (context === undefined) {
        throw new Error("useClinic must be used within a ClinicProvider");
    }
    return context;
}

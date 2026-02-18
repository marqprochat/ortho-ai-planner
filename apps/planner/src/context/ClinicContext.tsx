import React, { createContext, useContext, useState, useEffect } from "react";
import { clinicService, Clinic } from "../services/clinicService";
import { useAuth } from "./AuthContext";

interface ClinicContextType {
    clinics: Clinic[];
    selectedClinicId: string | null;
    setSelectedClinicId: (id: string) => void;
    currentClinic: Clinic | null;
    isLoading: boolean;
    refreshClinics: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth(); // AuthContext in planner exposes user? Yes.
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [selectedClinicId, setSelectedClinicId] = useState<string | null>(() => {
        return localStorage.getItem("selectedClinicId");
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            loadClinics();
        } else {
            setClinics([]);
            setSelectedClinicId(null);
        }
    }, [user]);

    const loadClinics = async () => {
        setIsLoading(true);
        try {
            const data = await clinicService.getClinics();
            setClinics(data);

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
            // In Planner, maybe we need to reload to refresh data? 
            // Or specific views use the ID. 
            // We'll let components react.
            // Force reload might be safer for ensuring data isolation consistency across the app
            window.location.reload();
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
                refreshClinics: loadClinics,
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

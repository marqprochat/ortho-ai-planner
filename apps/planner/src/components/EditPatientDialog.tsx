import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Patient, patientService } from "@/services/patientService";
import { toast } from "sonner";

interface EditPatientDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patient: Patient;
    onSuccess: (updatedPatient: Patient) => void;
}

export function EditPatientDialog({
    open,
    onOpenChange,
    patient,
    onSuccess
}: EditPatientDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        patientNumber: "",
        paymentType: "",
        email: "",
        phone: "",
        birthDate: ""
    });

    useEffect(() => {
        if (patient && open) {
            setFormData({
                name: patient.name || "",
                patientNumber: patient.patientNumber || "",
                paymentType: patient.paymentType || "",
                email: patient.email || "",
                phone: patient.phone || "",
                birthDate: patient.birthDate ? patient.birthDate.split('T')[0] : ""
            });
        }
    }, [patient, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("O nome é obrigatório");
            return;
        }

        setIsLoading(true);
        try {
            const updated = await patientService.updatePatient(patient.id, formData);
            onSuccess(updated);
            toast.success("Paciente atualizado com sucesso");
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao atualizar paciente");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Editar Paciente</DialogTitle>
                        <DialogDescription>
                            Faça alterações nas informações do paciente aqui.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Nome
                            </Label>
                            <Input
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="patientNumber" className="text-right">
                                Número
                            </Label>
                            <Input
                                id="patientNumber"
                                name="patientNumber"
                                value={formData.patientNumber}
                                onChange={handleChange}
                                className="col-span-3"
                                placeholder="Número do paciente"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="paymentType" className="text-right">
                                Pagamento
                            </Label>
                            <div className="col-span-3">
                                <Select
                                    value={formData.paymentType}
                                    onValueChange={(v) => setFormData(prev => ({ ...prev, paymentType: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Convênio">Convênio</SelectItem>
                                        <SelectItem value="Particular">Particular</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">
                                Email
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phone" className="text-right">
                                Telefone
                            </Label>
                            <Input
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="birthDate" className="text-right">
                                Data Masc.
                            </Label>
                            <Input
                                id="birthDate"
                                name="birthDate"
                                type="date"
                                value={formData.birthDate}
                                onChange={handleChange}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

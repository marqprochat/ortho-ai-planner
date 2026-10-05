import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useHasPermission } from "@/hooks/useHasPermission";
import { dentistService, Dentist } from "@/services/dentistService";

const emptyForm = { easyDentalId: "", name: "", cro: "" };

export function DentistManager({ clinicId }: { clinicId: string }) {
    const canManage = useHasPermission("manage", "clinic");
    const [dentists, setDentists] = useState<Dentist[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Dentist | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [toDelete, setToDelete] = useState<Dentist | null>(null);

    const load = async () => {
        try {
            setIsLoading(true);
            setDentists(await dentistService.list(true));
        } catch (error: any) {
            toast.error(error.message || "Erro ao carregar dentistas");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [clinicId]);

    const openNew = () => {
        setEditing(null);
        setForm(emptyForm);
        setIsDialogOpen(true);
    };

    const openEdit = (dentist: Dentist) => {
        setEditing(dentist);
        setForm({ easyDentalId: dentist.easyDentalId || "", name: dentist.name, cro: dentist.cro });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.cro.trim()) {
            toast.error("Nome e CRO são obrigatórios");
            return;
        }
        setIsSaving(true);
        try {
            if (editing) {
                await dentistService.update(editing.id, { ...form, isActive: editing.isActive });
                toast.success("Dentista atualizado!");
            } else {
                await dentistService.create(form);
                toast.success("Dentista cadastrado!");
            }
            setIsDialogOpen(false);
            await load();
        } catch (error: any) {
            toast.error(error.message || "Erro ao salvar dentista");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (dentist: Dentist) => {
        try {
            await dentistService.update(dentist.id, {
                easyDentalId: dentist.easyDentalId || "",
                name: dentist.name,
                cro: dentist.cro,
                isActive: !dentist.isActive,
            });
            await load();
        } catch (error: any) {
            toast.error(error.message || "Erro ao atualizar dentista");
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            const result = await dentistService.remove(toDelete.id);
            toast.success(result.deactivated
                ? "Dentista possui registros vinculados e foi desativado."
                : "Dentista excluído!");
            setToDelete(null);
            await load();
        } catch (error: any) {
            toast.error(error.message || "Erro ao excluir dentista");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>Dentistas</CardTitle>
                    <CardDescription>
                        Dentistas da clínica, usados para preencher o CRO em planejamentos, tratamentos e termos
                    </CardDescription>
                </div>
                {canManage && (
                    <Button type="button" onClick={openNew}>
                        <Plus className="mr-2 h-4 w-4" /> Novo dentista
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : dentists.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Nenhum dentista cadastrado.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>CRO</TableHead>
                                <TableHead>ID EasyDental</TableHead>
                                <TableHead>Status</TableHead>
                                {canManage && <TableHead className="text-right">Ações</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dentists.map((d) => (
                                <TableRow key={d.id}>
                                    <TableCell className="font-medium">{d.name}</TableCell>
                                    <TableCell>{d.cro}</TableCell>
                                    <TableCell>{d.easyDentalId || "-"}</TableCell>
                                    <TableCell>
                                        <Badge variant={d.isActive ? "default" : "secondary"}>
                                            {d.isActive ? "Ativo" : "Inativo"}
                                        </Badge>
                                    </TableCell>
                                    {canManage && (
                                        <TableCell className="text-right space-x-1">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(d)} aria-label="Editar">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" onClick={() => handleToggleActive(d)}>
                                                {d.isActive ? "Desativar" : "Ativar"}
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setToDelete(d)} aria-label="Excluir">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar dentista" : "Novo dentista"}</DialogTitle>
                        <DialogDescription>Informe o nome e o CRO. O ID do EasyDental é opcional.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="dentistName">Nome *</Label>
                            <Input id="dentistName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dentistCro">CRO *</Label>
                            <Input id="dentistCro" placeholder="Ex: SP-12345" value={form.cro} onChange={(e) => setForm({ ...form, cro: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dentistEasyId">ID do EasyDental</Label>
                            <Input id="dentistEasyId" value={form.easyDentalId} onChange={(e) => setForm({ ...form, easyDentalId: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button type="button" onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir dentista?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {toDelete?.name} será excluído. Se houver planejamentos ou tratamentos vinculados, ele será apenas desativado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

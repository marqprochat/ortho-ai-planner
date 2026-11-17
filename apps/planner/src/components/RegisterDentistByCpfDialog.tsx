import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    dentistService, DentistCpfLookup, DentistCpfRegisterResult, RegistrationRow,
} from "@/services/dentistService";

interface Props {
    clinicId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRegistered: () => void;
}

const formatCpf = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 11);
    return d
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

const rowLabel = (row: RegistrationRow) => row.clinicName || row.unitName || "-";
const joinNames = (rows: RegistrationRow[]) => rows.map(rowLabel).join(", ");

const STATUS: Record<RegistrationRow["status"], { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    will_register: { text: "Será cadastrado", variant: "default" },
    already_registered: { text: "Já cadastrado", variant: "secondary" },
    no_access: { text: "Sem permissão", variant: "destructive" },
    no_clinic: { text: "Sem clínica vinculada", variant: "outline" },
};

type Confirm = { kind: "all" } | { kind: "partial" } | null;

export function RegisterDentistByCpfDialog({ clinicId, open, onOpenChange, onRegistered }: Props) {
    const [cpf, setCpf] = useState("");
    const [cro, setCro] = useState("");
    const [lookup, setLookup] = useState<DentistCpfLookup | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [confirm, setConfirm] = useState<Confirm>(null);

    useEffect(() => {
        if (!open) {
            setCpf("");
            setCro("");
            setLookup(null);
            setConfirm(null);
        }
    }, [open]);

    const groups = useMemo(() => {
        const rows = lookup?.rows ?? [];
        return {
            toRegister: rows.filter((r) => r.status === "will_register"),
            already: rows.filter((r) => r.status === "already_registered"),
            noAccess: rows.filter((r) => r.status === "no_access"),
        };
    }, [lookup]);

    const cpfDigits = cpf.replace(/\D/g, "");

    const handleSearch = async () => {
        if (cpfDigits.length !== 11) {
            toast.error("Informe o CPF completo do dentista");
            return;
        }
        setIsSearching(true);
        setLookup(null);
        try {
            const result = await dentistService.lookupByCpf(cpfDigits, clinicId);
            setLookup(result);
            setCro(result.suggestedCro || "");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao buscar prestador");
        } finally {
            setIsSearching(false);
        }
    };

    const handleCpfChange = (value: string) => {
        setCpf(formatCpf(value));
        if (lookup) setLookup(null);
    };

    // Escolhe a confirmação conforme o acesso do usuário às unidades da dentista.
    const handleSave = () => {
        if (!lookup) return;
        if (!cro.trim()) {
            toast.error("Informe o CRO");
            return;
        }
        if (groups.toRegister.length === 0) {
            if (groups.noAccess.length > 0) {
                toast.error(`Você não tem permissão para adicionar dentistas em: ${joinNames(groups.noAccess)}`);
            } else {
                toast.info("Dentista já cadastrado em todas as unidades encontradas.");
            }
            return;
        }
        setConfirm(groups.noAccess.length > 0 ? { kind: "partial" } : { kind: "all" });
    };

    const showResult = (result: DentistCpfRegisterResult) => {
        const by = (kind: string) => result.results.filter((r) => r.result === kind).map((r) => r.clinicName);
        const created = by("created");
        const already = by("already_registered");
        const conflict = by("cro_conflict");
        if (created.length > 0) toast.success(`Dentista cadastrado em: ${created.join(", ")}`);
        if (already.length > 0) toast.info(`Já estava cadastrado em: ${already.join(", ")}`);
        if (conflict.length > 0) {
            toast.warning(`Não cadastrado em ${conflict.join(", ")}: já existe outro dentista com este CRO nessa unidade.`);
        }
    };

    const doRegister = async () => {
        if (!lookup) return;
        setIsSaving(true);
        try {
            const clinicIds = groups.toRegister.map((r) => r.clinicId).filter((id): id is string => Boolean(id));
            const result = await dentistService.registerByCpf({ cpf: cpfDigits, cro, clinicIds }, clinicId);
            showResult(result);
            setConfirm(null);
            onOpenChange(false);
            onRegistered();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao cadastrar dentista");
        } finally {
            setIsSaving(false);
        }
    };

    const toRegisterNames = joinNames(groups.toRegister);
    const allUnitsText = groups.toRegister.length === 1
        ? `na unidade ${toRegisterNames}`
        : `em todas as ${groups.toRegister.length} unidades: ${toRegisterNames}`;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Novo dentista</DialogTitle>
                        <DialogDescription>
                            Digite o CPF do prestador. O nome e as unidades vêm do EasyDental; você informa só o CRO.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="dentistCpf">CPF do dentista *</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="dentistCpf"
                                    inputMode="numeric"
                                    placeholder="000.000.000-00"
                                    value={cpf}
                                    onChange={(e) => handleCpfChange(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
                                    autoFocus
                                />
                                <Button type="button" variant="secondary" onClick={handleSearch} disabled={isSearching || cpfDigits.length !== 11}>
                                    {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                    Buscar
                                </Button>
                            </div>
                            {isSearching && (
                                <p className="text-xs text-muted-foreground">Consultando o EasyDental (pode levar alguns segundos)...</p>
                            )}
                        </div>

                        {lookup && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Nome padronizado (EasyDental)</Label>
                                        <Input value={lookup.prestador.name} readOnly className="bg-muted" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>ID EasyDental</Label>
                                        <Input value={lookup.prestador.id || "-"} readOnly className="bg-muted" />
                                    </div>
                                </div>

                                {lookup.warning && (
                                    <Alert>
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>{lookup.warning}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <Label>Unidades</Label>
                                    {lookup.rows.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Nenhuma unidade encontrada.</p>
                                    ) : (
                                        <div className="rounded-md border divide-y">
                                            {lookup.rows.map((row) => (
                                                <div key={`${row.unitName}-${row.clinicId}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                                    <div>
                                                        <div className="font-medium">{rowLabel(row)}</div>
                                                        {row.unitName && row.clinicName && row.unitName !== row.clinicName && (
                                                            <div className="text-xs text-muted-foreground">EasyDental: {row.unitName}</div>
                                                        )}
                                                        {row.existingDentist && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Cadastro existente: {row.existingDentist.name} — CRO {row.existingDentist.cro}
                                                                {!row.existingDentist.isActive && " (inativo)"}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].text}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1 text-sm">
                                    {groups.toRegister.length > 0 && (
                                        <p><span className="font-medium">Será salvo em:</span> {joinNames(groups.toRegister)}</p>
                                    )}
                                    {groups.already.length > 0 && (
                                        <p><span className="font-medium">Já cadastrado em:</span> {joinNames(groups.already)}</p>
                                    )}
                                    {groups.noAccess.length > 0 && (
                                        <p className="text-destructive">
                                            <span className="font-medium">Sem permissão para adicionar em:</span> {joinNames(groups.noAccess)}
                                        </p>
                                    )}
                                    {groups.toRegister.length === 0 && groups.noAccess.length === 0 && groups.already.length > 0 && (
                                        <p className="text-muted-foreground">Este dentista já está cadastrado em todas as unidades encontradas.</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="dentistCroByCpf">CRO *</Label>
                                    <Input
                                        id="dentistCroByCpf"
                                        placeholder="Ex: SP-12345"
                                        value={cro}
                                        onChange={(e) => setCro(e.target.value)}
                                    />
                                    {lookup.suggestedCro && (
                                        <p className="text-xs text-muted-foreground">CRO preenchido a partir de um cadastro existente.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="button" onClick={handleSave} disabled={!lookup || isSaving || groups.toRegister.length === 0}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Cadastrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirm?.kind === "partial" ? "Sem permissão em algumas unidades" : "Confirmar cadastro"}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                {confirm?.kind === "partial" ? (
                                    <>
                                        <p>
                                            Você não tem permissão para adicionar dentistas em: <strong>{joinNames(groups.noAccess)}</strong>.
                                        </p>
                                        <p>
                                            Deseja cadastrar <strong>{lookup?.prestador.name}</strong> somente nas unidades em que você tem acesso: <strong>{toRegisterNames}</strong>?
                                        </p>
                                    </>
                                ) : (
                                    <p>
                                        Deseja realmente cadastrar <strong>{lookup?.prestador.name}</strong> {allUnitsText}?
                                    </p>
                                )}
                                {groups.already.length > 0 && (
                                    <p>Já cadastrado em: {joinNames(groups.already)} (não será duplicado).</p>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isSaving}
                            onClick={(e) => { e.preventDefault(); doRegister(); }}
                        >
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {confirm?.kind === "partial" ? "Cadastrar nas unidades com acesso" : "Sim, cadastrar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

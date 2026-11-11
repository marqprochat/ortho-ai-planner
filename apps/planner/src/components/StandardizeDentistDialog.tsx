import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCheck, Loader2, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    dentistService,
    Dentist,
    StandardizationCandidateItem,
    StandardizationPreviewResult,
    StandardizationRecordType,
} from "@/services/dentistService";

interface StandardizeDentistDialogProps {
    dentist: Dentist | null;
    clinicId?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApplied?: () => void;
}

const TYPE_LABELS: Record<StandardizationRecordType, string> = {
    treatment: "Tratamento",
    planning: "Planejamento",
    contract: "Contrato",
};

const itemKey = (item: Pick<StandardizationCandidateItem, "type" | "id">) => `${item.type}:${item.id}`;

export function StandardizeDentistDialog({
    dentist,
    clinicId,
    open,
    onOpenChange,
    onApplied,
}: StandardizeDentistDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [preview, setPreview] = useState<StandardizationPreviewResult | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [typeFilter, setTypeFilter] = useState<"all" | StandardizationRecordType>("all");
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!open || !dentist) return;
        let cancelled = false;

        const loadPreview = async () => {
            setIsLoading(true);
            setPreview(null);
            setTypeFilter("all");
            setSearch("");
            try {
                const data = await dentistService.previewStandardization(dentist.id, clinicId);
                if (cancelled) return;
                setPreview(data);
                setSelectedKeys(new Set(data.items.map(itemKey)));
            } catch (error: any) {
                if (!cancelled) {
                    toast.error(error.message || "Erro ao buscar registros semelhantes");
                    onOpenChange(false);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadPreview();
        return () => { cancelled = true; };
    }, [open, dentist?.id]);

    const visibleItems = useMemo(() => {
        if (!preview) return [];
        const term = search.trim().toLowerCase();
        return preview.items.filter((item) => {
            if (typeFilter !== "all" && item.type !== typeFilter) return false;
            if (!term) return true;
            return (
                item.patientName.toLowerCase().includes(term) ||
                item.label.toLowerCase().includes(term) ||
                (item.currentName || "").toLowerCase().includes(term) ||
                (item.currentCro || "").toLowerCase().includes(term)
            );
        });
    }, [preview, typeFilter, search]);

    const selectedItems = useMemo(() => {
        if (!preview) return [];
        return preview.items.filter((item) => selectedKeys.has(itemKey(item)));
    }, [preview, selectedKeys]);

    const toggleItem = (key: string) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAllVisible = (checked: boolean) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            for (const item of visibleItems) {
                const key = itemKey(item);
                if (checked) next.add(key);
                else next.delete(key);
            }
            return next;
        });
    };

    const allVisibleSelected =
        visibleItems.length > 0 && visibleItems.every((item) => selectedKeys.has(itemKey(item)));

    const handleApply = async () => {
        if (!dentist || selectedItems.length === 0) return;
        setIsApplying(true);
        try {
            const selection = {
                treatmentIds: selectedItems.filter((i) => i.type === "treatment").map((i) => i.id),
                planningIds: selectedItems.filter((i) => i.type === "planning").map((i) => i.id),
                contractIds: selectedItems.filter((i) => i.type === "contract").map((i) => i.id),
            };
            const res = await dentistService.applyStandardization(dentist.id, selection, clinicId);
            toast.success(
                `Padrão aplicado em ${res.updated.total} registro(s): ` +
                `${res.updated.treatments} tratamento(s), ${res.updated.plannings} planejamento(s), ${res.updated.contracts} contrato(s).`
            );
            onOpenChange(false);
            onApplied?.();
        } catch (error: any) {
            toast.error(error.message || "Erro ao aplicar padronização");
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Forçar padrão do dentista
                    </DialogTitle>
                    <DialogDescription>
                        {dentist ? (
                            <>
                                Revise os tratamentos, planejamentos e contratos encontrados com nome ou CRO semelhante a{" "}
                                <span className="font-semibold text-foreground">{dentist.name}</span>{" "}
                                (<span className="font-mono text-xs">{dentist.cro}</span>). Desmarque ou remova qualquer item
                                incorreto antes de aplicar.
                            </>
                        ) : null}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                        <Loader2 className="h-7 w-7 animate-spin" />
                        <p className="text-sm">Buscando registros semelhantes na clínica...</p>
                    </div>
                ) : !preview || preview.items.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                        <CheckCheck className="h-8 w-8 mx-auto text-emerald-600" />
                        <p className="font-medium">Nenhum registro pendente encontrado</p>
                        <p className="text-sm text-muted-foreground">
                            Todos os registros semelhantes já estão vinculados e padronizados com {dentist?.name}.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 min-h-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={typeFilter === "all" ? "default" : "outline"}
                                    onClick={() => setTypeFilter("all")}
                                >
                                    Todos ({preview.summary.total})
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={typeFilter === "treatment" ? "default" : "outline"}
                                    onClick={() => setTypeFilter("treatment")}
                                >
                                    Tratamentos ({preview.summary.treatments})
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={typeFilter === "planning" ? "default" : "outline"}
                                    onClick={() => setTypeFilter("planning")}
                                >
                                    Planejamentos ({preview.summary.plannings})
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={typeFilter === "contract" ? "default" : "outline"}
                                    onClick={() => setTypeFilter("contract")}
                                >
                                    Contratos ({preview.summary.contracts})
                                </Button>
                            </div>

                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Filtrar paciente ou nome..."
                                    className="pl-8 h-9"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer select-none font-medium">
                                <Checkbox
                                    checked={allVisibleSelected}
                                    onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                                />
                                <span>
                                    {allVisibleSelected ? "Desmarcar" : "Marcar"} todos visíveis ({visibleItems.length})
                                </span>
                            </label>
                            <span className="text-muted-foreground">
                                {selectedItems.length} de {preview.items.length} selecionado(s)
                            </span>
                        </div>

                        <ScrollArea className="h-[360px] rounded-md border">
                            <div className="divide-y">
                                {visibleItems.length === 0 ? (
                                    <p className="p-6 text-center text-sm text-muted-foreground">
                                        Nenhum item corresponde ao filtro atual.
                                    </p>
                                ) : (
                                    visibleItems.map((item) => {
                                        const key = itemKey(item);
                                        const checked = selectedKeys.has(key);
                                        const hasOtherDentist =
                                            Boolean(item.currentDentistId) && item.currentDentistId !== dentist?.id;

                                        return (
                                            <div
                                                key={key}
                                                className={`flex items-start gap-3 p-3 transition-colors ${
                                                    checked ? "bg-background" : "bg-muted/30 opacity-60"
                                                }`}
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={() => toggleItem(key)}
                                                    className="mt-1"
                                                    aria-label={`Selecionar ${item.patientName}`}
                                                />

                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline">{TYPE_LABELS[item.type]}</Badge>
                                                        <span className="font-medium text-sm truncate">
                                                            {item.patientName}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            • {item.label}
                                                        </span>
                                                        {item.isSigned && (
                                                            <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-100">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                Contrato assinado
                                                            </Badge>
                                                        )}
                                                        {hasOtherDentist && (
                                                            <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-100">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                Outro vínculo
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <span className="text-muted-foreground">
                                                            Atual:{" "}
                                                            <span className="font-medium text-foreground">
                                                                {item.currentName || "(sem nome)"}
                                                            </span>
                                                            {item.currentCro ? ` • CRO ${item.currentCro}` : ""}
                                                        </span>
                                                        <span className="text-muted-foreground">→</span>
                                                        <span className="text-emerald-700 font-medium">
                                                            Novo: {dentist?.name} • CRO {dentist?.cro}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                        <span>
                                                            Correspondência: {Math.round(item.score * 100)}% ({item.reason})
                                                        </span>
                                                        {item.snippet && (
                                                            <span className="truncate max-w-md italic">
                                                                Trecho: "{item.snippet}"
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {checked && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() => toggleItem(key)}
                                                        title="Remover da lista de alterações"
                                                        aria-label="Remover da lista de alterações"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
                        Cancelar
                    </Button>
                    {preview && preview.items.length > 0 && (
                        <Button
                            type="button"
                            onClick={handleApply}
                            disabled={isApplying || selectedItems.length === 0}
                        >
                            {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Aplicar padrão ({selectedItems.length})
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


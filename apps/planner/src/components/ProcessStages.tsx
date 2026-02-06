import { FileText, Brain, FileSignature, CheckCircle, CircleDot, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessStagesProps {
    currentStage: PlanningStage;
}

const stages = [
    { id: 'DOCUMENTACAO_ENVIADA', label: 'Documentação', icon: FileText, color: 'orange' },
    { id: 'PLANEJAMENTO_GERADO', label: 'Planejamento', icon: Brain, color: 'blue' },
    { id: 'CONTRATO_GERADO', label: 'Contrato', icon: FileSignature, color: 'purple' },
    { id: 'CONTRATO_ASSINADO', label: 'Assinado', icon: CheckCircle, color: 'green' },
];

const stageOrder = ['DOCUMENTACAO_ENVIADA', 'PLANEJAMENTO_GERADO', 'CONTRATO_GERADO', 'CONTRATO_ASSINADO'];

export function ProcessStages({ currentStage }: ProcessStagesProps) {
    const currentIndex = stageOrder.indexOf(currentStage);

    const getStageStatus = (stageId: string): 'completed' | 'current' | 'pending' => {
        const stageIndex = stageOrder.indexOf(stageId);
        if (stageIndex < currentIndex) return 'completed';
        if (stageIndex === currentIndex) return 'current';
        return 'pending';
    };

    const colorClasses = {
        orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', light: 'bg-orange-100' },
        blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', light: 'bg-blue-100' },
        purple: { bg: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-500', light: 'bg-violet-100' },
        green: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-100' },
    };

    return (
        <div className="w-full mb-8">
            <div className="flex items-center justify-between relative">
                {/* Progress Line Background */}
                <div className="absolute top-6 left-0 right-0 h-1 bg-muted rounded-full z-0" />

                {/* Progress Line Filled */}
                <div
                    className="absolute top-6 left-0 h-1 bg-gradient-to-r from-orange-500 via-blue-500 to-emerald-500 rounded-full z-0 transition-all duration-500"
                    style={{
                        width: currentIndex === 1 ? '0%' :
                            currentIndex === 2 ? '33%' :
                                currentIndex === 3 ? '66%' :
                                    currentIndex === 4 ? '100%' : '0%'
                    }}
                />

                {stages.map((stage, index) => {
                    const status = getStageStatus(stage.id);
                    const colors = colorClasses[stage.color as keyof typeof colorClasses];
                    const Icon = stage.icon;

                    return (
                        <div key={stage.id} className="flex flex-col items-center z-10 flex-1">
                            {/* Icon Circle */}
                            <div
                                className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md",
                                    status === 'completed' && `${colors.bg} text-white`,
                                    status === 'current' && `${colors.light} ${colors.border} border-2 ${colors.text}`,
                                    status === 'pending' && "bg-muted border-2 border-muted-foreground/30 text-muted-foreground/50"
                                )}
                            >
                                <Icon className={cn(
                                    "h-5 w-5",
                                    status === 'current' && "animate-pulse"
                                )} />
                            </div>

                            {/* Label */}
                            <span className={cn(
                                "mt-2 text-sm font-medium transition-colors",
                                status === 'completed' && colors.text,
                                status === 'current' && `${colors.text} font-semibold`,
                                status === 'pending' && "text-muted-foreground/50"
                            )}>
                                {stage.label}
                            </span>

                            {/* Status Indicator */}
                            <div className="flex items-center gap-1 mt-1">
                                {status === 'completed' && (
                                    <span className={cn("text-xs", colors.text)}>✓ Concluído</span>
                                )}
                                {status === 'current' && (
                                    <span className={cn("text-xs font-medium", colors.text)}>● Atual</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export type PatientStage = 'SEM_DOCUMENTACAO' | 'DOCUMENTACAO_ENVIADA' | 'PLANEJAMENTO_GERADO' | 'CONTRATO_GERADO' | 'CONTRATO_ASSINADO';

export type PlanningStage = 'DOCUMENTACAO_ENVIADA' | 'PLANEJAMENTO_GERADO' | 'CONTRATO_GERADO' | 'CONTRATO_ASSINADO';

export function computePlanningStage(planning: {
    status: string;
    aiResponse?: string;
    contracts?: { isSigned?: boolean }[];
}): PlanningStage {
    const hasSignedContract = planning.contracts?.some(c => c.isSigned);
    const hasContract = (planning.contracts?.length || 0) > 0;

    // Check if planning is completed or generated
    const isPlanningGenerated = planning.status === 'COMPLETED' || planning.status === 'REVIEWED' || !!planning.aiResponse;

    if (hasSignedContract) return 'CONTRATO_ASSINADO';
    if (hasContract) return 'CONTRATO_GERADO';
    if (isPlanningGenerated) return 'PLANEJAMENTO_GERADO';

    // Default fallback
    return 'DOCUMENTACAO_ENVIADA';
}

import { useState, useEffect } from "react";
import {
    FileDown,
    FileText,
    Loader2,
    CheckCircle2,
    Wrench,
    Clock,
    ListChecks,
    Shield,
    Edit3,
    Target,
    Save,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

interface PlanningViewerProps {
    initialPlan: string;
    patientName?: string;
    onSave?: (newPlan: string) => Promise<void>;
    onClose?: () => void;
    showGenerateContract?: boolean;
    onGenerateContract?: () => void;
    readOnly?: boolean;
}

export const PlanningViewer = ({
    initialPlan,
    patientName = "Paciente",
    onSave,
    onClose,
    showGenerateContract = false,
    onGenerateContract,
    readOnly = false
}: PlanningViewerProps) => {
    const [plan, setPlan] = useState(initialPlan);
    const [isExporting, setIsExporting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedModel] = useState("gemini-1.5-flash"); // Default for summary generation if needed inside viewer

    // Sync state with prop if it changes (e.g. after API load)
    useEffect(() => {
        setPlan(initialPlan);
    }, [initialPlan]);

    const handleExportPDF = () => {
        if (!plan) {
            toast.error("Não há conteúdo para exportar.");
            return;
        }
        setIsExporting(true);

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 20;
            const contentWidth = pageWidth - margin * 2;
            let cursorY = margin;

            // Título principal
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text("PLANO DE TRATAMENTO ORTODÔNTICO", pageWidth / 2, cursorY, { align: 'center' });
            cursorY += 10;

            // Linha separadora
            pdf.setDrawColor(100, 100, 100);
            pdf.line(margin, cursorY, pageWidth - margin, cursorY);
            cursorY += 8;

            // Data e Paciente
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const dataAtual = new Date().toLocaleDateString('pt-BR');
            pdf.text(`Data: ${dataAtual}`, margin, cursorY);
            pdf.text(`Paciente: ${patientName}`, pageWidth - margin - 50, cursorY);
            cursorY += 12;

            // Divide o plano em seções
            const sections = plan.split(/(?=\*\*\d+\.)/).filter(s => s.trim());

            sections.forEach((section) => {
                const lines = section.split('\n');
                const title = lines[0]?.replace(/\*\*/g, '').trim() || '';
                const content = lines.slice(1).join('\n').trim();

                // Verifica se precisa de nova página para a seção
                if (cursorY + 30 > pageHeight - margin) {
                    pdf.addPage();
                    cursorY = margin;
                }

                // Título da seção com fundo
                pdf.setFillColor(240, 240, 240);
                pdf.roundedRect(margin, cursorY - 4, contentWidth, 10, 2, 2, 'F');
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(50, 50, 50);
                pdf.text(title, margin + 4, cursorY + 2);
                cursorY += 14;

                // Conteúdo da seção
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(80, 80, 80);

                const cleanContent = content
                    .replace(/\*\*/g, '')
                    .replace(/^\s*-\s*/gm, '• ');

                const contentLines = pdf.splitTextToSize(cleanContent, contentWidth - 8);

                contentLines.forEach((line: string) => {
                    if (cursorY + 6 > pageHeight - margin) {
                        pdf.addPage();
                        cursorY = margin;
                    }

                    // Detecta sub-títulos (fases, contenção)
                    if (line.includes('Fase') || line.includes('Contenção')) {
                        pdf.setFont('helvetica', 'bold');
                        pdf.setTextColor(60, 60, 60);
                        cursorY += 2;
                    } else {
                        pdf.setFont('helvetica', 'normal');
                        pdf.setTextColor(80, 80, 80);
                    }

                    pdf.text(line, margin + 4, cursorY);
                    cursorY += 5;
                });

                cursorY += 8; // Espaço entre seções
            });

            // Rodapé com numeração de páginas
            const pageCount = pdf.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'italic');
                pdf.setTextColor(150, 150, 150);
                pdf.text(
                    `Página ${i} de ${pageCount}`,
                    pageWidth / 2,
                    pageHeight - 10,
                    { align: 'center' }
                );
            }

            pdf.save(`plano-${patientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
            toast.success("PDF exportado com sucesso!");
        } catch (error) {
            console.error("Error exporting PDF:", error);
            toast.error("Ocorreu um erro ao exportar o PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleGenerateSummaryPDF = async () => {
        if (!plan) {
            toast.error("Não há conteúdo para gerar o resumo.");
            return;
        }
        setIsExporting(true);

        try {
            // Prompt para a IA gerar um resumo simplificado
            const summaryPrompt = `Você é um ortodontista experiente. Com base no plano de tratamento abaixo, crie um RESUMO SIMPLIFICADO para o paciente/cliente.
    
    O resumo deve ser:
    - Claro e em linguagem acessível (evite termos técnicos complexos)
    - Curto e objetivo (máximo 1 página)
    - Focado no que o paciente precisa saber
    
    Estruture o resumo assim:
    1. TIPO DE TRATAMENTO: (uma frase simples)
    2. APARELHO A SER USADO: (nome do aparelho de forma simples)
    3. DURAÇÃO ESTIMADA: (tempo em meses/anos)
    4. FASES PRINCIPAIS: (liste de forma resumida, máximo 3-4 itens)
    5. CUIDADOS IMPORTANTES: (2-3 recomendações básicas)
    6. RESULTADO ESPERADO: (uma frase sobre o objetivo final)
    
    Plano de tratamento completo:
    ---
    ${plan}
    ---
    
    Gere APENAS o resumo, sem introduções ou explicações adicionais.`;

            let summaryText = "";

            if (selectedModel.startsWith('gpt')) {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: [{ role: "user", content: summaryPrompt }],
                        temperature: 0.5,
                        max_tokens: 1000,
                    }),
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error?.message || "Erro na API da OpenAI");
                }
                const data = await response.json();
                summaryText = data.choices[0].message.content;
            } else {
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({ model: selectedModel });
                const result = await model.generateContent(summaryPrompt);
                const response = await result.response;
                summaryText = response.text();
            }

            // Gerar o PDF com o resumo
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 20;
            const contentWidth = pageWidth - margin * 2;
            let cursorY = margin;

            // Título do documento
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text("RESUMO DO PLANO DE TRATAMENTO", pageWidth / 2, cursorY, { align: 'center' });
            cursorY += 12;

            // Linha separadora
            pdf.setDrawColor(100, 100, 100);
            pdf.line(margin, cursorY, pageWidth - margin, cursorY);
            cursorY += 10;

            // Data
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const dataAtual = new Date().toLocaleDateString('pt-BR');
            pdf.text(`Data: ${dataAtual}`, margin, cursorY);
            pdf.text(`Paciente: ${patientName}`, pageWidth - margin - 50, cursorY);
            cursorY += 12;

            // Conteúdo do resumo
            pdf.setFontSize(11);
            const lineHeight = 6;

            // Remove markdown formatting for cleaner PDF
            const cleanSummary = summaryText
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/#{1,6}\s/g, '');

            const lines = pdf.splitTextToSize(cleanSummary, contentWidth);

            lines.forEach((line: string) => {
                if (cursorY + lineHeight > pdf.internal.pageSize.getHeight() - margin) {
                    pdf.addPage();
                    cursorY = margin;
                }

                // Bold for section titles
                if (line.match(/^\d+\./) || line.includes(':')) {
                    pdf.setFont('helvetica', 'bold');
                } else {
                    pdf.setFont('helvetica', 'normal');
                }

                pdf.text(line, margin, cursorY);
                cursorY += lineHeight;
            });

            // Rodapé
            const pageCount = pdf.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'italic');
                pdf.text(
                    `Página ${i} de ${pageCount}`,
                    pageWidth / 2,
                    pdf.internal.pageSize.getHeight() - 10,
                    { align: 'center' }
                );
            }

            pdf.save(`resumo-cliente-${patientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
            toast.success("Resumo PDF gerado com sucesso!");
        } catch (error: any) {
            console.error("Error generating summary PDF:", error);
            toast.error(error.message || "Ocorreu um erro ao gerar o resumo PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleSave = async () => {
        if (onSave) {
            setIsSaving(true);
            try {
                await onSave(plan);
                setIsEditing(false);
                toast.success("Alterações salvas com sucesso!");
            } catch (error) {
                console.error("Error saving plan:", error);
                toast.error("Erro ao salvar alterações.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleGenerateSummaryPDF} disabled={isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Resumo Cliente
                    </Button>
                    <Button onClick={handleExportPDF} disabled={isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        Exportar PDF
                    </Button>
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="ml-2">
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between shrink-0">
                    <div>
                        <CardTitle>Planejamento Detalhado</CardTitle>
                        <CardDescription>
                            {isEditing ? "Editando planejamento..." : "Visualize o plano de tratamento detalhado."}
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {!readOnly && (
                            isEditing ? (
                                <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Alterações
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    <Edit3 className="mr-2 h-4 w-4" />
                                    Editar
                                </Button>
                            )
                        )}
                        {isEditing && (
                            <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setPlan(initialPlan); }}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 md:p-6">
                    {isEditing ? (
                        <div className="h-full border rounded-md bg-muted/20">
                            <Textarea
                                value={plan}
                                onChange={(e) => setPlan(e.target.value)}
                                className="h-full w-full resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-4 font-mono text-sm leading-relaxed"
                                placeholder="O plano de tratamento aparecerá aqui..."
                            />
                        </div>
                    ) : (
                        <div className="space-y-4 pb-8">
                            {plan.split(/(?=\*\*\d+\.)/).map((section, index) => {
                                if (!section.trim()) return null;

                                let Icon = ListChecks;
                                let iconColor = "text-primary";

                                if (section.includes('OPÇÃO ESCOLHIDA') || section.includes('OPÇÃO')) {
                                    Icon = CheckCircle2;
                                    iconColor = "text-green-500";
                                } else if (section.includes('OBJETIVO')) {
                                    Icon = Target;
                                    iconColor = "text-red-500";
                                } else if (section.includes('APARELHOS') || section.includes('ACESSÓRIOS')) {
                                    Icon = Wrench;
                                    iconColor = "text-orange-500";
                                } else if (section.includes('TEMPO') || section.includes('ESTIMADO')) {
                                    Icon = Clock;
                                    iconColor = "text-blue-500";
                                } else if (section.includes('FASES')) {
                                    Icon = ListChecks;
                                    iconColor = "text-purple-500";
                                } else if (section.includes('CONTENÇÃO')) {
                                    Icon = Shield;
                                    iconColor = "text-teal-500";
                                }

                                const lines = section.split('\n');
                                const title = lines[0]?.replace(/\*\*/g, '').trim() || '';
                                const content = lines.slice(1).join('\n').trim();

                                return (
                                    <div key={index} className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 ${iconColor}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                                                <div className="text-muted-foreground text-sm whitespace-pre-wrap">
                                                    {content.split('\n').map((line, lineIndex) => {
                                                        const cleanLine = line.replace(/\*\*/g, '').replace(/^\s*-\s*/, '• ');
                                                        const isBold = line.includes('**Fase') || line.includes('**Contenção');
                                                        return (
                                                            <p key={lineIndex} className={`${isBold ? 'font-medium text-foreground mt-2' : ''} ${cleanLine.startsWith('•') ? 'ml-2' : ''}`}>
                                                                {cleanLine}
                                                            </p>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Rodapé fixo se necessário ou botões extras */}
            {showGenerateContract && onGenerateContract && !isEditing && (
                <div className="mt-4 flex justify-end shrink-0">
                    <Button size="lg" onClick={onGenerateContract} className="bg-green-600 hover:bg-green-700 text-white">
                        <FileText className="mr-2 h-5 w-5" />
                        Gerar Contrato
                    </Button>
                </div>
            )}
        </div>
    );
};

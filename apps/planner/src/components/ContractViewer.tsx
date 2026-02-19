import { useState } from "react";
import {
    FileDown,
    Loader2,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import jsPDF from 'jspdf';

interface ContractViewerProps {
    content: string;
    patientName?: string;
    onClose?: () => void;
}

export const ContractViewer = ({
    content,
    patientName = "Paciente",
    onClose,
}: ContractViewerProps) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleExportPDF = () => {
        if (!content) {
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

            // Título
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text("TERMO DE COMPROMISSO", pageWidth / 2, cursorY, { align: 'center' });
            cursorY += 15;

            // Data
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const dataAtual = new Date().toLocaleDateString('pt-BR');
            pdf.text(`Data: ${dataAtual}`, margin, cursorY);
            pdf.text(`Paciente: ${patientName}`, pageWidth - margin - 50, cursorY);
            cursorY += 15;

            // Conteúdo
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0); // Preto
            const lineHeight = 6;

            const splitText = pdf.splitTextToSize(content, contentWidth);

            splitText.forEach((line: string) => {
                // Ignora linhas de underscores (assinaturas serão desenhadas graficamente)
                if (line.trim().startsWith('___')) return;

                if (cursorY + lineHeight > pageHeight - margin) {
                    pdf.addPage();
                    cursorY = margin;
                }
                pdf.text(line, margin, cursorY);
                cursorY += lineHeight;
            });

            // ── Assinaturas (blocos gráficos) ──
            const signatureLineWidth = 70;
            cursorY += 25;
            if (cursorY + 60 > pageHeight - margin) {
                pdf.addPage();
                cursorY = margin + 20;
            }

            pdf.setDrawColor(0, 0, 0);
            const leftX = margin;
            const rightX = pageWidth - margin - signatureLineWidth;

            // Paciente + Responsável lado a lado
            pdf.line(leftX, cursorY, leftX + signatureLineWidth, cursorY);
            pdf.text("Assinatura do Paciente", leftX, cursorY + 5);

            pdf.line(rightX, cursorY, rightX + signatureLineWidth, cursorY);
            pdf.text("Assinatura do Responsável", rightX, cursorY + 5);

            // Dentista centralizado abaixo
            cursorY += 30;
            if (cursorY + 20 > pageHeight - margin) {
                pdf.addPage();
                cursorY = margin + 20;
            }
            const centerX = (pageWidth - signatureLineWidth) / 2;
            pdf.line(centerX, cursorY, centerX + signatureLineWidth, cursorY);
            pdf.text("Assinatura do Profissional", centerX, cursorY + 5);

            pdf.save(`contrato-${patientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
            toast.success("PDF exportado com sucesso!");
        } catch (error) {
            console.error("Error exporting PDF:", error);
            toast.error("Ocorreu um erro ao exportar o PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2 ml-auto">
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
                <CardHeader className="shrink-0">
                    <CardTitle>Termo de Compromisso</CardTitle>
                    <CardDescription>
                        Visualize o contrato gerado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="prose max-w-none whitespace-pre-wrap font-serif leading-relaxed text-foreground">
                        {content}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArrowLeft, FileDown, FileText, Loader2, CheckCircle2, Wrench, Clock, ListChecks, Shield, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import jsPDF from 'jspdf';

// Interfaces
interface Message {
  role: "user" | "assistant";
  content: string | any[];
}

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

const PlanoDeTratamento = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [plan, setPlan] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { messages, selectedOption, selectedModel } = (location.state || {}) as {
    messages: Message[];
    selectedOption: string;
    selectedModel: string;
  };

  useEffect(() => {
    if (!messages || !selectedOption || !selectedModel) {
      toast.error("Dados insuficientes para gerar o plano. Retornando...");
      navigate("/novo-planejamento");
      return;
    }

    const generatePhasedPlan = async () => {
      setIsLoading(true);
      try {
        const chatHistory = messages
          .map((msg) => `${msg.role}: ${typeof msg.content === 'string' ? msg.content : 'Análise de imagens e dados.'}`)
          .join("\n\n");

        const systemPrompt = `Você é um Ortodontista Sênior com mais de 20 anos de experiência. Sua tarefa é detalhar um plano de tratamento com base em um diagnóstico inicial e uma opção de tratamento escolhida pelo dentista responsável.

A opção escolhida foi:
---
${selectedOption}
---

O histórico da conversa e dados do paciente são:
---
${chatHistory}
---

Siga ESTRITAMENTE o seguinte formato para o plano de tratamento, usando Markdown para formatação:

**PLANO DE TRATamento ORTODÔNTICO**

**1. OPÇÃO ESCOLHIDA**
- [Replique aqui o nome e a descrição da opção escolhida pelo dentista]

**2. APARELHOS E ACESSÓrios**
- [Liste todos os aparelhos e acessórios necessários para esta opção. Ex: Bráquetes metálicos Roth, Bandas nos molares, Elásticos intermaxilares, Mini-implantes, etc.]

**3. TEMPO ESTIMADO DE TRATAMENTO**
- [Informe o tempo total estimado em meses ou anos]

**4. FASES DO TRATAMENTO**
- **Fase 1 - [Nome da Fase, ex: Alinhamento e Nivelamento] (Duração: X meses)**
  - [Descrição detalhada dos procedimentos e objetivos desta fase]
- **Fase 2 - [Nome da Fase, ex: Correção da Sobremordida e Relação de Molares] (Duração: Y meses)**
  - [Descrição detalhada dos procedimentos e objetivos desta fase]
- **[Adicione quantas fases forem necessárias]**

**5. FASE DE CONTENÇÃO**
- **Contenção Superior:** [Descreva o tipo de contenção, ex: Placa de Hawley de uso noturno]
- **Contenção Inferior:** [Descreva o tipo de contenção, ex: Contenção fixa higiênica 3x3]
- **Protocolo de Uso:** [Descreva o protocolo, ex: Uso contínuo por 1 ano, seguido de uso noturno por tempo indeterminado]

Seja claro, objetivo e use uma linguagem profissional.`;

        let aiResponse = "";

        if (selectedModel.startsWith('gpt')) {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: selectedModel,
              messages: [{ role: "system", content: systemPrompt }],
              temperature: 0.5,
              max_tokens: 3000,
            }),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "Erro na API da OpenAI");
          }
          const data = await response.json();
          aiResponse = data.choices[0].message.content;
        } else {
          const genAI = new GoogleGenerativeAI(geminiKey);
          const model = genAI.getGenerativeModel({ model: selectedModel });
          const result = await model.generateContent(systemPrompt);
          const response = await result.response;
          aiResponse = response.text();
        }
        setPlan(aiResponse);
      } catch (error: any) {
        console.error("Error generating phased plan:", error);
        toast.error(error.message || "Falha ao gerar o plano de tratamento detalhado.");
        setPlan("Ocorreu um erro ao gerar o plano. Por favor, tente novamente.");
      } finally {
        setIsLoading(false);
      }
    };

    generatePhasedPlan();
  }, [messages, selectedOption, selectedModel, navigate]);

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

      // Data
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      pdf.text(`Data: ${dataAtual}`, margin, cursorY);
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

      pdf.save("plano-de-tratamento.pdf");
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
      // Prompt para a IA gerar um resumo simplificado para o cliente
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

      pdf.save("resumo-plano-cliente.pdf");
      toast.success("Resumo PDF gerado com sucesso!");
    } catch (error: any) {
      console.error("Error generating summary PDF:", error);
      toast.error(error.message || "Ocorreu um erro ao gerar o resumo PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerateSummaryPDF} disabled={isLoading || isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Gerar Resumo para Cliente
            </Button>
            <Button onClick={handleExportPDF} disabled={isLoading || isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Exportar para PDF
            </Button>
          </div>
        </div>
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Plano de Tratamento Detalhado</h1>
          <p className="text-muted-foreground">Revise, edite e exporte o plano de tratamento gerado pela IA.</p>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Planejamento Gerado</CardTitle>
              <CardDescription>
                Visualize o plano de tratamento detalhado ou edite conforme necessário.
              </CardDescription>
            </div>
            {!isLoading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const editMode = document.getElementById('edit-mode');
                  const viewMode = document.getElementById('view-mode');
                  if (editMode && viewMode) {
                    editMode.classList.toggle('hidden');
                    viewMode.classList.toggle('hidden');
                  }
                }}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Alternar Edição
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Gerando plano detalhado...</p>
              </div>
            ) : (
              <>
                {/* Modo de Visualização */}
                <div id="view-mode" className="space-y-4">
                  {plan.split(/(?=\*\*\d+\.)/).map((section, index) => {
                    if (!section.trim()) return null;

                    // Determina o ícone baseado no conteúdo da seção
                    let Icon = ListChecks;
                    let iconColor = "text-primary";

                    if (section.includes('OPÇÃO ESCOLHIDA') || section.includes('OPÇÃO')) {
                      Icon = CheckCircle2;
                      iconColor = "text-green-500";
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

                    // Extrai título e conteúdo
                    const lines = section.split('\n');
                    const title = lines[0]?.replace(/\*\*/g, '').trim() || '';
                    const content = lines.slice(1).join('\n').trim();

                    return (
                      <div
                        key={index}
                        className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
                      >
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
                                  <p
                                    key={lineIndex}
                                    className={`${isBold ? 'font-medium text-foreground mt-2' : ''} ${cleanLine.startsWith('•') ? 'ml-2' : ''}`}
                                  >
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

                {/* Modo de Edição */}
                <div id="edit-mode" className="hidden">
                  <div className="border rounded-md bg-muted/20">
                    <Textarea
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      className="min-h-[600px] w-full resize-y border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-4"
                      placeholder="O plano de tratamento aparecerá aqui..."
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Botão para Gerar Contrato */}
        {!isLoading && (
          <div className="mt-6 flex justify-end">
            <Button
              size="lg"
              onClick={() => navigate("/termo-de-compromisso")}
              className="bg-success hover:bg-success/90"
            >
              <FileText className="mr-2 h-5 w-5" />
              Gerar Contrato
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanoDeTratamento;
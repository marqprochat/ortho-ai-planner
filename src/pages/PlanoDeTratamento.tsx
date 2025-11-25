import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

  const handleExportPDF = async () => {
    if (!plan) {
      toast.error("Não há conteúdo para exportar.");
      return;
    }
    setIsExporting(true);

    try {
      // Criar um elemento temporário para renderizar o conteúdo formatado
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.width = '210mm'; // Largura de uma página A4
      tempContainer.style.minHeight = '297mm'; // Altura de uma página A4
      tempContainer.style.padding = '20mm'; // Margens de 20mm
      tempContainer.style.boxSizing = 'border-box';
      tempContainer.style.background = 'white';
      tempContainer.style.fontFamily = "'Helvetica', 'Arial', sans-serif";
      tempContainer.style.fontSize = '12pt';
      tempContainer.style.lineHeight = '1.6';
      tempContainer.style.color = 'black';
      tempContainer.style.wordWrap = 'break-word';
      tempContainer.style.whiteSpace = 'pre-wrap';
      
      // Converter o conteúdo markdown em HTML básico
      const formattedContent = plan
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Negrito
        .replace(/^- (.*)$/gm, '<li style="margin: 5pt 0;">$1</li>') // Itens de lista
        .replace(/(<li.*<\/li>)+/gs, '<ul style="margin: 10pt 0; padding-left: 20pt;">$&</ul>') // Agrupar itens em listas
        .replace(/\n\n/g, '</p><p style="margin: 10pt 0;">') // Parágrafos
        .replace(/<p><(ul|li|strong)/g, '<$1') // Corrigir parágrafos antes de elementos
        .replace(/<\/(ul|li|strong)><\/p>/g, '</$1>');
      
      tempContainer.innerHTML = `<div>${formattedContent}</div>`;
      document.body.appendChild(tempContainer);

      // Usar html2canvas para capturar o conteúdo
      const canvas = await html2canvas(tempContainer, {
        scale: 2, // Alta resolução
        useCORS: true,
        logging: false,
        width: tempContainer.scrollWidth,
        height: tempContainer.scrollHeight,
        windowWidth: tempContainer.scrollWidth,
        windowHeight: tempContainer.scrollHeight,
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Criar o PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Dimensões da página A4 em mm
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Margens em mm
      const marginLeft = 20;
      const marginTop = 20;
      const marginRight = 20;
      const marginBottom = 20;
      
      // Área útil da página
      const contentWidth = pageWidth - marginLeft - marginRight;
      const contentHeight = pageHeight - marginTop - marginBottom;
      
      // Dimensões da imagem
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Converter dimensões da imagem para mm (considerando 96 DPI)
      const imgWidthMm = (imgWidth / 96) * 25.4;
      const imgHeightMm = (imgHeight / 96) * 25.4;
      
      // Calcular a proporção para caber na largura da página
      const ratio = contentWidth / imgWidthMm;
      const displayWidth = contentWidth;
      const displayHeight = imgHeightMm * ratio;
      
      // Dividir a imagem em páginas
      let position = 0;
      let isFirstPage = true;
      
      while (position < displayHeight) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        
        // Calcular a parte da imagem a ser exibida nesta página
        const sourceY = (position / displayHeight) * imgHeight;
        const sourceHeight = (contentHeight / displayHeight) * imgHeight;
        
        // Adicionar imagem à página
        pdf.addImage(
          imgData,
          'PNG',
          marginLeft,
          marginTop - (position * (contentHeight / displayHeight)),
          displayWidth,
          displayHeight
        );
        
        position += contentHeight;
        isFirstPage = false;
      }
      
      // Remover o elemento temporário
      document.body.removeChild(tempContainer);
      
      // Salvar o PDF
      pdf.save("plano-de-tratamento.pdf");
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Ocorreu um erro ao exportar o PDF.");
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
          <Button onClick={handleExportPDF} disabled={isLoading || isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Exportar para PDF
          </Button>
        </div>
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Plano de Tratamento Detalhado</h1>
          <p className="text-muted-foreground">Revise, edite e exporte o plano de tratamento gerado pela IA.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Planejamento Gerado</CardTitle>
            <CardDescription>
              Este é o plano de tratamento detalhado. Você pode editar o texto abaixo antes de exportar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Gerando plano detalhado...</p>
              </div>
            ) : (
              <div className="border rounded-md bg-muted/20">
                <Textarea
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="min-h-[600px] w-full resize-y border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-4"
                  placeholder="O plano de tratamento aparecerá aqui..."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlanoDeTratamento;
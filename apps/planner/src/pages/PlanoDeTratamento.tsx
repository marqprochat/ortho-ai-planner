import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import { patientService } from "@/services/patientService";
import { PlanningViewer } from "@/components/PlanningViewer";

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
  const [planningId, setPlanningId] = useState<string | null>(null);

  const { messages, selectedOption, selectedModel, objetivoTratamento, patientId, patientName, isDentistPlan, aparelhos } = (location.state || {}) as {
    messages: Message[];
    selectedOption: string;
    selectedModel: string;
    objetivoTratamento: string;
    patientId: string;
    patientName: string;
    isDentistPlan?: boolean;
    aparelhos?: string;
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

        // Logic to construct the appliances section instruction
        const appliancesInstruction = (isDentistPlan && aparelhos)
          ? `OBRIGATÓRIO: Nesta seção 3 (APARELHOS E ACESSÓRIOS), você deve listar EXATAMENTE e SOMENTE o que está escrito entre colchetes a seguir, sem adicionar nada, sem mudar palavras e sem inventar acessórios: [${aparelhos}]`
          : `[Liste todos os aparelhos e acessórios necessários para esta opção. Ex: Bráquetes metálicos Roth, Bandas nos molares, Elásticos intermaxilares, Mini-implantes, etc.]`;

        const systemPrompt = `Você é um Ortodontista Sênior com mais de 20 anos de experiência. Sua tarefa é detalhar um plano de tratamento com base em um diagnóstico inicial e uma opção de tratamento escolhida pelo dentista responsável.

A opção escolhida foi:
---
${selectedOption}
---

O histórico da conversa e dados do paciente são:
---
${chatHistory}
---

O objetivo do tratamento definido pelo dentista responsável é:
---
${objetivoTratamento}
---

Siga ESTRITAMENTE o seguinte formato para o plano de tratamento, usando Markdown para formatação:

**PLANO DE TRATAMENTO ORTODÔNTICO**

**1. OPÇÃO ESCOLHIDA**
- [Replique aqui o nome e a descrição da opção escolhida pelo dentista]

**2. OBJETIVO DO TRATAMENTO**
- [Refine e descreva o objetivo do tratamento com base no que foi informado pelo dentista: "${objetivoTratamento}"]

**3. APARELHOS E ACESSÓRIOS**
- ${appliancesInstruction}

**4. TEMPO ESTIMADO DE TRATAMENTO**
- [Informe o tempo total estimado em meses ou anos]

**5. FASES DO TRATAMENTO**
- **Fase 1 - [Nome da Fase, ex: Alinhamento e Nivelamento] (Duração: X meses)**
  - [Descrição detalhada dos procedimentos e objetivos desta fase]
- **Fase 2 - [Nome da Fase, ex: Correção da Sobremordida e Relação de Molares] (Duração: Y meses)**
  - [Descrição detalhada dos procedimentos e objetivos desta fase]
- **[Adicione quantas fases forem necessárias]**

**6. FASE DE CONTENÇÃO**
- [SEMPRE sugira Alinhadores Transparentes, inclusive em casos tratados com aparelhos fixos (bráquetes).]


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

        // Save the planning to the database
        if (patientId) {
          try {
            const planning = await patientService.createPlanning({
              patientId,
              title: `Planejamento - ${patientName || 'Paciente'}`,
              originalReport: selectedOption,
            });

            // Update with AI response
            await patientService.updatePlanning(planning.id, {
              status: 'COMPLETED',
              aiResponse,
            });

            setPlanningId(planning.id);
            toast.success("Planejamento salvo com sucesso!");
          } catch (saveError) {
            console.error("Error saving planning:", saveError);
            toast.error("Planejamento gerado, mas houve erro ao salvar.");
          }
        }
      } catch (error: any) {
        console.error("Error generating phased plan:", error);
        toast.error(error.message || "Falha ao gerar o plano de tratamento detalhado.");
        setPlan("Ocorreu um erro ao gerar o plano. Por favor, tente novamente.");
      } finally {
        setIsLoading(false);
      }
    };

    generatePhasedPlan();
  }, [messages, selectedOption, selectedModel, navigate, patientId, patientName]);

  const handleSavePlan = async (newPlan: string) => {
    if (planningId) {
      await patientService.updatePlanning(planningId, { aiResponse: newPlan });
      setPlan(newPlan);
    } else {
      // If not yet saved (e.g. error earlier), try to create? 
      // For now just update local state if no ID, but warn context.
      setPlan(newPlan);
      toast.warning("Não há planejamento salvo para atualizar no banco.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-20 p-8 transition-all duration-300">
        <div className="max-w-5xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="flex gap-2">
              {/* Buttons are now inside PlanningViewer, except maybe specific page-level ones if needed */}
            </div>
          </div>

          <div className="mb-8 shrink-0">
            <h1 className="text-4xl font-bold text-foreground mb-2">Plano de Tratamento Detalhado</h1>
            <p className="text-muted-foreground">Revise, edite e exporte o plano de tratamento gerado pela IA.</p>
          </div>

          <div className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Gerando plano detalhado...</p>
              </div>
            ) : (
              <PlanningViewer
                initialPlan={plan}
                patientName={patientName}
                onSave={handleSavePlan}
                showGenerateContract={true}
                onGenerateContract={() => navigate("/termo-de-compromisso", {
                  state: { patientId, planningId, patientName }
                })}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlanoDeTratamento;
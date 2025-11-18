import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

const PlanejamentoIA = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (apiKey) {
      const formDataStr = localStorage.getItem("planejamentoFormData");
      if (formDataStr) {
        const formData = JSON.parse(formDataStr);
        generateInitialDiagnosis(formData);
      }
    } else {
      toast.error("A chave de API da OpenAI não está configurada nas variáveis de ambiente (VITE_OPENAI_API_KEY).");
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateInitialDiagnosis = async (formData: any) => {
    if (!apiKey) {
      toast.error("A chave de API da OpenAI não está configurada.");
      return;
    }

    const systemPrompt = `Você é um dentista sênior especializado em ortodontia e ortopedia funcional dos maxilares, com domínio de aparelhos móveis, fixos (Roth metálico/estético), autoligados e alinhadores transparentes.

INSTRUÇÕES IMPORTANTES:
- Seja RESUMIDO e DIRETO em todas as seções
- NÃO descreva quais dentes estão presentes na radiografia panorâmica
- NÃO mencione ou indique Twin Block em nenhuma circunstância
- SEMPRE ofereça alinhadores transparentes como opção alternativa para:
  * Casos de expansão dentária em crianças
  * Casos de ortodontia corretiva (como alternativa aos braquetes)
  * Quando o dentista escolher braquetes autoligados
  * Quando o dentista escolher Expansor de Hawley ou outros expansores (como opção para crianças)

Analise os dados do paciente e forneça um diagnóstico inicial estruturado seguindo EXATAMENTE este formato:

**1. FASE DE DESENVOLVIMENTO**
- Dentição: [decídua/mista/permanente]
- Achados radiográficos: [mencione APENAS se houver dentes inclusos, em formação, cistos, etc. NÃO liste dentes presentes]

**2. MÁ-OCLUSÃO**
- Perfil facial: [breve descrição]
- Relação molar: [breve descrição]
- Relação canina: [breve descrição]
- Sobressaliência: [valor e avaliação resumida]
- Sobremordida: [valor e avaliação resumida]
- Etiologia: [descrição resumida]

**3. OBJETIVOS DO TRATAMENTO**
[Liste de forma resumida os principais objetivos]

**4. APARELHOS SELECIONADOS**
[Aparelho escolhido pelo dentista responsável]

**5. OPÇÕES DE TRATAMENTO**

**Opção 1 - Plano do Dentista Responsável**
- Aparelho: [nome]
- Vantagens: [liste de forma resumida]
- Limitações: [liste se houver, de forma resumida]
- Tempo estimado: [meses]

**Opção 2 - Alinhadores Transparentes** [SEMPRE ofereça esta opção para casos de ortodontia corretiva ou expansão]
- Justificativa: [breve justificativa de por que é uma boa alternativa]
- Vantagens: [liste de forma resumida]
- Considerações: [liste de forma resumida]

Mantenha todas as respostas CONCISAS e OBJETIVAS.`;

    const userPrompt = `Paciente: ${formData.nomePaciente}
Data de nascimento: ${formData.dataNascimento || "Não informada"}

QUEIXAS E OBJETIVOS:
${formData.queixas || "Não informadas"}

Objetivo do tratamento: ${formData.objetivoTratamento || "Não informado"}

EXAME CLÍNICO:
- Perfil facial: ${formData.perfilFacial || "Não informado"}
- Lábios: ${formData.labios || "Não informado"}
- Dentição atual: ${formData.denticaoAtual || "Não informada"}
- Sobressaliência: ${formData.sobressaliencia || "Não informada"} mm
- Sobremordida: ${formData.sobremordida || "Não informada"} mm

DIAGNÓSTICO PRELIMINAR:
- Má oclusão: ${formData.diagnostico || "Não informado"}
- Etiologia: ${formData.etiologia || "Não informada"}
- Tipo de tratamento: ${formData.tipoTratamento || "Não informado"}
- Aparelho selecionado: ${formData.aparelhoSelecionado || "Não informado"}
- Tempo estimado: ${formData.tempoEstimado || "Não informado"} meses
- Colaboração esperada: ${formData.colaboracao || "Não informada"}

CONSIDERAÇÕES ADICIONAIS:
${formData.consideracoes || "Nenhuma"}

Por favor, forneça uma análise completa seguindo o formato especificado.`;

    setIsLoading(true);
    
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Erro na API da OpenAI");
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      setMessages([
        { role: "user", content: "Gerar diagnóstico inicial" },
        { role: "assistant", content: aiResponse },
      ]);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Erro ao gerar diagnóstico. Verifique sua chave de API.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    if (!apiKey) {
      toast.error("A chave de API da OpenAI não está configurada.");
      return;
    }

    const userMessage: Message = { role: "user", content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Você é um dentista sênior especializado em ortodontia. Continue a conversa de forma profissional e baseada em evidências científicas.",
            },
            ...messages,
            userMessage,
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na API da OpenAI");
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      setMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const createPlanejamento = () => {
    const lastAssistantMessage = messages.filter(m => m.role === "assistant").pop();
    if (lastAssistantMessage) {
      localStorage.setItem("planejamentoFinal", lastAssistantMessage.content);
      toast.success("Planejamento criado com sucesso!");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Planejamento com IA - Fase 1</h1>
              <p className="text-sm text-muted-foreground">Diagnóstico e análise inicial</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {messages.length === 0 && !isLoading && (
            <Card className="bg-muted/50">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  Aguardando geração do diagnóstico inicial...
                </p>
              </CardContent>
            </Card>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card className={`max-w-[80%] ${message.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                <CardContent className="p-4">
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </CardContent>
              </Card>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <Card className="max-w-[80%]">
                <CardContent className="p-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground">Analisando...</span>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-border p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Digite sua mensagem para refinar o diagnóstico..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="min-h-[60px]"
            />
            <Button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()} size="icon" className="h-[60px] w-[60px]">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>

          {messages.filter(m => m.role === "assistant").length > 0 && (
            <div className="flex justify-end">
              <Button onClick={createPlanejamento} size="lg" className="bg-success hover:bg-success/90">
                Criar Planejamento
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanejamentoIA;
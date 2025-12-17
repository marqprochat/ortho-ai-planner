import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArrowLeft, Upload, Brain, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import { patientService } from "@/services/patientService";

// Interfaces para o Chat com IA
interface Message {
  role: "user" | "assistant";
  content: string | any[];
}

interface ImagePayload {
  type: string;
  data: string;
}

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

const initialFormData = {
  nomePaciente: "",
  dataNascimento: "",
  telefone: "",
  nCarteirinha: "",
  numeroPaciente: "",  // External ID from another application
  queixas: "",
  perfilFacial: "",
  labios: "",
  denticaoAtual: "",
  relacaoMolar: [] as string[],
  relacaoCanina: [] as string[],
  linhaMedia: [] as string[],
  sobressaliencia: "",
  sobremordida: "",
  exameClinicoIntraoral: [] as string[],
  examesComplementares: [] as string[],
  diagnostico: "",
  etiologia: "",
  tipoTratamento: "",
  aparelhoIndicado: "",
  aparelhoSelecionado: "",
  tempoEstimado: "",
  colaboracao: "",
  objetivoTratamento: "",
  consideracoes: "",
  nomeOrtodontista: "",
  croOrtodontista: "",
  dataPlanejamento: "",
};

const NovoPlanejamentoIA = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'form' | 'chat'>('form');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');

  // Estado do Formulário
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState(() => {
    const savedData = localStorage.getItem("planejamentoFormData");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      // Merge with initialFormData to ensure all array fields are initialized
      return {
        ...initialFormData,
        ...parsed,
        // Ensure arrays are always arrays
        relacaoMolar: Array.isArray(parsed.relacaoMolar) ? parsed.relacaoMolar : [],
        relacaoCanina: Array.isArray(parsed.relacaoCanina) ? parsed.relacaoCanina : [],
        linhaMedia: Array.isArray(parsed.linhaMedia) ? parsed.linhaMedia : [],
        exameClinicoIntraoral: Array.isArray(parsed.exameClinicoIntraoral) ? parsed.exameClinicoIntraoral : [],
        examesComplementares: Array.isArray(parsed.examesComplementares) ? parsed.examesComplementares : [],
      };
    }
    return initialFormData;
  });

  // Estado do Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Estado do Diálogo de Opções
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [treatmentOptions, setTreatmentOptions] = useState<string[]>([]);

  // Patient ID for persistence
  const [patientId, setPatientId] = useState<string | null>(null);

  // Efeitos do Formulário
  useEffect(() => {
    localStorage.setItem("planejamentoFormData", JSON.stringify(formData));
  }, [formData]);

  // Sincroniza as pré-visualizações com os arquivos e gerencia as Object URLs
  useEffect(() => {
    if (images.length === 0) {
      setImagePreviews([]);
      return;
    }
    const newObjectUrls = images.map(file => URL.createObjectURL(file));
    setImagePreviews(newObjectUrls);

    // Função de limpeza para revogar as URLs e evitar vazamentos de memória
    return () => {
      newObjectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [images]);

  // Efeitos do Chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (images.length + newFiles.length > 10) {
        toast.error("O limite total é de 10 imagens.");
        return;
      }
      setImages(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
  };

  const handleClearStorage = () => {
    localStorage.removeItem("planejamentoFormData");
    setFormData(initialFormData);
    setImages([]);
    toast.success("Dados do formulário limpos com sucesso!");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.substring(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d*)/, "($1) $2");
    } else {
      value = value.replace(/^(\d*)/, "($1");
    }
    setFormData({ ...formData, telefone: value });
  };

  const handleMultiSelectChange = (field: keyof typeof initialFormData, value: string) => {
    setFormData(prev => {
      const currentValues = (prev[field] as string[]) || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(item => item !== value)
        : [...currentValues, value];
      return { ...prev, [field]: newValues };
    });
  };

  const convertFilesToBase64 = (files: File[]): Promise<ImagePayload[]> => {
    const promises = files.map(file => {
      return new Promise<ImagePayload>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ type: file.type, data: reader.result as string });
        reader.onerror = error => reject(error);
      });
    });
    return Promise.all(promises);
  };

  const generateInitialDiagnosis = async () => {
    if (!formData.nomePaciente) {
      toast.error("Por favor, preencha o nome do paciente");
      return;
    }

    if (selectedModel.startsWith('gpt') && !apiKey) {
      toast.error("A chave de API da OpenAI não está configurada.");
      return;
    }

    if (selectedModel.startsWith('gemini') && !geminiKey) {
      toast.error("A chave de API do Gemini não está configurada.");
      return;
    }

    setView('chat');
    setIsLoading(true);

    try {
      // Save or find patient first
      const patientResult = await patientService.findOrCreatePatient({
        name: formData.nomePaciente,
        phone: formData.telefone || undefined,
        birthDate: formData.dataNascimento || undefined,
        externalId: formData.numeroPaciente || undefined,
      });

      setPatientId(patientResult.patient.id);

      if (patientResult.isNew) {
        toast.success("Paciente cadastrado com sucesso!");
      } else {
        toast.info("Paciente existente encontrado. Continuando com o planejamento.");
      }

      const imagePayloads = await convertFilesToBase64(images);

      const systemPrompt = `Você é um Ortodontista Sênior com mais de 20 anos de experiência, especialista em Ortopedia Funcional dos Maxilares, Ortodontia Interceptativa e Ortodontia Fixa (Roth metálico/estético), Autoligados e Alinhadores.

Sua função é analisar exames e radiografias enviados pelo usuário, interpretar informações clínicas estruturadas e retornar somente diagnósticos e planos de tratamento realistas, embasados e seguros.

REGRAS GERAIS

Nunca invente informações.
Se algo não estiver visível ou não for possível avaliar, diga claramente:
“Não é possível avaliar X com as imagens fornecidas.”

Use linguagem simples, objetiva e didática, acessível para dentistas generalistas e estudantes.

Evite jargões técnicos desnecessários.
Utilize termos clássicos, porém com explicação curta quando necessário.

Sempre entregue no máximo 3 planos de tratamento, bem estruturados.

Jamais faça diagnósticos médicos fora da odontologia.

Sempre considere todas as imagens recebidas:

radiografia panorâmica

telerradiografia lateral

fotografias intrabucais

fotografias extrabucais

documentação ortodôntica digital

modelos 3D (se enviados)
INSTRUÇÕES IMPORTANTES:
- Seja RESUMIDO e DIRETO em todas as seções
- Analise as imagens fornecidas para complementar seu diagnóstico.
- Sugira um planejamento baseado apenas nas evidências. Não quero trabalhar com possibilidades remotas
- NÃO descreva quais dentes estão presentes na radiografia panorâmica
- NÃO mencione ou indique Twin Block em nenhuma circunstância
- Na etapa de contenção, SEMPRE sugira Alinhadores Transparentes, inclusive em casos tratados com aparelhos fixos (bráquetes).
- Sempre analise as imagens primeiro e dê até duas opções conforme seja necessário, caso tenha dúvidas do aparelho, ofereça alinhadores transparentes como opção alternativa para:
  * Casos de expansão dentária em crianças
  * Casos de ortodontia corretiva (como alternativa aos braquetes)
  * Quando o dentista escolher braquetes autoligados
  * Quando o dentista escolher Expansor de Hawley ou outros expansores (como opção para crianças)

Analise os dados do paciente e forneça um diagnóstico inicial estruturado seguindo EXATAMENTE este formato:

**1. FASE DE DESENVOLVIMENTO**
- Dentição: [decídua/mista/permanente]
- Achados radiográficos: [mencione APENAS se houver dentes inclusos, em formação, cisos, etc. NÃO liste dentes presentes. SE NÃO ENCONTRAR NADA, DIGA "Não identifiquei nada a se citar."]

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

**Opção 1 - Plano do Dentista Responsável [Replique somente o que o dentista escolheu. caso não receba, informe e pule para opção 2]**
- Aparelho: [nome]
- Vantagens: [analise o planejamento escolhido pelo dentista e liste as vantagens]
- Limitações: [analise o planejamento escolhido pelo dentista e liste de forma resumida]
- Tempo estimado: [meses]

- Considerações da IA: [analise o planejamento escolhido pelo dentista e se achar necessário ou não concordar, justifique de forma breve. Não mostre caso não tenha considerações relevantes]

**Opção da IA - Crie mais uma ou duas opções com base no diagnóstico das imagens enviadas. E indique o aparelho seguido as instruções
- Justificativa: [breve justificativa de por que é uma boa alternativa]
- Vantagens: [liste de forma resumida]
- Considerações: [liste de forma resumida]

Mantenha todas as respostas CONCISAS e OBJETIVAS.`;

      const userPromptText = `
      **Dados do Paciente:**
      - Nome: ${formData.nomePaciente}
      - Data de Nascimento: ${formData.dataNascimento}
      - Telefone: ${formData.telefone}
      - Nº Carteirinha: ${formData.nCarteirinha || "N/A"}
      - Queixas: ${formData.queixas}

      **Exame Clínico Extraoral:**
      - Perfil Facial: ${formData.perfilFacial}
      - Lábios: ${formData.labios}

      **Exame Clínico Intraoral:**
      - Dentição: ${formData.denticaoAtual}
      - Relação Molar: ${formData.relacaoMolar.join(', ') || "N/A"}
      - Relação Canina: ${formData.relacaoCanina.join(', ') || "N/A"}
      - Linha Média: ${formData.linhaMedia.join(', ') || "N/A"}
      - Sobressaliência: ${formData.sobressaliencia} mm
      - Sobremordida: ${formData.sobremordida} mm
      - Outros achados: ${formData.exameClinicoIntraoral.join(', ') || "N/A"}

      **Exames Complementares Solicitados:**
      - ${formData.examesComplementares.join(', ')}

      **Diagnóstico e Tratamento:**
      - Diagnóstico (Má Oclusão): ${formData.diagnostico}
      - Etiologia: ${formData.etiologia}
      - Tipo de Tratamento: ${formData.tipoTratamento}
      - Aparelho Indicado: ${formData.aparelhoIndicado === 'Outro' ? formData.aparelhoSelecionado : formData.aparelhoIndicado}
      - Tempo Estimado: ${formData.tempoEstimado} meses
      - Colaboração Esperada: ${formData.colaboracao}
      - Considerações Adicionais: ${formData.consideracoes || "Nenhuma"}

      **Responsável Técnico:**
      - Ortodontista: ${formData.nomeOrtodontista}
      - CRO: ${formData.croOrtodontista}
      - Data: ${formData.dataPlanejamento}

      Analise os dados acima e as imagens em anexo para gerar o diagnóstico e plano de tratamento.
      `;

      const userMessageContent: any[] = [{ type: "text", text: userPromptText }];
      imagePayloads
        .filter(img => img.type.startsWith("image/"))
        .forEach(img => {
          userMessageContent.push({
            type: "image_url",
            image_url: { url: img.data },
          });
        });

      if (selectedModel.startsWith('gpt')) {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessageContent },
            ],
            temperature: 0.7,
            max_completion_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || "Erro na API da OpenAI");
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        setMessages([
          { role: "user", content: "Gerar diagnóstico inicial com base nos dados e imagens." },
          { role: "assistant", content: aiResponse },
        ]);
      } else {
        // Gemini Implementation
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: selectedModel });

        const prompt = `${systemPrompt}\n\n${userPromptText}`;

        const imageParts = imagePayloads
          .filter(img => img.type.startsWith("image/"))
          .map(img => ({
            inlineData: {
              data: img.data.split(',')[1],
              mimeType: img.type
            }
          }));

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const aiResponse = response.text();

        setMessages([
          { role: "user", content: "Gerar diagnóstico inicial com base nos dados e imagens." },
          { role: "assistant", content: aiResponse },
        ]);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Erro ao gerar diagnóstico.");
      setView('form'); // Volta para o formulário em caso de erro
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      let aiResponse = "";

      if (selectedModel.startsWith('gpt')) {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: "system", content: "Você é um dentista sênior especializado em ortodontia. Continue a conversa de forma profissional e baseada em evidências científicas." },
              ...messages.map(msg => ({
                ...msg,
                content: typeof msg.content === 'string' ? msg.content : [{ type: 'text', text: 'Análise anterior baseada em imagens e texto.' }]
              })),
              userMessage,
            ],
            temperature: 0.7,
            max_completion_tokens: 1500,
          }),
        });

        if (!response.ok) throw new Error("Erro na API da OpenAI");

        const data = await response.json();
        aiResponse = data.choices[0].message.content;
      } else {
        // Gemini Chat Implementation
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: selectedModel });

        const chat = model.startChat({
          history: messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof msg.content === 'string' ? msg.content : 'Análise anterior baseada em imagens e texto.' }]
          }))
        });

        const result = await chat.sendMessage(inputMessage);
        const response = await result.response;
        aiResponse = response.text();
      }

      setMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreatePlanejamentoDialog = () => {
    const lastAssistantMessage = messages.filter(m => m.role === "assistant").pop();
    if (lastAssistantMessage && typeof lastAssistantMessage.content === 'string') {
      const options = lastAssistantMessage.content.split(/(?=\*\*Opção)/g).filter(opt => opt.trim().startsWith('**Opção'));
      if (options.length > 0) {
        setTreatmentOptions(options);
        setIsOptionDialogOpen(true);
      } else {
        toast.error("Nenhuma opção de tratamento encontrada na resposta da IA para criar um plano.");
      }
    } else {
      toast.error("Não há uma resposta da IA para criar o planejamento.");
    }
  };

  const handleSelectOption = (option: string) => {
    setIsOptionDialogOpen(false);
    navigate("/plano-de-tratamento", {
      state: {
        messages,
        selectedOption: option,
        selectedModel,
        objetivoTratamento: formData.objetivoTratamento,
        patientId,
        patientName: formData.nomePaciente,
      },
    });
  };

  if (view === 'chat') {
    return (
      <>
        <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Escolha uma Opção</DialogTitle>
              <DialogDescription>
                Selecione uma das opções de tratamento geradas pela IA para criar um plano detalhado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4 max-h-[60vh] overflow-y-auto">
              {treatmentOptions.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full h-auto text-left justify-start p-4"
                  onClick={() => handleSelectOption(option)}
                >
                  {option.split('\n')[0].replace(/\*\*/g, '')}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsOptionDialogOpen(false)}>Cancelar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="min-h-screen bg-background flex flex-col">
          <div className="border-b border-border p-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setView('form')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao Formulário
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Planejamento com IA</h1>
                  <p className="text-sm text-muted-foreground">Diagnóstico e análise inicial</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-5xl mx-auto space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <Card className={`max-w-[80%] ${message.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                    <CardContent className="p-4"><div className="whitespace-pre-wrap">{typeof message.content === 'string' ? message.content : (message.content[0] as any).text}</div></CardContent>
                  </Card>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <Card className="max-w-[80%]"><CardContent className="p-4 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-muted-foreground">Analisando...</span></CardContent></Card>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="border-t border-border p-4 bg-background">
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex gap-2">
                <Textarea placeholder="Refine o diagnóstico..." value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} className="min-h-[60px]" />
                <Button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()} size="icon" className="h-[60px] w-[60px]">{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</Button>
              </div>
              {messages.filter(m => m.role === "assistant").length > 0 && (
                <div className="flex justify-end"><Button onClick={openCreatePlanejamentoDialog} size="lg" className="bg-success hover:bg-success/90">Criar Planejamento</Button></div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-20 p-8 transition-all duration-300">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Dashboard</Button>
            <Button variant="outline" onClick={handleClearStorage} className="text-destructive hover:text-destructive">Limpar Dados Salvos</Button>
          </div>
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Novo Planejamento</h1>
            <p className="text-muted-foreground">Preencha os dados para gerar um planejamento ortodôntico com IA</p>
            <p className="text-sm text-primary mt-2">Os dados do formulário são salvos automaticamente</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); generateInitialDiagnosis(); }} className="space-y-6">
            {/* Dados do Paciente */}
            <Card>
              <CardHeader><CardTitle>Dados do Paciente</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label htmlFor="nomePaciente">Nome do paciente *</Label><Input id="nomePaciente" required value={formData.nomePaciente} onChange={(e) => setFormData({ ...formData, nomePaciente: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="dataNascimento">Data de nascimento *</Label><Input id="dataNascimento" type="date" required value={formData.dataNascimento} onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="telefone">Telefone *</Label><Input id="telefone" required value={formData.telefone} onChange={handlePhoneChange} placeholder="(XX) XXXXX-XXXX" /></div>
                <div className="space-y-2"><Label htmlFor="nCarteirinha">Nº da carteirinha/convênio</Label><Input id="nCarteirinha" value={formData.nCarteirinha} onChange={(e) => setFormData({ ...formData, nCarteirinha: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="numeroPaciente">Número do Paciente (ID externo)</Label><Input id="numeroPaciente" value={formData.numeroPaciente} onChange={(e) => setFormData({ ...formData, numeroPaciente: e.target.value })} placeholder="Número de outro sistema" /></div>
                <div className="md:col-span-2 space-y-2"><Label htmlFor="queixas">Queixas do paciente *</Label><Textarea id="queixas" required value={formData.queixas} onChange={(e) => setFormData({ ...formData, queixas: e.target.value })} /></div>
              </CardContent>
            </Card>

            {/* Exame Clínico Extraoral */}
            <Card>
              <CardHeader><CardTitle>Exame Clínico Extraoral</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Perfil facial *</Label><Select required value={formData.perfilFacial} onValueChange={(v) => setFormData({ ...formData, perfilFacial: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Braquicefálico">Braquicefálico</SelectItem><SelectItem value="Mesocefálico">Mesocefálico</SelectItem><SelectItem value="Dolicocefálico">Dolicocefálico</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Lábios *</Label><Select required value={formData.labios} onValueChange={(v) => setFormData({ ...formData, labios: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Competentes">Competentes</SelectItem><SelectItem value="Incompetentes">Incompetentes</SelectItem></SelectContent></Select></div>
              </CardContent>
            </Card>

            {/* Exame Clínico Intraoral */}
            <Card>
              <CardHeader><CardTitle>Exame Clínico Intraoral</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2"><Label>Dentição atual *</Label><Select required value={formData.denticaoAtual} onValueChange={(v) => setFormData({ ...formData, denticaoAtual: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Decídua">Decídua</SelectItem><SelectItem value="Mista">Mista</SelectItem><SelectItem value="Permanente">Permanente</SelectItem></SelectContent></Select></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Relação molar</Label><div className="space-y-2">
                    {["Direita: Classe I", "Direita: Classe II", "Direita: Classe III", "Esquerda: Classe I", "Esquerda: Classe II", "Esquerda: Classe III"].map(item => (
                      <div key={item} className="flex items-center space-x-2"><Checkbox id={`relacaoMolar-${item}`} checked={formData.relacaoMolar.includes(item)} onCheckedChange={() => handleMultiSelectChange('relacaoMolar', item)} /><label htmlFor={`relacaoMolar-${item}`}>{item}</label></div>
                    ))}</div></div>
                  <div className="space-y-2"><Label>Relação canina</Label><div className="space-y-2">
                    {["Direita: Classe I", "Direita: Classe II", "Direita: Classe III", "Esquerda: Classe I", "Esquerda: Classe II", "Esquerda: Classe III"].map(item => (
                      <div key={item} className="flex items-center space-x-2"><Checkbox id={`relacaoCanina-${item}`} checked={formData.relacaoCanina.includes(item)} onCheckedChange={() => handleMultiSelectChange('relacaoCanina', item)} /><label htmlFor={`relacaoCanina-${item}`}>{item}</label></div>
                    ))}</div></div>
                </div>
                <div className="space-y-2"><Label>Linha média dentária</Label><div className="flex flex-wrap gap-4">
                  {["Coincidentes", "Desviado para a direita (superior)", "Desviado para a esquerda (superior)", "Desviado para a direita (inferior)", "Desviado para a esquerda (inferior)"].map(item => (
                    <div key={item} className="flex items-center space-x-2"><Checkbox id={`linhaMedia-${item}`} checked={formData.linhaMedia.includes(item)} onCheckedChange={() => handleMultiSelectChange('linhaMedia', item)} /><label htmlFor={`linhaMedia-${item}`}>{item}</label></div>
                  ))}</div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Sobressaliência em mm *</Label><Input type="number" required value={formData.sobressaliencia} onChange={(e) => setFormData({ ...formData, sobressaliencia: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Sobremordida em mm *</Label><Input type="number" required value={formData.sobremordida} onChange={(e) => setFormData({ ...formData, sobremordida: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Exame clínco intraoral (outros)</Label><div className="flex flex-wrap gap-4">
                  {["Mordida aberta", "Mordida profunda", "Mordida cruzada anterior", "Mordida cruzada posterior", "Unilateral", "Bilateral"].map(item => (
                    <div key={item} className="flex items-center space-x-2"><Checkbox id={`exameClinico-${item}`} checked={formData.exameClinicoIntraoral.includes(item)} onCheckedChange={() => handleMultiSelectChange('exameClinicoIntraoral', item)} /><label htmlFor={`exameClinico-${item}`}>{item}</label></div>
                  ))}</div></div>
              </CardContent>
            </Card>

            {/* Exames Complementares */}
            <Card>
              <CardHeader><CardTitle>Radiografias e exames complementares solicitados *</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-4">
                {["Telerradiografia em norma lateral", "Radiografia panorâmica", "Tomografia", "Fotografias intra e extraorais", "Modelos ou escaneamento digital"].map(item => (
                  <div key={item} className="flex items-center space-x-2"><Checkbox id={`exames-${item}`} checked={formData.examesComplementares.includes(item)} onCheckedChange={() => handleMultiSelectChange('examesComplementares', item)} /><label htmlFor={`exames-${item}`}>{item}</label></div>
                ))}</div></CardContent>
            </Card>

            {/* Diagnóstico e Tratamento */}
            <Card>
              <CardHeader><CardTitle>Diagnóstico e Tratamento</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2"><Label htmlFor="diagnostico">Diagnóstico - Tipo de má oclusão *</Label><Input id="diagnostico" required value={formData.diagnostico} onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Etiologia *</Label><Select required value={formData.etiologia} onValueChange={(v) => setFormData({ ...formData, etiologia: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Dentária">Dentária</SelectItem><SelectItem value="Esquelética">Esquelética</SelectItem><SelectItem value="Hábito">Hábito</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Tipo de tratamento *</Label><Select required value={formData.tipoTratamento} onValueChange={(v) => setFormData({ ...formData, tipoTratamento: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Ortodôntico">Ortodôntico</SelectItem><SelectItem value="Ortopédico funcional dos maxilares">Ortopédico funcional dos maxilares</SelectItem><SelectItem value="Interceptativos">Interceptativos</SelectItem><SelectItem value="Ortodôntico/preparo para cirurgia ortognática">Ortodôntico/preparo para cirurgia ortognática</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Aparelho indicado *</Label><Select required value={formData.aparelhoIndicado} onValueChange={(v) => setFormData({ ...formData, aparelhoIndicado: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Fixo convencional">Fixo convencional</SelectItem><SelectItem value="Fixo autoligado">Fixo autoligado</SelectItem><SelectItem value="Fixo estético">Fixo estético</SelectItem><SelectItem value="Contenção ortodôntica">Contenção ortodôntica</SelectItem><SelectItem value="Alinhadores">Alinhadores</SelectItem><SelectItem value="Ortopedia funcional">Ortopedia funcional</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent></Select></div>
                  {formData.aparelhoIndicado === 'Outro' && (<div className="space-y-2"><Label htmlFor="aparelhoSelecionado">Aparelho selecionado para o tratamento *</Label><Input id="aparelhoSelecionado" required value={formData.aparelhoSelecionado} onChange={(e) => setFormData({ ...formData, aparelhoSelecionado: e.target.value })} /></div>)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label htmlFor="tempoEstimado">Tempo estimado de tratamento em meses *</Label><Input id="tempoEstimado" required type="number" value={formData.tempoEstimado} onChange={(e) => setFormData({ ...formData, tempoEstimado: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Colaboração esperada *</Label><Select required value={formData.colaboracao} onValueChange={(v) => setFormData({ ...formData, colaboracao: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Boa">Boa</SelectItem><SelectItem value="Regular">Regular</SelectItem><SelectItem value="Difícil">Difícil</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label htmlFor="objetivoTratamento">Objetivo do tratamento *</Label><Textarea id="objetivoTratamento" required value={formData.objetivoTratamento} onChange={(e) => setFormData({ ...formData, objetivoTratamento: e.target.value })} placeholder="Ex: Paciente removeu o disjuntor, após radiografia oclusal. Damos continuidade no tratamento com aparelhos móveis." /></div>
                <div className="space-y-2"><Label htmlFor="consideracoes">Considerações adicionais (lesões, agenesias, etc)</Label><Textarea id="consideracoes" value={formData.consideracoes} onChange={(e) => setFormData({ ...formData, consideracoes: e.target.value })} /></div>
              </CardContent>
            </Card>

            {/* Responsável Técnico */}
            <Card>
              <CardHeader><CardTitle>Responsável Técnico</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2"><Label htmlFor="nomeOrtodontista">Nome do ortodontista *</Label><Input id="nomeOrtodontista" required value={formData.nomeOrtodontista} onChange={(e) => setFormData({ ...formData, nomeOrtodontista: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="croOrtodontista">CRO do ortodontista *</Label><Input id="croOrtodontista" required value={formData.croOrtodontista} onChange={(e) => setFormData({ ...formData, croOrtodontista: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="dataPlanejamento">Data *</Label><Input id="dataPlanejamento" type="date" required value={formData.dataPlanejamento} onChange={(e) => setFormData({ ...formData, dataPlanejamento: e.target.value })} /></div>
              </CardContent>
            </Card>

            {/* Upload de Imagens */}
            <Card>
              <CardHeader><CardTitle>Upload de Imagens</CardTitle><CardDescription>Faça upload das radiografias e fotos clínicas (máx. 10)</CardDescription></CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <Label htmlFor="images" className="cursor-pointer"><span className="text-primary hover:text-primary/80">Clique para fazer upload</span><span className="text-muted-foreground"> ou arraste arquivos</span></Label>
                  <Input id="images" type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <p className="text-sm text-muted-foreground mt-2">{images.length} arquivo(s) selecionado(s)</p>
                </div>
                {imagePreviews.length > 0 && (
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {imagePreviews.map((previewUrl, index) => (
                      <div key={previewUrl} className="relative group aspect-square">
                        <img src={previewUrl} alt={`Preview ${images[index]?.name || index}`} className="w-full h-full object-cover rounded-lg border" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleRemoveImage(index)}><X className="h-4 w-4" /><span className="sr-only">Remover imagem</span></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuração da IA */}
            <Card>
              <CardHeader><CardTitle>Configuração da IA</CardTitle><CardDescription>Selecione o modelo de inteligência artificial para a análise</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-2"><Label>Modelo de IA</Label><Select value={selectedModel} onValueChange={setSelectedModel}><SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger><SelectContent><SelectItem value="gpt-4o-mini">OpenAI (GPT-4o-mini)</SelectItem><SelectItem value="gpt-4o">OpenAI (GPT-4o)</SelectItem><SelectItem value="gemini-2.5-flash">Google Gemini (Flash 2.5)</SelectItem><SelectItem value="gemini-2.5-pro">Google Gemini (Pro 2.5)</SelectItem><SelectItem value="gemini-3-pro-preview">Google Gemini (Pro 3 Preview)</SelectItem></SelectContent></Select></div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" size="lg" className="gap-2" disabled={isLoading}>{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Brain className="h-5 w-5" />}Gerar Planejamento com IA</Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default NovoPlanejamentoIA;
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArrowLeft, Upload, Brain, Send, Loader2, X, MessageSquare, Stethoscope, Target, Settings, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, User, Search } from "lucide-react";
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
import { patientService, Patient } from "@/services/patientService";
import { PatientSelector } from "@/components/PatientSelector";
import { getCookie } from "@/lib/cookieUtils";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

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

  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [treatmentOptions, setTreatmentOptions] = useState<string[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isPatientSearchOpen, setIsPatientSearchOpen] = useState(false);

  // Patient ID for persistence
  const [patientId, setPatientId] = useState<string | null>(null);

  const handleSelectPatient = (patient: Patient) => {
    setFormData(prev => ({
      ...prev,
      nomePaciente: patient.name,
      dataNascimento: patient.birthDate ? patient.birthDate.split('T')[0] : "",
      telefone: patient.phone || "",
      nCarteirinha: patient.externalId || "", // mapping externalId to nCarteirinha if applicable or keep field specificity
      numeroPaciente: patient.externalId || "",
    }));
    setPatientId(patient.id);
    setIsPatientSearchOpen(false);
    toast.success(`Paciente ${patient.name} selecionado!`);
  };

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

      // Calculate total size
      const currentSize = images.reduce((acc, file) => acc + file.size, 0);
      const newFilesSize = newFiles.reduce((acc, file) => acc + file.size, 0);
      const totalSize = currentSize + newFilesSize;
      const maxSize = 45 * 1024 * 1024; // 45MB limit (leaving 5MB for JSON overhead)

      if (totalSize > maxSize) {
        toast.error(`O tamanho total das imagens excede 45MB. Tamanho atual: ${(totalSize / (1024 * 1024)).toFixed(1)}MB`);
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

    // if (selectedModel.startsWith('gpt') && !apiKey) {
    //   toast.error("A chave de API da OpenAI não está configurada.");
    //   return;
    // }

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
        const token = getCookie('token');
        const response = await fetch(`${API_URL}/ai/completion`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
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
          if (response.status === 413) {
            throw new Error("O tamanho dos arquivos enviados é muito grande (Erro 413). Tente enviar menos fotos ou reduzir a qualidade.");
          }

          const errorText = await response.text();
          try {
            // Tenta fazer o parse do JSON se possível
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.error?.message || `Erro na API: ${response.status}`);
          } catch (e) {
            // Se não for JSON (ex: HTML do Nginx), retorna o texto truncado ou msg genérica
            console.error("Erro não-JSON recebido:", errorText);
            throw new Error(`Erro no servidor (${response.status}). Verifique o console para mais detalhes.`);
          }
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
      const lastAssistantMessage = messages.filter(m => m.role === "assistant").pop();
      const optionsContext = lastAssistantMessage && typeof lastAssistantMessage.content === 'string'
        ? "\n\nMANTENHA AS OPÇÕES DE TRATAMENTO ORIGINAIS (Opção 1, Opção da IA, etc) ao final da sua resposta, mesmo se o usuário estiver apenas tirando dúvidas. Isso é crucial para que ele possa selecionar uma opção depois."
        : "";

      if (selectedModel.startsWith('gpt')) {
        const token = getCookie('token');
        const response = await fetch(`${API_URL}/ai/completion`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: "system", content: "Você é um dentista sênior especializado em ortodontia. Continue a conversa de forma profissional e baseada em evidências científicas." + optionsContext },
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

        const result = await chat.sendMessage(inputMessage + optionsContext);
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

  // Componente para Formatação da Resposta da IA
  const FormattedAIResponse = ({ content }: { content: string }) => {
    const sections = [
      { id: 'fase', title: '1. FASE DE DESENVOLVIMENTO', icon: <User className="h-5 w-5 text-blue-500" /> },
      { id: 'oclusao', title: '2. MÁ-OCLUSÃO', icon: <Stethoscope className="h-5 w-5 text-red-500" /> },
      { id: 'objetivos', title: '3. OBJETIVOS DO TRATAMENTO', icon: <Target className="h-5 w-5 text-emerald-500" /> },
      { id: 'aparelhos', title: '4. APARELHOS SELECIONADOS', icon: <Settings className="h-5 w-5 text-amber-500" /> },
      { id: 'opcoes', title: '5. OPÇÕES DE TRATAMENTO', icon: <CheckCircle2 className="h-5 w-5 text-purple-500" /> },
    ];

    // Se o conteúdo não seguir o formato padrão, renderiza como texto simples
    if (!content.includes('1. FASE DE DESENVOLVIMENTO')) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    return (
      <div className="space-y-6 py-2">
        {sections.map((section, idx) => {
          const startIdx = content.indexOf(section.title);
          if (startIdx === -1) return null;

          const nextSection = sections[idx + 1];
          const endIdx = nextSection ? content.indexOf(nextSection.title) : content.length;

          let sectionContent = content.substring(startIdx + section.title.length, endIdx).trim();

          return (
            <div key={section.id} className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center gap-3">
                {section.icon}
                <h3 className="font-bold text-foreground tracking-tight">{section.title}</h3>
              </div>
              <div className="px-5 py-4 text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {sectionContent}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (view === 'chat') {
    return (
      <>
        <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Escolha uma Opção de Tratamento</DialogTitle>
              <DialogDescription>
                Selecione a abordagem que melhor atende às necessidades do paciente para prosseguir com o planejamento detalhado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-6 max-h-[60vh] overflow-y-auto pr-2">
              {treatmentOptions.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full h-auto text-left justify-start p-4 hover:border-primary hover:bg-primary/5 transition-all group border-muted-foreground/20"
                  onClick={() => handleSelectOption(option)}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-bold text-foreground">
                        {option.split('\n')[0].replace(/\*\*/g, '').replace('Opção', 'Sugestão')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {option.split('\n')[1]?.replace('- ', '') || 'Clique para visualizar e selecionar esta opção'}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            <DialogFooter className="sm:justify-start">
              <Button variant="ghost" onClick={() => setIsOptionDialogOpen(false)}>Voltar à conversa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="min-h-screen bg-slate-50/50 flex flex-col">
          {/* Header Superior */}
          <div className="bg-white border-b border-border sticky top-0 z-10">
            <div className="max-w-4xl mx-auto w-full px-4 h-20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => setView('form')} className="hover:bg-slate-100">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Formulário
                </Button>
                <div className="h-8 w-px bg-border mx-1 hidden sm:block"></div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Análise da IA</h1>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">Diagnóstico Ortodôntico</p>
                </div>
              </div>
              <Button onClick={openCreatePlanejamentoDialog} className="bg-success hover:bg-success/90 text-white shadow-lg shadow-success/20 gap-2 px-6">
                <CheckCircle2 className="h-4 w-4" />
                Criar Planejamento
              </Button>
            </div>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto py-8">
            <div className="max-w-4xl mx-auto w-full px-4 space-y-8">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-4 max-w-[90%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center shadow-sm ${message.role === "user" ? "bg-primary text-white" : "bg-white border text-blue-600"
                      }`}>
                      {message.role === "user" ? <User className="h-5 w-5" /> : <Brain className="h-5 w-5" />}
                    </div>

                    <div className={`space-y-1 ${message.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`text-[10px] px-1 font-bold uppercase tracking-widest text-muted-foreground/60 ${message.role === "user" ? "text-right" : "text-left"}`}>
                        {message.role === "user" ? "Você" : "Assistente Ortodôntico AI"}
                      </div>
                      <Card className={`overflow-hidden border-none shadow-md ${message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-white text-foreground rounded-tl-none"
                        }`}>
                        <CardContent className="p-5">
                          {message.role === "assistant" ? (
                            <FormattedAIResponse content={typeof message.content === 'string' ? message.content : (message.content[0] as any).text} />
                          ) : (
                            <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                              {typeof message.content === 'string' ? message.content : (message.content[0] as any).text}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-4 max-w-[90%] items-center">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-white border flex items-center justify-center animate-pulse">
                      <Brain className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-3 bg-white/50 px-4 py-2 rounded-full border border-border shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Processando diagnósticos...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-10" />
            </div>
          </div>

          {/* Footer de Interação */}
          <div className="bg-white border-t border-border p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            <div className="max-w-4xl mx-auto w-full">
              {!isChatVisible ? (
                <div className="flex flex-col items-center py-2 animate-in fade-in slide-in-from-bottom-2">
                  <p className="text-sm text-muted-foreground mb-4 font-medium">Deseja tirar dúvidas ou refinar o planejamento?</p>
                  <Button
                    variant="outline"
                    onClick={() => setIsChatVisible(true)}
                    className="rounded-full px-8 py-6 h-auto border-primary/30 text-primary hover:bg-primary/5 gap-3 group"
                  >
                    <MessageSquare className="h-5 w-5 transition-transform group-hover:scale-110" />
                    Conversar com a IA
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary/70 uppercase tracking-tighter">
                      <MessageSquare className="h-3 w-3" />
                      Chat de Refinamento
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setIsChatVisible(false)} className="h-7 text-muted-foreground hover:text-foreground">
                      Ocultar chat
                    </Button>
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 relative">
                      <Textarea
                        placeholder="Ex: Como seriam os alinhadores neste caso? Ou, considere dentes supranumerários..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        className="min-h-[60px] max-h-[150px] bg-slate-50 border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary/30 resize-none pr-10 py-3 rounded-2xl"
                      />
                      <div className="absolute right-3 bottom-3 text-[10px] text-muted-foreground/50 font-medium">
                        Shift + Enter para nova linha
                      </div>
                    </div>
                    <Button
                      onClick={sendMessage}
                      disabled={isLoading || !inputMessage.trim()}
                      className={`h-[60px] w-[60px] rounded-2xl shrink-0 ${inputMessage.trim() ? "bg-primary shadow-lg shadow-primary/20" : "bg-slate-200 text-slate-400"}`}
                    >
                      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
                    </Button>
                  </div>
                </div>
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
            <div className="flex gap-2">
              <Dialog open={isPatientSearchOpen} onOpenChange={setIsPatientSearchOpen}>
                <Button variant="outline" type="button" onClick={() => setIsPatientSearchOpen(true)} className="gap-2">
                  <Search className="h-4 w-4" />
                  Buscar Paciente Existente
                </Button>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Selecionar Paciente</DialogTitle>
                    <DialogDescription>
                      Pesquise por nome e selecione um paciente para preencher o formulário.
                    </DialogDescription>
                  </DialogHeader>
                  <PatientSelector onSelect={handleSelectPatient} />
                </DialogContent>
              </Dialog>
              <Button variant="outline" type="button" onClick={handleClearStorage} className="text-destructive hover:text-destructive">Limpar Dados Salvos</Button>
            </div>
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
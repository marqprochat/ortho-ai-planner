import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Brain, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

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

const NovoPlanejamentoIA = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'form' | 'chat'>('form');

  // Estado do Formulário
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState(() => {
    const savedData = localStorage.getItem("planejamentoFormData");
    return savedData ? JSON.parse(savedData) : {
      nomePaciente: "", dataNascimento: "", telefone: "", carteirinha: "",
      queixas: "", objetivoTratamento: "", perfilFacial: "", labios: "",
      denticaoAtual: "", sobressaliencia: "", sobremordida: "",
      diagnostico: "", etiologia: "", tipoTratamento: "", aparelhoSelecionado: "",
      tempoEstimado: "", colaboracao: "", consideracoes: "",
    };
  });

  // Estado do Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    setFormData({
      nomePaciente: "", dataNascimento: "", telefone: "", carteirinha: "",
      queixas: "", objetivoTratamento: "", perfilFacial: "", labios: "",
      denticaoAtual: "", sobressaliencia: "", sobremordida: "",
      diagnostico: "", etiologia: "", tipoTratamento: "", aparelhoSelecionado: "",
      tempoEstimado: "", colaboracao: "", consideracoes: "",
    });
    setImages([]);
    toast.success("Dados do formulário limpos com sucesso!");
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
    if (!apiKey) {
      toast.error("A chave de API da OpenAI não está configurada.");
      return;
    }

    setView('chat');
    setIsLoading(true);

    try {
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

      const userPromptText = `Analise os dados do paciente e as imagens em anexo. Paciente: ${formData.nomePaciente}, Data de nascimento: ${formData.dataNascimento || "Não informada"}. Queixas: ${formData.queixas || "Não informadas"}. Objetivo: ${formData.objetivoTratamento || "Não informado"}. Perfil: ${formData.perfilFacial || "Não informado"}. Lábios: ${formData.labios || "Não informado"}. Dentição: ${formData.denticaoAtual || "Não informada"}. Sobressaliência: ${formData.sobressaliencia || "Não informada"} mm. Sobremordida: ${formData.sobremordida || "Não informada"} mm. Diagnóstico: ${formData.diagnostico || "Não informado"}. Etiologia: ${formData.etiologia || "Não informada"}. Tratamento: ${formData.tipoTratamento || "Não informado"}. Aparelho: ${formData.aparelhoSelecionado || "Não informado"}. Tempo: ${formData.tempoEstimado || "Não informado"} meses. Colaboração: ${formData.colaboracao || "Não informada"}. Considerações: ${formData.consideracoes || "Nenhuma"}.`;

      const userMessageContent: any[] = [{ type: "text", text: userPromptText }];
      imagePayloads
        .filter(img => img.type.startsWith("image/"))
        .forEach(img => {
          userMessageContent.push({
            type: "image_url",
            image_url: { url: img.data },
          });
        });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
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
    if (lastAssistantMessage && typeof lastAssistantMessage.content === 'string') {
      localStorage.setItem("planejamentoFinal", lastAssistantMessage.content);
      toast.success("Planejamento criado com sucesso!");
      navigate("/");
    } else {
      toast.error("Não foi possível salvar o planejamento.");
    }
  };

  if (view === 'chat') {
    return (
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
              <Textarea placeholder="Refine o diagnóstico..." value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} className="min-h-[60px]" />
              <Button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()} size="icon" className="h-[60px] w-[60px]">{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</Button>
            </div>
            {messages.filter(m => m.role === "assistant").length > 0 && (
              <div className="flex justify-end"><Button onClick={createPlanejamento} size="lg" className="bg-success hover:bg-success/90">Criar Planejamento</Button></div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
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
          <Card>
            <CardHeader><CardTitle>Dados do Paciente</CardTitle><CardDescription>Informações básicas do paciente</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="nomePaciente">Nome do paciente *</Label><Input id="nomePaciente" required value={formData.nomePaciente} onChange={(e) => setFormData({ ...formData, nomePaciente: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="dataNascimento">Data de nascimento</Label><Input id="dataNascimento" type="date" value={formData.dataNascimento} onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })} /></div>
            </CardContent>
          </Card>
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full"><CardHeader><CardTitle className="text-left">Detalhes Clínicos (Opcional)</CardTitle></CardHeader></CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="queixas">Queixas do paciente</Label><Textarea id="queixas" value={formData.queixas} onChange={(e) => setFormData({ ...formData, queixas: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="objetivoTratamento">Objetivo do tratamento</Label><Textarea id="objetivoTratamento" value={formData.objetivoTratamento} onChange={(e) => setFormData({ ...formData, objetivoTratamento: e.target.value })} /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Perfil facial</Label><Select value={formData.perfilFacial} onValueChange={(v) => setFormData({ ...formData, perfilFacial: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="reto">Reto</SelectItem><SelectItem value="convexo">Convexo</SelectItem><SelectItem value="concavo">Côncavo</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Dentição atual</Label><Select value={formData.denticaoAtual} onValueChange={(v) => setFormData({ ...formData, denticaoAtual: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="decidua">Decídua</SelectItem><SelectItem value="mista">Mista</SelectItem><SelectItem value="permanente">Permanente</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Sobressaliência (mm)</Label><Input type="number" value={formData.sobressaliencia} onChange={(e) => setFormData({ ...formData, sobressaliencia: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Sobremordida (mm)</Label><Input type="number" value={formData.sobremordida} onChange={(e) => setFormData({ ...formData, sobremordida: e.target.value })} /></div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full"><CardHeader><CardTitle className="text-left">Diagnóstico e Tratamento (Opcional)</CardTitle></CardHeader></CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="diagnostico">Diagnóstico - Tipo de má oclusão</Label><Input id="diagnostico" value={formData.diagnostico} onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })} /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Tipo de tratamento</Label><Select value={formData.tipoTratamento} onValueChange={(v) => setFormData({ ...formData, tipoTratamento: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="preventivo">Preventivo</SelectItem><SelectItem value="interceptativo">Interceptativo</SelectItem><SelectItem value="corretivo">Corretivo</SelectItem><SelectItem value="orto-cirurgico">Orto-cirúrgico</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Aparelho selecionado</Label><Input value={formData.aparelhoSelecionado} onChange={(e) => setFormData({ ...formData, aparelhoSelecionado: e.target.value })} placeholder="Ex: Fixo metálico" /></div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
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
                      <img
                        src={previewUrl}
                        alt={`Preview ${images[index]?.name || index}`}
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveImage(index)}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remover imagem</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" size="lg" className="gap-2" disabled={isLoading}>{isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Brain className="h-5 w-5" />}Gerar Planejamento com IA</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoPlanejamentoIA;
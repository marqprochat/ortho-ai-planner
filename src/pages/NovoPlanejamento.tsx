import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

const NovoPlanejamento = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    // Dados do Paciente
    nomePaciente: "",
    dataNascimento: "",
    telefone: "",
    carteirinha: "",
    
    // Queixas
    queixas: "",
    objetivoTratamento: "",
    
    // Exame Extraoral
    perfilFacial: "",
    labios: "",
    
    // Exame Intraoral
    denticaoAtual: "",
    relacaoMolarDireita: [] as string[],
    relacaoMolarEsquerda: [] as string[],
    relacaoCaninaDireita: [] as string[],
    relacaoCaninaEsquerda: [] as string[],
    linhaMedia: [] as string[],
    sobressaliencia: "",
    sobremordida: "",
    achados: [] as string[],
    
    // Radiografias
    examesSolicitados: [] as string[],
    
    // Diagnóstico
    diagnostico: "",
    etiologia: "",
    tipoTratamento: "",
    aparelhoIndicado: "",
    aparelhoSelecionado: "",
    tempoEstimado: "",
    colaboracao: "",
    consideracoes: "",
    
    // Ortodontista
    nomeOrtodontista: "",
    cro: "",
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nomePaciente) {
      toast.error("Por favor, preencha o nome do paciente");
      return;
    }

    // Convert images to Base64 to store and send them
    const imagePromises = images.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
        reader.onerror = error => reject(error);
      });
    });

    try {
      const imagePayloads = await Promise.all(imagePromises);
      
      // Check localStorage limit (approx 5MB)
      const payloadSize = JSON.stringify(imagePayloads).length;
      if (payloadSize > 5 * 1024 * 1024) {
        toast.error("O tamanho total das imagens excede o limite de 5MB. Por favor, selecione menos imagens ou imagens menores.");
        return;
      }

      localStorage.setItem("planejamentoFormData", JSON.stringify(formData));
      localStorage.setItem("planejamentoImages", JSON.stringify(imagePayloads));
      
      navigate("/planejamento-ia");
    } catch (error) {
      console.error("Error converting images:", error);
      toast.error("Ocorreu um erro ao processar as imagens.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Novo Planejamento</h1>
          <p className="text-muted-foreground">Preencha os dados para gerar um planejamento ortodôntico com IA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Paciente */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Paciente</CardTitle>
              <CardDescription>Informações básicas do paciente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nomePaciente">Nome do paciente *</Label>
                  <Input
                    id="nomePaciente"
                    required
                    value={formData.nomePaciente}
                    onChange={(e) => setFormData({ ...formData, nomePaciente: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data de nascimento</Label>
                  <Input
                    id="dataNascimento"
                    type="date"
                    value={formData.dataNascimento}
                    onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carteirinha">Nº da carteirinha/convênio</Label>
                  <Input
                    id="carteirinha"
                    value={formData.carteirinha}
                    onChange={(e) => setFormData({ ...formData, carteirinha: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Queixas do Paciente */}
          <Card>
            <CardHeader>
              <CardTitle>Queixas do Paciente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="queixas">Descreva as queixas do paciente</Label>
                <Textarea
                  id="queixas"
                  rows={3}
                  value={formData.queixas}
                  onChange={(e) => setFormData({ ...formData, queixas: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objetivoTratamento">Objetivo do tratamento</Label>
                <Textarea
                  id="objetivoTratamento"
                  rows={3}
                  value={formData.objetivoTratamento}
                  onChange={(e) => setFormData({ ...formData, objetivoTratamento: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Exame Clínico Extraoral */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader>
                  <CardTitle className="text-left">Exame Clínico Extraoral (Opcional)</CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="perfilFacial">Perfil facial</Label>
                      <Select value={formData.perfilFacial} onValueChange={(v) => setFormData({ ...formData, perfilFacial: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reto">Reto</SelectItem>
                          <SelectItem value="convexo">Convexo</SelectItem>
                          <SelectItem value="concavo">Côncavo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="labios">Lábios</Label>
                      <Select value={formData.labios} onValueChange={(v) => setFormData({ ...formData, labios: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="competentes">Competentes</SelectItem>
                          <SelectItem value="incompetentes">Incompetentes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Exame Clínico Intraoral */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader>
                  <CardTitle className="text-left">Exame Clínico Intraoral (Opcional)</CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="denticaoAtual">Dentição atual</Label>
                    <Select value={formData.denticaoAtual} onValueChange={(v) => setFormData({ ...formData, denticaoAtual: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="decidua">Decídua</SelectItem>
                        <SelectItem value="mista">Mista</SelectItem>
                        <SelectItem value="permanente">Permanente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Sobressaliência (mm)</Label>
                      <Input
                        type="number"
                        value={formData.sobressaliencia}
                        onChange={(e) => setFormData({ ...formData, sobressaliencia: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sobremordida (mm)</Label>
                      <Input
                        type="number"
                        value={formData.sobremordida}
                        onChange={(e) => setFormData({ ...formData, sobremordida: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Diagnóstico e Tratamento */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader>
                  <CardTitle className="text-left">Diagnóstico e Tipo de Tratamento (Opcional)</CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="diagnostico">Diagnóstico - Tipo de má oclusão</Label>
                    <Input
                      id="diagnostico"
                      value={formData.diagnostico}
                      onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Etiologia</Label>
                      <Select value={formData.etiologia} onValueChange={(v) => setFormData({ ...formData, etiologia: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="genetica">Genética</SelectItem>
                          <SelectItem value="habitos">Hábitos deletérios</SelectItem>
                          <SelectItem value="respiratoria">Respiratória</SelectItem>
                          <SelectItem value="trauma">Trauma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de tratamento</Label>
                      <Select value={formData.tipoTratamento} onValueChange={(v) => setFormData({ ...formData, tipoTratamento: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="preventivo">Preventivo</SelectItem>
                          <SelectItem value="interceptativo">Interceptativo</SelectItem>
                          <SelectItem value="corretivo">Corretivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="aparelhoSelecionado">Aparelho selecionado para o tratamento</Label>
                    <Input
                      id="aparelhoSelecionado"
                      value={formData.aparelhoSelecionado}
                      onChange={(e) => setFormData({ ...formData, aparelhoSelecionado: e.target.value })}
                      placeholder="Ex: Aparelho fixo metálico, alinhadores, etc."
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tempo estimado (meses)</Label>
                      <Input
                        type="number"
                        value={formData.tempoEstimado}
                        onChange={(e) => setFormData({ ...formData, tempoEstimado: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Colaboração esperada</Label>
                      <Select value={formData.colaboracao} onValueChange={(v) => setFormData({ ...formData, colaboracao: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="baixa">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="consideracoes">Considerações adicionais</Label>
                    <Textarea
                      id="consideracoes"
                      rows={3}
                      value={formData.consideracoes}
                      onChange={(e) => setFormData({ ...formData, consideracoes: e.target.value })}
                      placeholder="Lesões, agenesias, etc."
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Upload de Imagens */}
          <Card>
            <CardHeader>
              <CardTitle>Upload de Imagens e PDFs</CardTitle>
              <CardDescription>Faça upload das radiografias e fotos clínicas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <Label htmlFor="images" className="cursor-pointer">
                    <span className="text-primary hover:text-primary/80">Clique para fazer upload</span>
                    <span className="text-muted-foreground"> ou arraste arquivos</span>
                  </Label>
                  <Input
                    id="images"
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {images.length} arquivo(s) selecionado(s)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" size="lg" className="gap-2">
              <Brain className="h-5 w-5" />
              Gerar Planejamento com IA
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoPlanejamento;
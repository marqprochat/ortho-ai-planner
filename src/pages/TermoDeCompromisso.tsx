import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, FileDown, Edit3, Eye, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import jsPDF from 'jspdf';

interface ContractData {
    // Logo
    logoPreview: string;
    // Paciente
    nomePaciente: string;
    responsavel: string;
    endereco: string;
    cep: string;
    cpf: string;
    // Clínica
    nomeClinica: string;
    croClinica: string;
    naturezaServico: string;
    // Dentista (auto-preenchido)
    nomeDentista: string;
    croDentista: string;
    // Tratamento
    tempoEstimado: string;
    objetivo: string;
    // Valores
    valorAparelhos: string;
    valorMensalidade: string;
    valorQuebraDanos: string;
    // Data
    cidade: string;
    dataContrato: string;
}

const initialContractData: ContractData = {
    logoPreview: "",
    nomePaciente: "",
    responsavel: "",
    endereco: "",
    cep: "",
    cpf: "",
    nomeClinica: "",
    croClinica: "",
    naturezaServico: "Prestação de serviços profissionais na área de Ortopedia",
    nomeDentista: "",
    croDentista: "",
    tempoEstimado: "",
    objetivo: "",
    valorAparelhos: "",
    valorMensalidade: "",
    valorQuebraDanos: "",
    cidade: "Campinas",
    dataContrato: "",
};

const TermoDeCompromisso = () => {
    const navigate = useNavigate();
    const [view, setView] = useState<'form' | 'preview'>('form');
    const [isEditing, setIsEditing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [contractData, setContractData] = useState<ContractData>(initialContractData);
    const [editableContract, setEditableContract] = useState("");
    const [logoFile, setLogoFile] = useState<File | null>(null);

    // Auto-preencher dados do localStorage
    useEffect(() => {
        const savedFormData = localStorage.getItem("planejamentoFormData");
        if (savedFormData) {
            const parsed = JSON.parse(savedFormData);
            setContractData(prev => ({
                ...prev,
                nomePaciente: parsed.nomePaciente || "",
                nomeDentista: parsed.nomeOrtodontista || "",
                croDentista: parsed.croOrtodontista || "",
                tempoEstimado: parsed.tempoEstimado || "",
                objetivo: parsed.objetivoTratamento || "",
            }));
        }

        // Data atual formatada
        const hoje = new Date();
        const dataFormatada = hoje.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        setContractData(prev => ({
            ...prev,
            dataContrato: dataFormatada,
        }));
    }, []);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            const reader = new FileReader();
            reader.onload = () => {
                setContractData(prev => ({
                    ...prev,
                    logoPreview: reader.result as string
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setContractData(prev => ({
            ...prev,
            logoPreview: ""
        }));
    };

    const handleInputChange = (field: keyof ContractData, value: string) => {
        setContractData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 8) value = value.substring(0, 8);
        if (value.length > 5) {
            value = value.replace(/^(\d{5})(\d{0,3}).*/, "$1-$2");
        }
        setContractData(prev => ({ ...prev, cep: value }));
    };

    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 11) value = value.substring(0, 11);
        if (value.length > 9) {
            value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, "$1.$2.$3-$4");
        } else if (value.length > 6) {
            value = value.replace(/^(\d{3})(\d{3})(\d{0,3}).*/, "$1.$2.$3");
        } else if (value.length > 3) {
            value = value.replace(/^(\d{3})(\d{0,3}).*/, "$1.$2");
        }
        setContractData(prev => ({ ...prev, cpf: value }));
    };

    const handleCurrencyChange = (field: keyof ContractData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value) {
            const numValue = parseInt(value) / 100;
            value = numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        setContractData(prev => ({ ...prev, [field]: value }));
    };

    const generateContractText = (): string => {
        const {
            nomePaciente, responsavel, endereco, cep, cpf,
            nomeClinica, croClinica, naturezaServico,
            nomeDentista, croDentista,
            tempoEstimado, objetivo,
            valorAparelhos, valorMensalidade, valorQuebraDanos,
            cidade, dataContrato
        } = contractData;

        return `TERMO DE COMPROMISSO PARA EXECUÇÃO DE TRATAMENTO ODONTOLÓGICO – ORTODÔNTICO/ORTOPÉDICO

As normas do presente Termo visam reger com clareza as condições gerais de tratamento. Essas normas possibilitam ao paciente e/ou responsáveis pelo mesmo, uma realização eficiente, tranquila e confiante de tratamento.

DADOS DAS PARTES

Paciente: ${nomePaciente}
Responsável: ${responsavel}
Residente domiciliado: ${endereco}
CEP: ${cep}

Clínica/Prestador de Serviço: ${nomeClinica}, CRO ${croClinica}
Natureza do Serviço: ${naturezaServico}

CLÁUSULAS E CONDIÇÕES

1 - TEMPO DE TRATAMENTO
O prazo estimado para a fase atual do tratamento é de aproximadamente ${tempoEstimado} meses.

2 - OBRIGAÇÕES DO PACIENTE
O paciente se compromete a:
   1. Comparecer pontualmente às consultas previamente marcadas (o não comparecimento mensal compromete os resultados);
   2. Seguir rigorosamente as orientações e prescrições indicadas pelo dentista;
   3. Agendar mensalmente.

CLÁUSULA DE ABANDONO: O não comparecimento a três (03) sessões consecutivas, sem motivo justificável, autoriza a dentista a considerar abandono tácito, com rescisão automática do acordo. Isenta a dentista de responsabilidade, despesas de agravamento e não há devolução de quantias pagas.

3 - ALERTA SOBRE REABSORÇÕES RADICULARES
Fica o paciente cientificado sobre a possibilidade de pequenas reabsorções radiculares (redução da raiz do dente) e arredondamento do ápice radicular (ponta da raiz), resultantes da movimentação ortodôntica.

4 - ALERTA SOBRE HIGIENE BUCAL E CÁRIES
Os aparelhos não danificam os dentes, mas facilitam o acúmulo de placa bacteriana. O paciente se compromete a:
   • Evitar dieta rica em açúcares;
   • Realizar diariamente a correta escovação;
   • Consultar um dentista clínico geral a cada seis (6) meses para controle periódico (profilaxia).

O aparecimento de manchas, lesões de cárie ou outras, devido ao não cumprimento dessas condições, será de inteira e única responsabilidade do paciente.

5 - ALERTA SOBRE ARTICULAÇÃO TEMPORO MANDIBULAR (ATM)
Estalos e ruídos da ATM podem não ser eliminados após o tratamento. O objetivo é livrar o paciente da sintomatologia dolorosa e, quando possível, eliminar os ruídos articulares. Ruídos podem aparecer durante ou após o tratamento, associados à instabilidade da oclusão e/ou apertamento dental (bruxismo) devido a estresse/tensão.

6 - OBJETIVO
${objetivo}

7 - PAGAMENTO
   • Valor do tratamento (aparelhos): R$ ${valorAparelhos} (referente ao aparelho superior e inferior)
   • Mensalidade: R$ ${valorMensalidade} (a partir da data de instalação)
   • Quebra/Danos no aparelho: Será cobrado R$ ${valorQuebraDanos} por aparelho novo (cada)
   • Acompanhamento Pós-tratamento: Após a remoção, é indicado o acompanhamento anual.

ENCERRAMENTO

E por assim estarem justos e acordados, assinam o presente em duas vias de igual teor.

${cidade}, ${dataContrato}.


_______________________________          _______________________________
Paciente: ${nomePaciente}                Responsável: ${responsavel}
                                         CPF: ${cpf}


_______________________________
Dentista: ${nomeDentista}
CRO: ${croDentista}`;
    };

    const handleGeneratePreview = () => {
        if (!contractData.nomePaciente) {
            toast.error("Por favor, preencha o nome do paciente.");
            return;
        }
        if (!contractData.nomeClinica) {
            toast.error("Por favor, preencha o nome da clínica.");
            return;
        }
        setEditableContract(generateContractText());
        setView('preview');
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 20;
            const contentWidth = pageWidth - margin * 2;
            let cursorY = margin;

            // Logo
            if (contractData.logoPreview) {
                const logoWidth = 40;
                const logoHeight = 20;
                pdf.addImage(contractData.logoPreview, 'PNG', (pageWidth - logoWidth) / 2, cursorY, logoWidth, logoHeight);
                cursorY += logoHeight + 10;
            }

            // Título principal
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            const titulo = "TERMO DE COMPROMISSO PARA EXECUÇÃO DE TRATAMENTO ODONTOLÓGICO – ORTODÔNTICO/ORTOPÉDICO";
            const tituloLines = pdf.splitTextToSize(titulo, contentWidth);
            tituloLines.forEach((line: string) => {
                pdf.text(line, pageWidth / 2, cursorY, { align: 'center' });
                cursorY += 6;
            });
            cursorY += 5;

            // Linha separadora
            pdf.setDrawColor(100, 100, 100);
            pdf.line(margin, cursorY, pageWidth - margin, cursorY);
            cursorY += 8;

            // Texto do contrato
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');

            const contractText = isEditing ? editableContract : generateContractText();
            const lines = contractText.split('\n');

            lines.forEach((line) => {
                if (cursorY + 6 > pageHeight - margin) {
                    pdf.addPage();
                    cursorY = margin;
                }

                // Detecta títulos e subtítulos
                if (line.match(/^\d+ -/) || line.includes('CLÁUSULA') || line === 'DADOS DAS PARTES' || line === 'CLÁUSULAS E CONDIÇÕES' || line === 'ENCERRAMENTO') {
                    pdf.setFont('helvetica', 'bold');
                    cursorY += 3;
                } else {
                    pdf.setFont('helvetica', 'normal');
                }

                const wrappedLines = pdf.splitTextToSize(line, contentWidth);
                wrappedLines.forEach((wrappedLine: string) => {
                    if (cursorY + 5 > pageHeight - margin) {
                        pdf.addPage();
                        cursorY = margin;
                    }
                    pdf.text(wrappedLine, margin, cursorY);
                    cursorY += 5;
                });
            });

            // Rodapé com numeração
            const pageCount = pdf.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'italic');
                pdf.setTextColor(150, 150, 150);
                pdf.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                pdf.setTextColor(0, 0, 0);
            }

            pdf.save("termo-de-compromisso.pdf");
            toast.success("PDF exportado com sucesso!");
        } catch (error) {
            console.error("Error exporting PDF:", error);
            toast.error("Erro ao exportar PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    if (view === 'preview') {
        return (
            <div className="min-h-screen bg-background p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <Button variant="ghost" onClick={() => setView('form')}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Voltar ao Formulário
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsEditing(!isEditing)}
                            >
                                {isEditing ? <Eye className="mr-2 h-4 w-4" /> : <Edit3 className="mr-2 h-4 w-4" />}
                                {isEditing ? "Visualizar" : "Editar"}
                            </Button>
                            <Button onClick={handleExportPDF} disabled={isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                Exportar PDF
                            </Button>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Termo de Compromisso</CardTitle>
                            <CardDescription>
                                {isEditing ? "Edite o contrato conforme necessário" : "Visualize o contrato antes de exportar"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {contractData.logoPreview && (
                                <div className="flex justify-center mb-6">
                                    <img
                                        src={contractData.logoPreview}
                                        alt="Logo da empresa"
                                        className="max-h-20 object-contain"
                                    />
                                </div>
                            )}

                            {isEditing ? (
                                <Textarea
                                    value={editableContract}
                                    onChange={(e) => setEditableContract(e.target.value)}
                                    className="min-h-[600px] font-mono text-sm"
                                />
                            ) : (
                                <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed border rounded-lg p-6 bg-white dark:bg-gray-900">
                                    {editableContract}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <Button variant="ghost" onClick={() => navigate(-1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>
                </div>

                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-foreground mb-2">Termo de Compromisso</h1>
                    <p className="text-muted-foreground">Preencha os dados para gerar o contrato de tratamento ortodôntico</p>
                </div>

                <div className="space-y-6">
                    {/* Logo da Empresa */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Logo/Emblema da Empresa</CardTitle>
                            <CardDescription>Faça upload do logo para aparecer no cabeçalho do contrato</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {contractData.logoPreview ? (
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img
                                            src={contractData.logoPreview}
                                            alt="Preview do logo"
                                            className="h-20 object-contain border rounded-lg p-2"
                                        />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-6 w-6"
                                            onClick={handleRemoveLogo}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{logoFile?.name}</p>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                                    <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <Label htmlFor="logo" className="cursor-pointer">
                                        <span className="text-primary hover:text-primary/80">Clique para fazer upload</span>
                                        <span className="text-muted-foreground"> ou arraste a imagem</span>
                                    </Label>
                                    <Input
                                        id="logo"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleLogoUpload}
                                    />
                                    <p className="text-sm text-muted-foreground mt-2">PNG, JPG ou SVG (máx. 2MB)</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Dados do Paciente */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados do Paciente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="nomePaciente">Nome do Paciente *</Label>
                                    <Input
                                        id="nomePaciente"
                                        value={contractData.nomePaciente}
                                        onChange={(e) => handleInputChange('nomePaciente', e.target.value)}
                                        placeholder="Nome completo do paciente"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="responsavel">Responsável</Label>
                                    <Input
                                        id="responsavel"
                                        value={contractData.responsavel}
                                        onChange={(e) => handleInputChange('responsavel', e.target.value)}
                                        placeholder="Nome do responsável (se menor)"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endereco">Endereço</Label>
                                <Input
                                    id="endereco"
                                    value={contractData.endereco}
                                    onChange={(e) => handleInputChange('endereco', e.target.value)}
                                    placeholder="Rua, número, bairro, cidade - Estado"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cep">CEP</Label>
                                    <Input
                                        id="cep"
                                        value={contractData.cep}
                                        onChange={handleCepChange}
                                        placeholder="00000-000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cpf">CPF do Responsável</Label>
                                    <Input
                                        id="cpf"
                                        value={contractData.cpf}
                                        onChange={handleCpfChange}
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dados da Clínica */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados da Clínica</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="nomeClinica">Nome da Clínica *</Label>
                                    <Input
                                        id="nomeClinica"
                                        value={contractData.nomeClinica}
                                        onChange={(e) => handleInputChange('nomeClinica', e.target.value)}
                                        placeholder="Ex: DentalKids"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="croClinica">CRO da Clínica</Label>
                                    <Input
                                        id="croClinica"
                                        value={contractData.croClinica}
                                        onChange={(e) => handleInputChange('croClinica', e.target.value)}
                                        placeholder="Ex: 9382"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="naturezaServico">Natureza do Serviço</Label>
                                <Input
                                    id="naturezaServico"
                                    value={contractData.naturezaServico}
                                    onChange={(e) => handleInputChange('naturezaServico', e.target.value)}
                                />
                            </div>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="nomeDentista">Nome do Dentista</Label>
                                    <Input
                                        id="nomeDentista"
                                        value={contractData.nomeDentista}
                                        onChange={(e) => handleInputChange('nomeDentista', e.target.value)}
                                        placeholder="Auto-preenchido do formulário"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="croDentista">CRO do Dentista</Label>
                                    <Input
                                        id="croDentista"
                                        value={contractData.croDentista}
                                        onChange={(e) => handleInputChange('croDentista', e.target.value)}
                                        placeholder="Auto-preenchido do formulário"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tratamento */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalhes do Tratamento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="tempoEstimado">Tempo Estimado (meses)</Label>
                                <Input
                                    id="tempoEstimado"
                                    type="number"
                                    value={contractData.tempoEstimado}
                                    onChange={(e) => handleInputChange('tempoEstimado', e.target.value)}
                                    placeholder="Auto-preenchido do formulário"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="objetivo">Objetivo do Tratamento (Fase Atual)</Label>
                                <Textarea
                                    id="objetivo"
                                    value={contractData.objetivo}
                                    onChange={(e) => handleInputChange('objetivo', e.target.value)}
                                    placeholder="Ex: Paciente removeu o disjuntor, após radiografia oclusal. Damos a continuidade no tratamento com aparelhos móveis."
                                    className="min-h-[100px]"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Valores */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Valores do Tratamento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="valorAparelhos">Valor dos Aparelhos (R$)</Label>
                                    <Input
                                        id="valorAparelhos"
                                        value={contractData.valorAparelhos}
                                        onChange={handleCurrencyChange('valorAparelhos')}
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="valorMensalidade">Mensalidade (R$)</Label>
                                    <Input
                                        id="valorMensalidade"
                                        value={contractData.valorMensalidade}
                                        onChange={handleCurrencyChange('valorMensalidade')}
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="valorQuebraDanos">Quebra/Danos (R$)</Label>
                                    <Input
                                        id="valorQuebraDanos"
                                        value={contractData.valorQuebraDanos}
                                        onChange={handleCurrencyChange('valorQuebraDanos')}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Local e Data */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Local e Data</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cidade">Cidade</Label>
                                    <Input
                                        id="cidade"
                                        value={contractData.cidade}
                                        onChange={(e) => handleInputChange('cidade', e.target.value)}
                                        placeholder="Campinas"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dataContrato">Data</Label>
                                    <Input
                                        id="dataContrato"
                                        value={contractData.dataContrato}
                                        onChange={(e) => handleInputChange('dataContrato', e.target.value)}
                                        placeholder="Auto-preenchido com a data atual"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Botão Gerar Preview */}
                    <div className="flex justify-end">
                        <Button size="lg" onClick={handleGeneratePreview}>
                            <Eye className="mr-2 h-5 w-5" />
                            Gerar Preview do Contrato
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermoDeCompromisso;

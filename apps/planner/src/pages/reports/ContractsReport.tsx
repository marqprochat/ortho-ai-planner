import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Download, Filter, ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reportService } from "@/services/reportService";
import Sidebar from "@/components/Sidebar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { jsPDF } from "jspdf";

const ContractsReport = () => {
    const [searchParams] = useSearchParams();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isSigned, setIsSigned] = useState(searchParams.get("isSigned") || "ALL");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });

    const fetchData = async () => {
        setLoading(true);
        try {
            const results = await reportService.getContractsReport({
                search,
                isSigned: isSigned === "ALL" ? undefined : (isSigned === "true"),
                startDate: dateRange.start || undefined,
                endDate: dateRange.end || undefined
            });
            setData(results);
        } catch (error) {
            console.error("Error fetching report:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [search, isSigned, dateRange]);

    const downloadCSV = () => {
        const headers = ["ID", "Paciente", "Status", "Data Criação", "Data Assinatura"];
        const rows = data.map(c => [
            c.id,
            c.patient?.name || "-",
            c.isSigned ? "Assinado" : "Pendente",
            format(new Date(c.createdAt), "dd/MM/yyyy"),
            c.signedAt ? format(new Date(c.signedAt), "dd/MM/yyyy") : "-"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_contratos_${format(new Date(), "yyyyMMdd")}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Relatório de Contratos", 14, 22);
        doc.setFontSize(11);
        doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);

        let y = 40;
        doc.setFontSize(10);
        doc.text("Paciente", 14, y);
        doc.text("Status", 70, y);
        doc.text("Criado Em", 110, y);
        doc.text("Assinado Em", 150, y);
        doc.line(14, y + 2, 196, y + 2);
        y += 10;

        data.forEach((c, i) => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text((c.patient?.name || "-").substring(0, 25), 14, y);
            doc.text(c.isSigned ? "Assinado" : "Pendente", 70, y);
            doc.text(format(new Date(c.createdAt), "dd/MM-yyyy"), 110, y);
            doc.text(c.signedAt ? format(new Date(c.signedAt), "dd/MM-yyyy") : "-", 150, y);
            y += 8;
        });

        doc.save(`relatorio_contratos_${format(new Date(), "yyyyMMdd")}.pdf`);
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Sidebar />
            <main className="ml-20 p-8 flex-1 transition-all duration-300">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <Link to="/" className="flex items-center text-primary hover:underline mb-2">
                            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Dashboard
                        </Link>
                        <h2 className="text-3xl font-bold text-foreground">Relatório de Contratos</h2>
                        <p className="text-muted-foreground">Listagem detalhada dos contratos gerados e status de assinatura</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={downloadCSV}>
                            <Download className="h-4 w-4 mr-2" /> CSV
                        </Button>
                        <Button variant="outline" onClick={downloadPDF}>
                            <Download className="h-4 w-4 mr-2" /> PDF
                        </Button>
                    </div>
                </div>

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                            <Filter className="h-5 w-5 mr-2" /> Filtros
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar paciente..."
                                className="pl-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={isSigned} onValueChange={setIsSigned}>
                            <SelectTrigger>
                                <SelectValue placeholder="Assinatura" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os Contratos</SelectItem>
                                <SelectItem value="true">Assinados</SelectItem>
                                <SelectItem value="false">Pendentes</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            type="date"
                            placeholder="De"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <Input
                            type="date"
                            placeholder="Até"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        />
                        <Button onClick={fetchData} className="w-full">Filtrar</Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>Nº Paciente</TableHead>
                                    <TableHead>Criado Em</TableHead>
                                    <TableHead>Assinado?</TableHead>
                                    <TableHead>Data Assinatura</TableHead>
                                    <TableHead>Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">Carregando contratos...</TableCell>
                                    </TableRow>
                                ) : data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum dado encontrado</TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">{c.patient?.name || "-"}</TableCell>
                                            <TableCell>{c.patient?.patientNumber || "-"}</TableCell>
                                            <TableCell>{format(new Date(c.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.isSigned
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {c.isSigned ? 'Assinado' : 'Pendente'}
                                                </span>
                                            </TableCell>
                                            <TableCell>{c.signedAt ? format(new Date(c.signedAt), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                                            <TableCell>
                                                <Link to={`/patients/${c.patientId}`}>
                                                    <Button variant="ghost" size="sm">Ver Paciente</Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default ContractsReport;

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Download, Filter, ArrowLeft, Brain } from "lucide-react";
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

const PlanningsReport = () => {
    const [searchParams] = useSearchParams();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState(searchParams.get("status") || "ALL");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });

    const fetchData = async () => {
        setLoading(true);
        try {
            const results = await reportService.getPlanningsReport({
                search,
                status: status === "ALL" ? undefined : status,
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
    }, [search, status, dateRange]);

    const downloadCSV = () => {
        const headers = ["ID", "Título", "Paciente", "Status", "Data"];
        const rows = data.map(p => [
            p.id,
            p.title,
            p.patient?.name || "-",
            p.status,
            format(new Date(p.createdAt), "dd/MM/yyyy HH:mm")
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_planejamentos_${format(new Date(), "yyyyMMdd")}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Relatório de Planejamentos", 14, 22);
        doc.setFontSize(11);
        doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);

        let y = 40;
        doc.setFontSize(10);
        doc.text("Paciente", 14, y);
        doc.text("Título", 70, y);
        doc.text("Status", 130, y);
        doc.text("Data", 170, y);
        doc.line(14, y + 2, 196, y + 2);
        y += 10;

        data.forEach((p, i) => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text((p.patient?.name || "-").substring(0, 25), 14, y);
            doc.text((p.title || "-").substring(0, 25), 70, y);
            doc.text(p.status, 130, y);
            doc.text(format(new Date(p.createdAt), "dd/MM/yyyy"), 170, y);
            y += 8;
        });

        doc.save(`relatorio_planejamentos_${format(new Date(), "yyyyMMdd")}.pdf`);
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
                        <h2 className="text-3xl font-bold text-foreground">Relatório de Planejamentos</h2>
                        <p className="text-muted-foreground">Listagem detalhada dos planejamentos por status e paciente</p>
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
                                placeholder="Buscar nome ou título..."
                                className="pl-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os Status</SelectItem>
                                <SelectItem value="DRAFT">Rascunho (Pendente)</SelectItem>
                                <SelectItem value="COMPLETED">Concluído</SelectItem>
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
                                    <TableHead>Título</TableHead>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>Nº do Paciente</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Criado Em</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10">Carregando planejamentos...</TableCell>
                                    </TableRow>
                                ) : data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum dado encontrado</TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.title}</TableCell>
                                            <TableCell>{p.patient?.name || "-"}</TableCell>
                                            <TableCell>{p.patient?.patientNumber || "-"}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.status === 'COMPLETED'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {p.status === 'COMPLETED' ? 'Concluído' : 'Rascunho'}
                                                </span>
                                            </TableCell>
                                            <TableCell>{format(new Date(p.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
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

export default PlanningsReport;

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Download, Filter, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reportService } from "@/services/reportService";
import Sidebar from "@/components/Sidebar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { jsPDF } from "jspdf";

const PatientsReport = () => {
    const [searchParams] = useSearchParams();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });

    const fetchData = async () => {
        setLoading(true);
        try {
            const results = await reportService.getPatientsReport({
                search,
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
    }, [search, dateRange]);

    const downloadCSV = () => {
        const headers = ["ID", "Nome", "Email", "Telefone", "Data Cadastro", "Dentista Responsável"];
        const rows = data.map(p => [
            p.patientNumber || p.id,
            p.name,
            p.email || "-",
            p.phone || "-",
            format(new Date(p.createdAt), "dd/MM/yyyy"),
            p.user?.name || "-"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_pacientes_${format(new Date(), "yyyyMMdd")}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Relatório de Pacientes", 14, 22);
        doc.setFontSize(11);
        doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);

        let y = 40;
        doc.setFontSize(10);
        doc.text("Nome", 14, y);
        doc.text("Email", 70, y);
        doc.text("Telefone", 120, y);
        doc.text("Cadastro", 160, y);
        doc.line(14, y + 2, 196, y + 2);
        y += 10;

        data.forEach((p, i) => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(p.name.substring(0, 25), 14, y);
            doc.text((p.email || "-").substring(0, 25), 70, y);
            doc.text(p.phone || "-", 120, y);
            doc.text(format(new Date(p.createdAt), "dd/MM"), 160, y);
            y += 8;
        });

        doc.save(`relatorio_pacientes_${format(new Date(), "yyyyMMdd")}.pdf`);
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
                        <h2 className="text-3xl font-bold text-foreground">Relatório de Pacientes</h2>
                        <p className="text-muted-foreground">Listagem detalhada e completa de todos os usuários cadastrados</p>
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
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar nome, email ou nº..."
                                className="pl-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Input
                            type="date"
                            placeholder="Data Início"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <Input
                            type="date"
                            placeholder="Data Fim"
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
                                    <TableHead>Nº</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead>Convênio</TableHead>
                                    <TableHead>Cadastro</TableHead>
                                    <TableHead>Responsável</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10">Carregando dados...</TableCell>
                                    </TableRow>
                                ) : data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum dado encontrado</TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.patientNumber || "-"}</TableCell>
                                            <TableCell>{p.name}</TableCell>
                                            <TableCell>{p.email || "-"}</TableCell>
                                            <TableCell>{p.phone || "-"}</TableCell>
                                            <TableCell>{p.paymentType || "-"}</TableCell>
                                            <TableCell>{format(new Date(p.createdAt), "dd/MM/yyyy")}</TableCell>
                                            <TableCell>{p.user?.name || "-"}</TableCell>
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

export default PatientsReport;

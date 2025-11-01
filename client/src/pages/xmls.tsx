import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Download,
  Eye,
  Send,
  FileText,
  CheckCircle2,
  FileX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function Xmls() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Mock data
  const xmls = [
    {
      id: "1",
      chave: "35240312345678000190550010000123451234567890",
      tipoDoc: "NFe",
      categoria: "emitida",
      dataEmissao: "2024-11-01",
      hora: "14:30:00",
      destinatario: "Cliente ABC Ltda",
      totalNota: 15450.00,
      totalImpostos: 2318.25,
      statusValidacao: "valido",
    },
    {
      id: "2",
      chave: "35240398765432000110550020000987652987654321",
      tipoDoc: "NFCe",
      categoria: "emitida",
      dataEmissao: "2024-11-01",
      hora: "10:15:00",
      destinatario: "Consumidor Final",
      totalNota: 89.90,
      totalImpostos: 13.49,
      statusValidacao: "valido",
    },
    {
      id: "3",
      chave: "35240311222333000144550030000456782345678901",
      tipoDoc: "NFe",
      categoria: "recebida",
      dataEmissao: "2024-10-31",
      hora: "16:45:00",
      destinatario: "Empresa XYZ SA",
      totalNota: 32100.00,
      totalImpostos: 4815.00,
      statusValidacao: "valido",
    },
    {
      id: "4",
      chave: "35240387654321000155550040000789013456789012",
      tipoDoc: "NFe",
      categoria: "recebida",
      dataEmissao: "2024-10-31",
      hora: "09:20:00",
      destinatario: "Fornecedor 123",
      totalNota: 8750.00,
      totalImpostos: 1312.50,
      statusValidacao: "invalido",
    },
    {
      id: "5",
      chave: "35240399887766000166550050000654324567890123",
      tipoDoc: "NFe",
      categoria: "emitida",
      dataEmissao: "2024-10-30",
      hora: "11:30:00",
      destinatario: "Partner Corp",
      totalNota: 22450.00,
      totalImpostos: 3367.50,
      statusValidacao: "valido",
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatChave = (chave: string) => {
    return chave.substring(0, 4) + "..." + chave.substring(chave.length - 4);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Documentos Fiscais</h1>
            <p className="text-muted-foreground mt-1">
              Visualize e gerencie todos os XMLs processados
            </p>
          </div>
          <Button data-testid="button-send-selected">
            <Send className="w-4 h-4 mr-2" />
            Enviar Selecionados
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[240px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por chave ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px] h-11" data-testid="select-tipo-doc">
                  <SelectValue placeholder="Tipo de Documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="nfe">NFe</SelectItem>
                  <SelectItem value="nfce">NFCe</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px] h-11" data-testid="select-categoria">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="emitida">Emitidas</SelectItem>
                  <SelectItem value="recebida">Recebidas</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="h-11" data-testid="button-filter">
                <Filter className="w-4 h-4 mr-2" />
                Mais Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* XMLs Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Tipo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Chave
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Data
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Destinatário
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold">
                      Total Nota
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold">
                      Impostos
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {xmls.map((xml) => (
                    <tr
                      key={xml.id}
                      className="border-b hover-elevate"
                      data-testid={`row-xml-${xml.id}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="font-mono w-fit">
                            {xml.tipoDoc}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              xml.categoria === "emitida"
                                ? "bg-blue-50 text-blue-700 border-blue-200 w-fit"
                                : "bg-purple-50 text-purple-700 border-purple-200 w-fit"
                            }
                            data-testid={`badge-categoria-${xml.id}`}
                          >
                            {xml.categoria}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatChave(xml.chave)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium">{xml.dataEmissao}</div>
                          <div className="text-muted-foreground">{xml.hora}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {xml.destinatario}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium tabular-nums">
                        {formatCurrency(xml.totalNota)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium tabular-nums text-muted-foreground">
                        {formatCurrency(xml.totalImpostos)}
                      </td>
                      <td className="px-6 py-4">
                        {xml.statusValidacao === "valido" ? (
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/20"
                            data-testid={`status-valid-${xml.id}`}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Válido
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-destructive/10 text-destructive border-destructive/20"
                            data-testid={`status-invalid-${xml.id}`}
                          >
                            <FileX className="w-3 h-3 mr-1" />
                            Inválido
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-view-${xml.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-download-${xml.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                {Math.min(currentPage * itemsPerPage, xmls.length)} de {xmls.length}{" "}
                resultados
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-10"
                  data-testid="text-current-page"
                >
                  {currentPage}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XmlEventsList } from "@/components/XmlEventsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Download,
  Mail,
  FileText,
  Building2,
  MapPin,
  Package,
  Receipt,
  Calculator,
  Code,
  Loader2,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useRoute, useLocation } from "wouter";
import { ErrorBoundaryPage } from "@/components/ErrorBoundaryPage";

export default function XmlDetail() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/xmls/:id");
  const xmlId = params?.id;
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  
  // Estados do formulário de email
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailText, setEmailText] = useState("Anexo Nota Fiscal");
  const listLocation = `/xmls${location.includes("?") ? location.slice(location.indexOf("?")) : ""}`;

  // Fetch XML details with parsed data
  const { data: xmlData, isLoading } = useQuery({
    queryKey: ["/api/xmls", xmlId, "details"],
    enabled: !!xmlId,
    queryFn: async () => {
      const res = await fetch(`/api/xmls/${xmlId}/details`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar detalhes do XML");
      }

      return res.json();
    },
  });

  const xml = xmlData;
  const parsedXml = xmlData?.parsedData;

  // Buscar empresa para obter email do emitente
  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const res = await fetch("/api/companies", {
        headers: getAuthHeader(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar empresas");
      return res.json();
    },
  });

  const currentCompany = companies?.find((c: any) => c.id === currentCompanyId);
  const emailEmitente = currentCompany?.emailUser || "";

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj || cnpj.length !== 14) return cnpj;
    return cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  };

  const formatCEP = (cep: string) => {
    if (!cep || cep.length !== 8) return cep;
    return cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  };

  const handleDownload = async () => {
    if (!xml) return;

    try {
      const res = await fetch(`/api/xmls/${xml.chave}/download`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Erro ao baixar XML");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NFe${xml.chave}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: "O arquivo XML está sendo baixado",
      });
    } catch (error) {
      toast({
        title: "Erro no download",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleDownloadDanfe = async () => {
    if (!xml) return;

    try {
      toast({
        title: "Gerando DANFE...",
        description: "Aguarde enquanto o PDF é gerado",
      });

      const res = await fetch(`/api/danfe/${xml.chave}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao gerar DANFE");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${xml.chave}-DANFE.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "DANFE baixado com sucesso!",
        description: "O arquivo PDF foi gerado e baixado",
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar DANFE",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência",
    });
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Abrir diálogo de email
  const handleOpenEmailDialog = () => {
    if (!currentCompany?.emailUser) {
      toast({
        title: "Email não configurado",
        description: "A empresa não possui configuração de email SMTP. Configure o email SMTP nas configurações da empresa.",
        variant: "destructive",
      });
      return;
    }
    
    // Preencher email destinatário do XML se existir
    const destinatarioEmail = parsedXml?.emailEmitente || "";
    setEmailTo(destinatarioEmail);
    
    // Preencher assunto padrão
    const numeroNota = parsedXml?.numeroNota || xml?.numeroNota || "";
    const cnpj = parsedXml?.cnpjEmitente || "";
    const razaoSocial = currentCompany?.razaoSocial || "";
    setEmailSubject(`NFe: ${numeroNota}, Emitente: ${cnpj}-${razaoSocial}`);
    
    setEmailText("Anexo Nota Fiscal");
    setEmailDialogOpen(true);
  };

  // Enviar email
  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o destinatário e o assunto",
        variant: "destructive",
      });
      return;
    }

    if (!xmlId) {
      toast({
        title: "Erro",
        description: "ID do XML não encontrado",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch(`/api/xmls/${xmlId}/send-email`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          text: emailText,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao enviar email");
      }

      toast({
        title: "Email enviado!",
        description: "O XML foi enviado por email com sucesso",
      });

      setEmailDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao enviar email",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <ErrorBoundaryPage>
        <DashboardLayout>
        <div className="max-w-7xl mx-auto p-8">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Carregando detalhes do XML...</p>
          </div>
        </div>
        </DashboardLayout>
      </ErrorBoundaryPage>
    );
  }

  if (!xml || !parsedXml) {
    return (
      <ErrorBoundaryPage>
        <DashboardLayout>
        <div className="max-w-7xl mx-auto p-8">
          <Card className="p-8">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">XML não encontrado</h3>
              <Button className="mt-4" onClick={() => setLocation(listLocation)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para Lista
              </Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
      </ErrorBoundaryPage>
    );
  }

  return (
    <ErrorBoundaryPage>
      <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation(listLocation)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Detalhes da NFe</h1>
              <p className="text-muted-foreground mt-1">
                Informações completas do documento fiscal
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Baixar XML
            </Button>
            <Button variant="outline" onClick={handleDownloadDanfe} className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
              <FileText className="w-4 h-4 mr-2" />
              Baixar DANFE
            </Button>
            <Button onClick={handleOpenEmailDialog}>
              <Mail className="w-4 h-4 mr-2" />
              Enviar por Email
            </Button>
          </div>
        </div>

        {/* Header Card - Informações Principais */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Identificação do Documento</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono">
                  {xml.tipoDoc}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    xml.categoria === "emitida"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  }
                >
                  {xml.categoria.toUpperCase()}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    xml.statusValidacao === "valido"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }
                >
                  {xml.statusValidacao === "valido" ? "VÁLIDO" : "INVÁLIDO"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chave de Acesso</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-sm">{xml.chave}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(xml.chave, "chave")}
                  >
                    {copiedSection === "chave" ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data de Emissão</p>
                <p className="mt-1">{xml.dataEmissao} {xml.hora && `às ${xml.hora}`}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accordion com Detalhes */}
        <Accordion type="multiple" defaultValue={["emitente", "destinatario", "produtos", "impostos"]} className="space-y-4">
          {/* Emitente */}
          <AccordionItem value="emitente">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Dados do Emitente</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">CNPJ</p>
                      <p className="mt-1">{formatCNPJ(parsedXml.cnpjEmitente)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Razão Social</p>
                      <p className="mt-1">{parsedXml.razaoSocialEmitente}</p>
                    </div>
                  </div>
                  {parsedXml.enderecoEmitente && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Endereço
                      </p>
                      <p className="text-sm">
                        {parsedXml.enderecoEmitente.rua}, {parsedXml.enderecoEmitente.numero}
                        {parsedXml.enderecoEmitente.complemento && ` - ${parsedXml.enderecoEmitente.complemento}`}
                        <br />
                        {parsedXml.enderecoEmitente.bairro} - {parsedXml.enderecoEmitente.cidade}/{parsedXml.enderecoEmitente.uf}
                        <br />
                        CEP: {formatCEP(parsedXml.enderecoEmitente.cep)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Destinatário */}
          {parsedXml.cnpjDestinatario && (
            <AccordionItem value="destinatario">
              <Card>
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold">Dados do Destinatário</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">CNPJ/CPF</p>
                        <p className="mt-1">{formatCNPJ(parsedXml.cnpjDestinatario)}</p>
                      </div>
                      {parsedXml.razaoSocialDestinatario && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Razão Social</p>
                          <p className="mt-1">{parsedXml.razaoSocialDestinatario}</p>
                        </div>
                      )}
                    </div>
                    {parsedXml.enderecoDestinatario && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Endereço
                        </p>
                        <p className="text-sm">
                          {parsedXml.enderecoDestinatario.rua}, {parsedXml.enderecoDestinatario.numero}
                          {parsedXml.enderecoDestinatario.complemento && ` - ${parsedXml.enderecoDestinatario.complemento}`}
                          <br />
                          {parsedXml.enderecoDestinatario.bairro} - {parsedXml.enderecoDestinatario.cidade}/{parsedXml.enderecoDestinatario.uf}
                          <br />
                          CEP: {formatCEP(parsedXml.enderecoDestinatario.cep)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          )}

          {/* Produtos */}
          <AccordionItem value="produtos">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold">Produtos e Serviços ({parsedXml.produtos.length} itens)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">#</th>
                          <th className="text-left py-3 px-4 font-semibold">Código</th>
                          <th className="text-left py-3 px-4 font-semibold">Descrição</th>
                          <th className="text-left py-3 px-4 font-semibold">NCM</th>
                          <th className="text-left py-3 px-4 font-semibold">CFOP</th>
                          <th className="text-center py-3 px-4 font-semibold">Qtd</th>
                          <th className="text-right py-3 px-4 font-semibold">Valor Unit.</th>
                          <th className="text-right py-3 px-4 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedXml.produtos.map((produto, idx) => (
                          <tr key={idx} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono text-xs">{produto.codigo}</td>
                            <td className="py-3 px-4">{produto.descricao}</td>
                            <td className="py-3 px-4 font-mono text-xs">{produto.ncm}</td>
                            <td className="py-3 px-4 font-mono text-xs">{produto.cfop}</td>
                            <td className="py-3 px-4 text-center">
                              {produto.quantidade} {produto.unidade}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums">
                              {formatCurrency(produto.valorUnitario)}
                            </td>
                            <td className="py-3 px-4 text-right font-medium tabular-nums">
                              {formatCurrency(produto.valorTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Impostos */}
          <AccordionItem value="impostos">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-orange-600" />
                  <span className="font-semibold">Impostos</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">ICMS</p>
                      <p className="text-xl font-bold mt-1">{formatCurrency(parsedXml.impostos.icms)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">IPI</p>
                      <p className="text-xl font-bold mt-1">{formatCurrency(parsedXml.impostos.ipi)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">PIS</p>
                      <p className="text-xl font-bold mt-1">{formatCurrency(parsedXml.impostos.pis)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">COFINS</p>
                      <p className="text-xl font-bold mt-1">{formatCurrency(parsedXml.impostos.cofins)}</p>
                    </div>
                  </div>
                  <div className="mt-6 p-4 rounded-lg bg-primary/10 border-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-lg">Total de Impostos</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(parsedXml.impostos.total)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* Totais */}
          <AccordionItem value="totais">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Calculator className="w-5 h-5 text-green-600" />
                  <span className="font-semibold">Totais da Nota</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">Total de Produtos</p>
                      <p className="text-xl font-bold mt-1">
                        {formatCurrency(parsedXml.produtos.reduce((sum, p) => sum + p.valorTotal, 0))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">Total de Impostos</p>
                      <p className="text-xl font-bold mt-1">{formatCurrency(parsedXml.totalImpostos)}</p>
                    </div>
                  </div>
                  <div className="p-6 rounded-lg bg-primary text-primary-foreground">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm opacity-90">Valor Total da Nota</p>
                        <p className="text-3xl font-bold mt-1">{formatCurrency(parsedXml.totalNota)}</p>
                      </div>
                      <Receipt className="w-12 h-12 opacity-20" />
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          {/* XML Raw */}
          <AccordionItem value="xml-raw">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Code className="w-5 h-5 text-slate-600" />
                  <span className="font-semibold">XML Original (Código Fonte)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4">
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copyToClipboard(parsedXml.xmlRaw, "xml")}
                    >
                      {copiedSection === "xml" ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar
                        </>
                      )}
                    </Button>
                    <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-96 text-xs font-mono">
                      {parsedXml.xmlRaw}
                    </pre>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>

        {/* Eventos relacionados à NFe */}
        <XmlEventsList chave={xml.chave} xmlId={xml.id} />
      </div>

      {/* Dialog de Envio de Email */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enviar XML por Email</DialogTitle>
            <DialogDescription>
              Preencha os dados para enviar o XML por email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-from">Emitente</Label>
              <Input
                id="email-from"
                value={emailEmitente}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email da empresa (não editável)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-to">Destinatário</Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject">Título (Assunto)</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Assunto do email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-text">Texto</Label>
              <Textarea
                id="email-text"
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="Texto do email"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={sendingEmail}
            >
              Cancelar
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </DashboardLayout>
    </ErrorBoundaryPage>
  );
}


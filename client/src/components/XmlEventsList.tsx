import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Calendar, FileText, X, Edit, Ban, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/auth";

interface XmlEvent {
  id: string;
  tipoEvento: string;
  codigoEvento: string | null;
  dataEvento: string;
  horaEvento: string | null;
  numeroSequencia: number | null;
  protocolo: string | null;
  justificativa: string | null;
  correcao: string | null;
  // Inutilização
  ano: string | null;
  serie: string | null;
  numeroInicial: string | null;
  numeroFinal: string | null;
  createdAt: string;
}

interface XmlEventsListProps {
  chave?: string;  // Chave da NFe para buscar eventos
  xmlId?: string;  // ID do XML para buscar eventos
}

export function XmlEventsList({ chave, xmlId }: XmlEventsListProps) {
  const [events, setEvents] = useState<XmlEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadEvents();
  }, [chave, xmlId]);

  async function loadEvents() {
    if (!chave && !xmlId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const endpoint = chave 
        ? `/api/xml-events/chave/${chave}`
        : `/api/xml-events/xml/${xmlId}`;

      const response = await fetch(endpoint, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar eventos");
      }

      const data = await response.json();
      setEvents(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar eventos";
      setError(message);
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  }

  function getEventIcon(tipo: string) {
    switch (tipo) {
      case "cancelamento":
        return <X className="h-4 w-4" />;
      case "carta_correcao":
        return <Edit className="h-4 w-4" />;
      case "inutilizacao":
        return <Ban className="h-4 w-4" />;
      case "confirmacao":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  function getEventBadgeColor(tipo: string): "default" | "destructive" | "secondary" | "outline" {
    switch (tipo) {
      case "cancelamento":
        return "destructive";
      case "carta_correcao":
        return "secondary";
      case "inutilizacao":
        return "outline";
      case "confirmacao":
        return "default";
      default:
        return "secondary";
    }
  }

  function getEventLabel(tipo: string): string {
    switch (tipo) {
      case "cancelamento":
        return "Cancelamento";
      case "carta_correcao":
        return "Carta de Correção";
      case "inutilizacao":
        return "Inutilização";
      case "confirmacao":
        return "Confirmação da Operação";
      case "desconhecimento":
        return "Desconhecimento da Operação";
      case "operacao_nao_realizada":
        return "Operação Não Realizada";
      default:
        return tipo;
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Eventos da Nota
          </CardTitle>
          <CardDescription>
            Cancelamentos, cartas de correção e outros eventos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Eventos da Nota
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-8 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Eventos da Nota
          </CardTitle>
          <CardDescription>
            Cancelamentos, cartas de correção e outros eventos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum evento encontrado para esta nota.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Eventos da Nota
        </CardTitle>
        <CardDescription>
          {events.length} evento{events.length !== 1 ? "s" : ""} registrado{events.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={getEventBadgeColor(event.tipoEvento)} className="gap-1">
                    {getEventIcon(event.tipoEvento)}
                    {getEventLabel(event.tipoEvento)}
                  </Badge>
                  {event.numeroSequencia && event.numeroSequencia > 1 && (
                    <Badge variant="outline">
                      Sequência {event.numeroSequencia}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(event.dataEvento)}
                  {event.horaEvento && ` às ${event.horaEvento}`}
                </div>
              </div>

              {event.tipoEvento === "inutilizacao" && (
                <div className="space-y-2 text-sm">
                  <div className="flex gap-4">
                    <span className="text-muted-foreground">Série:</span>
                    <span className="font-medium">{event.serie}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-muted-foreground">Numeração:</span>
                    <span className="font-medium">
                      {event.numeroInicial} a {event.numeroFinal}
                    </span>
                  </div>
                </div>
              )}

              {event.justificativa && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Justificativa:</p>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {event.justificativa}
                  </p>
                </div>
              )}

              {event.correcao && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Correção:</p>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {event.correcao}
                  </p>
                </div>
              )}

              {event.protocolo && (
                <div className="text-xs text-muted-foreground">
                  Protocolo: {event.protocolo}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}






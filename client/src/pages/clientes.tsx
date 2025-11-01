import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Building2, Mail, Server, CheckCircle2, Edit, Trash2 } from "lucide-react";

export default function Clientes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const clientes = [
    {
      id: "1",
      cnpj: "12.345.678/0001-90",
      razaoSocial: "Empresa Exemplo LTDA",
      nomeFantasia: "Exemplo Corp",
      cidade: "São Paulo",
      uf: "SP",
      emailConfig: true,
    },
    {
      id: "2",
      cnpj: "98.765.432/0001-10",
      razaoSocial: "Tech Solutions SA",
      nomeFantasia: "Tech Solutions",
      cidade: "Rio de Janeiro",
      uf: "RJ",
      emailConfig: false,
    },
    {
      id: "3",
      cnpj: "11.222.333/0001-44",
      razaoSocial: "Comércio ABC Ltda",
      nomeFantasia: "ABC Store",
      cidade: "Belo Horizonte",
      uf: "MG",
      emailConfig: true,
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os emitentes cadastrados
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-cliente">
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                <DialogDescription>
                  Preencha as informações do emitente
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-6 py-4">
                {/* Dados da Empresa */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Dados da Empresa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ *</Label>
                      <Input
                        id="cnpj"
                        data-testid="input-cnpj"
                        placeholder="00.000.000/0000-00"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ie">Inscrição Estadual</Label>
                      <Input
                        id="ie"
                        data-testid="input-ie"
                        placeholder="000.000.000.000"
                        className="h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="razaoSocial">Razão Social *</Label>
                    <Input
                      id="razaoSocial"
                      data-testid="input-razao-social"
                      placeholder="Razão Social da Empresa"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                    <Input
                      id="nomeFantasia"
                      data-testid="input-nome-fantasia"
                      placeholder="Nome Fantasia"
                      className="h-11"
                    />
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Endereço</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="rua">Rua</Label>
                      <Input
                        id="rua"
                        data-testid="input-rua"
                        placeholder="Rua, Avenida..."
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numero">Número</Label>
                      <Input
                        id="numero"
                        data-testid="input-numero"
                        placeholder="123"
                        className="h-11"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input
                        id="bairro"
                        data-testid="input-bairro"
                        placeholder="Bairro"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        data-testid="input-cidade"
                        placeholder="Cidade"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uf">UF</Label>
                      <Input
                        id="uf"
                        data-testid="input-uf"
                        placeholder="SP"
                        maxLength={2}
                        className="h-11"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        data-testid="input-cep"
                        placeholder="00000-000"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Configuração de Email */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">
                    Configuração de Email (Opcional)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Configure para monitoramento automático de XMLs
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emailHost">Host SMTP</Label>
                      <Input
                        id="emailHost"
                        data-testid="input-email-host"
                        placeholder="smtp.gmail.com"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailPort">Porta</Label>
                      <Input
                        id="emailPort"
                        data-testid="input-email-port"
                        type="number"
                        placeholder="587"
                        className="h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailUser">Usuário Email</Label>
                    <Input
                      id="emailUser"
                      data-testid="input-email-user"
                      type="email"
                      placeholder="usuario@email.com"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailPassword">Senha Email</Label>
                    <Input
                      id="emailPassword"
                      data-testid="input-email-password"
                      type="password"
                      placeholder="••••••••"
                      className="h-11"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="emailSsl" data-testid="switch-email-ssl" defaultChecked />
                    <Label htmlFor="emailSsl" className="cursor-pointer">
                      Usar SSL/TLS
                    </Label>
                  </div>
                </div>
              </form>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button data-testid="button-save-cliente">
                  Salvar Cliente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Clientes list */}
        <div className="grid grid-cols-1 gap-4">
          {clientes.map((cliente) => (
            <Card key={cliente.id} className="hover-elevate">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold" data-testid={`text-cliente-${cliente.id}`}>
                          {cliente.razaoSocial}
                        </h3>
                        {cliente.emailConfig && (
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/20"
                            data-testid={`badge-email-config-${cliente.id}`}
                          >
                            <Mail className="w-3 h-3 mr-1" />
                            Email Configurado
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">CNPJ:</span>{" "}
                          {cliente.cnpj}
                        </p>
                        <p>
                          <span className="font-medium">Nome Fantasia:</span>{" "}
                          {cliente.nomeFantasia}
                        </p>
                        <p>
                          <span className="font-medium">Localização:</span>{" "}
                          {cliente.cidade} - {cliente.uf}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-edit-${cliente.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-delete-${cliente.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty state if no clients */}
        {clientes.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum cliente cadastrado
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Comece cadastrando seu primeiro emitente
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Cliente
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

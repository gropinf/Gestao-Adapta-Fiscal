import { useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Users, Mail, Building2, Edit, Trash2 } from "lucide-react";

export default function Contabilidades() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const contabilidades = [
    {
      id: "1",
      nome: "Contabilidade Silva & Associados",
      email: "contato@silvacontabil.com.br",
      empresasAssociadas: ["Empresa Exemplo LTDA", "Comércio ABC Ltda"],
    },
    {
      id: "2",
      nome: "Escritório Fiscal Premium",
      email: "fiscal@premium.com.br",
      empresasAssociadas: ["Tech Solutions SA"],
    },
  ];

  const empresasDisponiveis = [
    { id: "1", nome: "Empresa Exemplo LTDA", cnpj: "12.345.678/0001-90" },
    { id: "2", nome: "Tech Solutions SA", cnpj: "98.765.432/0001-10" },
    { id: "3", nome: "Comércio ABC Ltda", cnpj: "11.222.333/0001-44" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contabilidades</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os escritórios contábeis
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-accountant">
                <Plus className="w-4 h-4 mr-2" />
                Nova Contabilidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Contabilidade</DialogTitle>
                <DialogDescription>
                  Preencha as informações do escritório contábil
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-6 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Contabilidade *</Label>
                    <Input
                      id="nome"
                      data-testid="input-accountant-name"
                      placeholder="Nome do Escritório Contábil"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email do Contador *</Label>
                    <Input
                      id="email"
                      data-testid="input-accountant-email"
                      type="email"
                      placeholder="contador@escritorio.com.br"
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Empresas Associadas</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione quais empresas serão atendidas por esta contabilidade
                  </p>
                  <div className="space-y-2 border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {empresasDisponiveis.map((empresa) => (
                      <div
                        key={empresa.id}
                        className="flex items-center space-x-2 p-2 rounded hover-elevate"
                      >
                        <Checkbox
                          id={`empresa-${empresa.id}`}
                          data-testid={`checkbox-empresa-${empresa.id}`}
                        />
                        <label
                          htmlFor={`empresa-${empresa.id}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <div className="font-medium">{empresa.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {empresa.cnpj}
                          </div>
                        </label>
                      </div>
                    ))}
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
                <Button data-testid="button-save-accountant">
                  Salvar Contabilidade
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Contabilidades list */}
        <div className="grid grid-cols-1 gap-4">
          {contabilidades.map((contabilidade) => (
            <Card key={contabilidade.id} className="hover-elevate">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold mb-2" data-testid={`text-accountant-${contabilidade.id}`}>
                        {contabilidade.nome}
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span>{contabilidade.email}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex flex-wrap gap-2">
                            {contabilidade.empresasAssociadas.map((empresa, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="bg-muted"
                                data-testid={`badge-company-${contabilidade.id}-${idx}`}
                              >
                                {empresa}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-edit-${contabilidade.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-delete-${contabilidade.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty state */}
        {contabilidades.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma contabilidade cadastrada
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Adicione escritórios contábeis para facilitar o envio de documentos
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Contabilidade
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

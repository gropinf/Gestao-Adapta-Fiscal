import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, Trash2, Info, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAuthHeader } from "@/lib/auth";

interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface CompanyUsersTabProps {
  companyId: string;
}

export function CompanyUsersTab({ companyId }: CompanyUsersTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [isResending, setIsResending] = useState<string | null>(null);

  // Form state
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    role: "cliente",
  });

  // Fetch users
  const { data: users = [], isLoading, error } = useQuery<CompanyUser[]>({
    queryKey: ["company-users", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/users`, {
        headers: {
          ...getAuthHeader(),
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Erro ao carregar usuários" }));
        throw new Error(errorData.error || errorData.message || "Erro ao carregar usuários");
      }
      return res.json();
    },
    enabled: !!companyId,
  });

  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async (userData: { email: string; name: string; role: string }) => {
      const res = await fetch(`/api/companies/${companyId}/users`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Erro ao adicionar usuário" }));
        throw new Error(errorData.error || errorData.message || "Erro ao adicionar usuário");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      setIsAddDialogOpen(false);
      setNewUser({ email: "", name: "", role: "cliente" });
      
      toast({
        title: data.wasCreated ? "Usuário criado!" : "Usuário vinculado!",
        description: data.wasCreated 
          ? "Email de ativação enviado com sucesso."
          : "Usuário existente vinculado à empresa.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/companies/${companyId}/users/${userId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Erro ao remover usuário" }));
        throw new Error(errorData.error || errorData.message || "Erro ao remover usuário");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "Usuário removido",
        description: "Vínculo com a empresa removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resend activation email
  const handleResendActivation = async (email: string) => {
    setIsResending(email);
    try {
      const res = await fetch("/api/auth/resend-activation", {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Erro ao reenviar email" }));
        throw new Error(errorData.error || errorData.message || "Erro ao reenviar email");
      }

      toast({
        title: "Email reenviado!",
        description: "Novo link de ativação enviado para " + email,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao reenviar email",
        variant: "destructive",
      });
    } finally {
      setIsResending(null);
    }
  };

  const handleAddUser = () => {
    if (!newUser.email) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, informe o email do usuário",
        variant: "destructive",
      });
      return;
    }

    addUserMutation.mutate(newUser);
  };

  const handleRemoveUser = (user: CompanyUser) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2">Carregando usuários...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>Erro ao carregar usuários: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Usuários Vinculados</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários que têm acesso a esta empresa
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar Usuário
        </Button>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum usuário vinculado</p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            Adicionar Primeiro Usuário
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "Admin" : user.role === "contabilidade" ? "Contabilidade" : "Cliente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <Badge variant="default" className="bg-green-600">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Aguardando Ativação
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!user.active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendActivation(user.email)}
                          disabled={isResending === user.email}
                        >
                          {isResending === user.email ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-1" />
                              Reenviar
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(user)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
            <DialogDescription>
              Adicione um usuário existente ou crie um novo. Um email de ativação será enviado
              para novos usuários.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@email.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Nome
                <span className="text-sm text-muted-foreground ml-2">
                  (obrigatório apenas para novos usuários)
                </span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Nome do usuário"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="contabilidade">Contabilidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md flex gap-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Se o email já existir, o usuário será apenas vinculado à empresa. 
                Caso contrário, um novo usuário será criado e receberá email de ativação.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              setNewUser({ email: "", name: "", role: "cliente" });
            }}>
              Cancelar
            </Button>
            <Button onClick={handleAddUser} disabled={addUserMutation.isPending}>
              {addUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{selectedUser?.name}</strong> ({selectedUser?.email}) 
              desta empresa? O usuário não será deletado, apenas o vínculo será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && removeUserMutation.mutate(selectedUser.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removeUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



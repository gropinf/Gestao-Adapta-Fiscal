import { ReactNode, useEffect, useRef } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Upload,
  BarChart3,
  Mail,
  Send,
  Download,
  Shield,
  LogOut,
  ChevronDown,
  HardDrive,
  Trash2,
  Key,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuthStore, getAuthHeader } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { Company } from "@shared/schema";
import { UserProfileMenu } from "./UserProfileMenu";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Building2,
  },
  {
    title: "Contabilidades",
    url: "/contabilidades",
    icon: Users,
  },
  {
    title: "XMLs",
    url: "/xmls",
    icon: FileText,
  },
  {
    title: "Upload",
    url: "/upload",
    icon: Upload,
  },
  {
    title: "Upload Eventos",
    url: "/upload-eventos",
    icon: Upload,
  },
  {
    title: "Análise de Sequência",
    url: "/analise-sequencia",
    icon: BarChart3,
  },
  {
    title: "Relatórios",
    url: "/relatorios",
    icon: BarChart3,
  },
  {
    title: "Monitor de Email",
    url: "/configuracoes/email-monitor",
    icon: Mail,
    adminOnly: true, // Apenas para admin - funcionalidade global
  },
  {
    title: "Email Global",
    url: "/configuracoes/email-global",
    icon: Mail,
    adminOnly: true,
  },
  {
    title: "API Keys",
    url: "/configuracoes/api-keys",
    icon: Key,
  },
  {
    title: "Logs de Verificação",
    url: "/configuracoes/email-logs",
    icon: Mail,
  },
  {
    title: "Histórico Agendamentos",
    url: "/configuracoes/email-monitor-runs",
    icon: Mail,
    adminOnly: true,
  },
  {
    title: "Limpeza XMLs",
    url: "/configuracoes/purge-unapproved-xmls",
    icon: Trash2,
    adminOnly: true,
  },
  {
    title: "Enviar XMLs por Email",
    url: "/envio-xml-email",
    icon: Send,
  },
  {
    title: "Baixar XMLs",
    url: "/xml-downloads",
    icon: Download,
  },
  {
    title: "Auditoria de Acessos",
    url: "/auditoria/acessos",
    icon: Shield,
    adminOnly: true, // Apenas para admin
  },
  {
    title: "Migração R2",
    url: "/r2-migration",
    icon: HardDrive,
    adminOnly: true,
  },
];

function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  // Filtrar itens do menu baseado no perfil do usuário
  const filteredMenuItems = menuItems.filter((item) => {
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    return true;
  });

  return (
    <Sidebar>
      <SidebarContent className="p-4">
        <SidebarGroup>
          <div className="flex items-center gap-3 px-3 py-4 mb-2">
            <div style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px' }} className="flex items-center justify-center">
              <img 
                src="/logo-adapta-A.ico" 
                alt="Adapta Fiscal Logo" 
                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg">Adapta Fiscal</span>
              <span className="text-xs text-muted-foreground">
                {import.meta.env.VITE_APP_VERSION || "—"}
              </span>
            </div>
          </div>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url} className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, currentCompanyId, setCurrentCompany, logout, accessLogId, setAccessLogId } = useAuthStore();
  const hasCalledSelectCompany = useRef(false);

  // Fetch user's companies
  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!user,
  });

  // Decide seleção inicial ou redireciona para seleção manual
  useEffect(() => {
    if (!companies || companies.length === 0) return;
    if (currentCompanyId) return;

    if (companies.length === 1) {
      setCurrentCompany(companies[0].id);
      return;
    }

    if (location !== "/selecionar-empresa") {
      setLocation("/selecionar-empresa");
    }
  }, [companies, currentCompanyId, setCurrentCompany, location, setLocation]);

  // Registrar seleção inicial da empresa (atualiza accessLog)
  useEffect(() => {
    if (!currentCompanyId || !accessLogId || hasCalledSelectCompany.current) return;
    hasCalledSelectCompany.current = true;

    fetch("/api/auth/select-company", {
      method: "POST",
      headers: {
        ...getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ companyId: currentCompanyId, accessLogId }),
    })
      .then(() => {
        console.log("Empresa inicial selecionada e registrada no log");
        setAccessLogId(null);
      })
      .catch((error) => {
        console.error("Erro ao registrar seleção de empresa:", error);
      });
  }, [currentCompanyId, accessLogId, setAccessLogId]);

  const currentCompany = companies?.find((c) => c.id === currentCompanyId) || companies?.[0];

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const handleCompanyChange = async (newCompanyId: string) => {
    // Se já tinha uma empresa selecionada, é uma troca (switch)
    if (currentCompanyId && currentCompanyId !== newCompanyId) {
      try {
        await fetch("/api/auth/switch-company", {
          method: "POST",
          headers: {
            ...getAuthHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ companyId: newCompanyId }),
        });
        console.log("Troca de empresa registrada no log");
      } catch (error) {
        console.error("Erro ao registrar troca de empresa:", error);
      }
    }
    
    setCurrentCompany(newCompanyId);
    queryClient.invalidateQueries();
  };

  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          {/* Header */}
          <header className="flex items-center justify-between h-16 px-6 border-b bg-background">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
                <img 
                  src="/logo-adapta-A.ico" 
                  alt="Adapta Fiscal Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              {isLoading ? (
                <div className="h-10 w-48 rounded bg-muted animate-pulse" />
              ) : companies && companies.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2"
                      data-testid="button-company-selector"
                    >
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">
                        {currentCompany?.nomeFantasia || currentCompany?.razaoSocial}
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel>Suas Empresas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {companies.map((company) => (
                      <DropdownMenuItem
                        key={company.id}
                        onClick={() => handleCompanyChange(company.id)}
                        data-testid={`option-company-${company.id}`}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{company.nomeFantasia || company.razaoSocial}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatCNPJ(company.cnpj)}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {currentCompany ? (
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>{currentCompany.razaoSocial}</span>
                  <span>{formatCNPJ(currentCompany.cnpj)}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/selecionar-empresa")}
              >
                Selecionar outra empresa
              </Button>
              <UserProfileMenu />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto bg-muted/20">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

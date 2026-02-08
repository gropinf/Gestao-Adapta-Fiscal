import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Clientes from "@/pages/clientes";
import Contabilidades from "@/pages/contabilidades";
import Xmls from "@/pages/xmls";
import XmlDetail from "@/pages/xml-detail";
import Upload from "@/pages/upload";
import UploadEventos from "@/pages/upload-eventos";
import AnaliseSequencia from "@/pages/analise-sequencia";
import Relatorios from "@/pages/relatorios";
import EmailMonitorPage from "@/pages/email-monitor";
import EmailCheckLogs from "@/pages/email-check-logs";
import EmailMonitorRuns from "@/pages/email-monitor-runs";
import PurgeUnapprovedXmls from "@/pages/purge-unapproved-xmls";
import EnvioXmlEmail from "@/pages/envio-xml-email";
import BaixarXmls from "@/pages/baixar-xmls";
import EmailGlobalPage from "@/pages/email-global";
import ApiKeysPage from "@/pages/api-keys";
import ActivatePage from "@/pages/activate";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import RequestAccess from "@/pages/request-access";
import CadastroEmpresa from "@/pages/cadastro-empresa";
import SelecionarEmpresa from "@/pages/selecionar-empresa";
import ReenviarAtivacao from "@/pages/reenviar-ativacao";
import AuditoriaAcessos from "@/pages/auditoria-acessos";
import Perfil from "@/pages/perfil";
import ContaboStorage from "@/pages/contabo-storage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/activate/:token" component={ActivatePage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <Route path="/request-access" component={RequestAccess} />
      <Route path="/reenviar-ativacao" component={ReenviarAtivacao} />
      <Route path="/public/cadastro-empresa" component={CadastroEmpresa} />
      <Route path="/selecionar-empresa" component={SelecionarEmpresa} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/clientes" component={Clientes} />
      <Route path="/contabilidades" component={Contabilidades} />
      <Route path="/xmls" component={Xmls} />
      <Route path="/xmls/:id" component={XmlDetail} />
      <Route path="/upload" component={Upload} />
      <Route path="/upload-eventos" component={UploadEventos} />
      <Route path="/analise-sequencia" component={AnaliseSequencia} />
      <Route path="/relatorios" component={Relatorios} />
      <Route path="/configuracoes/email-monitor" component={EmailMonitorPage} />
      <Route path="/configuracoes/email-global" component={EmailGlobalPage} />
      <Route path="/configuracoes/api-keys" component={ApiKeysPage} />
      <Route path="/configuracoes/email-logs" component={EmailCheckLogs} />
      <Route path="/configuracoes/email-monitor-runs" component={EmailMonitorRuns} />
      <Route path="/xml-downloads" component={BaixarXmls} />
      <Route path="/configuracoes/purge-unapproved-xmls" component={PurgeUnapprovedXmls} />
      <Route path="/envio-xml-email" component={EnvioXmlEmail} />
      <Route path="/auditoria/acessos" component={AuditoriaAcessos} />
      <Route path="/perfil" component={Perfil} />
      <Route path="/contabo-storage" component={ContaboStorage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

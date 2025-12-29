import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyUsersTab } from "./CompanyUsersTab";
import { CompanyAccountantsTab } from "./CompanyAccountantsTab";
import { CompanyEmailConfigTab } from "./CompanyEmailConfigTab";
import { Building2, Users, Calculator, Mail } from "lucide-react";
import type { Company } from "@shared/schema";

interface CompanyEditDialogProps {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  editForm: React.ReactNode; // Form de edição da empresa
}

export function CompanyEditDialog({ company, isOpen, onClose, editForm }: CompanyEditDialogProps) {
  const [activeTab, setActiveTab] = useState("dados");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Editar Empresa: {company?.razaoSocial || company?.nomeFantasia}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dados">
              <Building2 className="h-4 w-4 mr-2" />
              Dados da Empresa
            </TabsTrigger>
            <TabsTrigger value="usuarios">
              <Users className="h-4 w-4 mr-2" />
              Usuários Vinculados
            </TabsTrigger>
            <TabsTrigger value="contabilidades">
              <Calculator className="h-4 w-4 mr-2" />
              Contabilidades
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email SMTP (Envio de XML)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4">
            {editForm}
          </TabsContent>

          <TabsContent value="usuarios" className="space-y-4">
            {company && <CompanyUsersTab companyId={company.id} />}
          </TabsContent>

          <TabsContent value="contabilidades" className="space-y-4">
            {company && <CompanyAccountantsTab companyId={company.id} />}
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            {company && <CompanyEmailConfigTab company={company} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}





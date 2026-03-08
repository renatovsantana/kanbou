/**
 * @module users
 * User management page.
 * Lists all system users in a table, supports creating, editing, and deleting users
 * with role-based permission management. Only accessible to admin users.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, UserCog, Loader2, Edit, Trash2 } from "lucide-react";
import type { Client } from "@shared/schema";
import { AVAILABLE_PERMISSIONS, DEFAULT_PERMISSIONS, ROLE_LABELS, ALL_ROLES, isInternalRole } from "@shared/schema";

/** Safe user representation (excludes password hash). */
type SafeUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  clientId: number | null;
  isManager: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
};

/**
 * Admin page for managing system users.
 * Features: user list with search, create/edit dialog, role and permission assignment,
 * client association, and user deletion with confirmation.
 */
export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("designer");
  const [formClientId, setFormClientId] = useState<string>("");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formIsManager, setFormIsManager] = useState(false);
  const [formClientAccess, setFormClientAccess] = useState<number[]>([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsOpen(false);
      resetForm();
      toast({ title: "Usuário criado com sucesso" });
    },
    onError: (err: any) => {
      let msg = "Erro ao criar usuário";
      try {
        const json = JSON.parse(err.message.replace(/^\d+:\s*/, ""));
        msg = json.message || msg;
      } catch {}
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsOpen(false);
      resetForm();
      toast({ title: "Usuário atualizado com sucesso" });
    },
    onError: (err: any) => {
      let msg = "Erro ao atualizar usuário";
      try {
        const json = JSON.parse(err.message.replace(/^\d+:\s*/, ""));
        msg = json.message || msg;
      } catch {}
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteUserId(null);
      toast({ title: "Usuário excluído com sucesso" });
    },
    onError: (err: any) => {
      let msg = "Erro ao excluir usuário";
      try {
        const json = JSON.parse(err.message.replace(/^\d+:\s*/, ""));
        msg = json.message || msg;
      } catch {}
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("designer");
    setFormClientId("");
    setFormPermissions([]);
    setFormIsManager(false);
    setFormClientAccess([]);
    setEditingUserId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormPermissions(DEFAULT_PERMISSIONS["designer"] || []);
    setIsOpen(true);
  };

  const handleOpenEdit = async (u: SafeUser) => {
    setEditingUserId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword("");
    setFormRole(u.role);
    setFormClientId(u.clientId ? String(u.clientId) : "");
    setFormPermissions(DEFAULT_PERMISSIONS[u.role] || []);
    setFormIsManager(u.isManager ?? false);
    try {
      const res = await fetch(`/api/users/${u.id}/client-access`, { credentials: "include" });
      if (res.ok) {
        const accessIds = await res.json();
        setFormClientAccess(accessIds);
      }
    } catch {}
    setIsOpen(true);
  };

  const handleRoleChange = (role: string) => {
    setFormRole(role);
    setFormPermissions(DEFAULT_PERMISSIONS[role] || []);
  };

  const handlePermissionToggle = (key: string) => {
    setFormPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const saveClientAccess = async (userId: number) => {
    try {
      await fetch(`/api/users/${userId}/client-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientIds: formClientAccess }),
      });
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isAdmin = currentUser?.role === "admin";

    if (editingUserId) {
      if (isAdmin) {
        const payload: any = {
          name: formName,
          email: formEmail,
          role: formRole,
          clientId: formRole === "client" && formClientId ? Number(formClientId) : null,
          permissions: formPermissions,
          isManager: formIsManager,
        };
        if (formPassword) {
          payload.password = formPassword;
        }
        updateMutation.mutate({ id: editingUserId, data: payload });
      }
      await saveClientAccess(editingUserId);
      if (!isAdmin) {
        toast({ title: "Sucesso", description: "Acesso atualizado" });
        setIsOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      }
    } else if (isAdmin) {
      const payload: any = {
        name: formName,
        email: formEmail,
        password: formPassword,
        role: formRole,
        clientId: formRole === "client" && formClientId ? Number(formClientId) : null,
        permissions: formPermissions,
        isManager: formIsManager,
      };
      createMutation.mutate(payload, {
        onSuccess: async (newUser: any) => {
          if (formClientAccess.length > 0 && newUser?.id) {
            await saveClientAccess(newUser.id);
          }
        },
      });
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const roleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate" data-testid={`badge-role-admin`}>Administrador</Badge>;
      case "designer":
        return <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate" data-testid={`badge-role-designer`}>Designer</Badge>;
      case "redator":
        return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate border-amber-500/50 text-amber-700 dark:text-amber-400" data-testid={`badge-role-redator`}>Redator</Badge>;
      case "gerente":
        return <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate" data-testid={`badge-role-gerente`}>Gerente</Badge>;
      case "audiovisual":
        return <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate" data-testid={`badge-role-audiovisual`}>Audiovisual</Badge>;
      case "atendimento":
        return <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate" data-testid={`badge-role-atendimento`}>Atendimento</Badge>;
      case "client":
        return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate" data-testid={`badge-role-client`}>Cliente</Badge>;
      default:
        return <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">{ROLE_LABELS[role] || role}</Badge>;
    }
  };

  const isAdminOrManager = currentUser?.role === "admin" || currentUser?.isManager;

  if (!isAdminOrManager) {
    return (
      <div className="space-y-8">
        <h1 className="section-title" data-testid="text-page-title">Acesso Negado</h1>
        <p className="text-muted-foreground">Apenas administradores e gerentes podem gerenciar usuários.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1 className="section-title" data-testid="text-page-title">Usuários</h1>
          <p className="section-subtitle">Gerencie os acessos ao sistema</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
          {currentUser?.role === "admin" && (
            <DialogTrigger asChild>
              <Button data-testid="button-new-user" onClick={handleOpenCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{currentUser?.role === "admin" ? (editingUserId ? "Editar Usuário" : "Criar Usuário") : "Gerenciar Acesso"}</DialogTitle>
              <DialogDescription>{currentUser?.role === "admin" ? (editingUserId ? "Atualize os dados do usuário" : "Preencha os dados do novo usuário") : "Defina quais clientes este usuário pode acessar"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {currentUser?.role === "admin" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Nome</Label>
                    <Input
                      id="user-name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      data-testid="input-user-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                      data-testid="input-user-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-password">
                      Senha{editingUserId ? " (deixe vazio para manter)" : ""}
                    </Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required={!editingUserId}
                      minLength={formPassword.length > 0 ? 6 : undefined}
                      data-testid="input-user-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Perfil</Label>
                    <Select value={formRole} onValueChange={handleRoleChange}>
                      <SelectTrigger data-testid="select-user-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formRole === "client" && (
                    <div className="space-y-2">
                      <Label htmlFor="user-client">Empresa do Cliente</Label>
                      <Select value={formClientId} onValueChange={setFormClientId}>
                        <SelectTrigger data-testid="select-user-client">
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {formRole !== "client" && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="user-is-manager"
                        checked={formIsManager}
                        onCheckedChange={(v) => setFormIsManager(v === true)}
                        data-testid="checkbox-is-manager"
                      />
                      <label htmlFor="user-is-manager" className="text-sm cursor-pointer select-none">
                        Gerente
                        <span className="text-muted-foreground ml-1 text-xs">— Pode vincular usuários a clientes</span>
                      </label>
                    </div>
                  )}
                  <div className="space-y-3">
                    <Label>Permissões</Label>
                    <div className="grid gap-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <div key={perm.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`perm-${perm.key}`}
                            checked={formPermissions.includes(perm.key)}
                            onCheckedChange={() => handlePermissionToggle(perm.key)}
                            data-testid={`checkbox-permission-${perm.key}`}
                          />
                          <label
                            htmlFor={`perm-${perm.key}`}
                            className="text-sm cursor-pointer select-none"
                          >
                            {perm.label}
                            <span className="text-muted-foreground ml-1 text-xs">— {perm.description}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Acesso aos Clientes</Label>
                <p className="text-xs text-muted-foreground mb-1">Marque os clientes que este usuário pode acessar. Se nenhum for marcado, terá acesso a todos.</p>
                <div className="grid gap-1.5 max-h-36 overflow-y-auto border rounded-md p-2">
                  {clients.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`client-access-${c.id}`}
                        checked={formClientAccess.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setFormClientAccess(prev =>
                            checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                          );
                        }}
                        data-testid={`checkbox-client-access-${c.id}`}
                      />
                      <label htmlFor={`client-access-${c.id}`} className="text-sm cursor-pointer select-none">
                        {c.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isMutating} data-testid="button-submit-user">
                {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingUserId ? "Salvar Alterações" : "Criar Usuário"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <UserCog className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Vinculado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const linkedClient = u.clientId ? clients.find(c => c.id === u.clientId) : null;
                return (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {roleBadge(u.role)}
                        {u.isManager && (
                          <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid={`badge-manager-${u.id}`}>
                            Gerente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{linkedClient ? linkedClient.name : "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.isActive ? "default" : "secondary"}
                        className="no-default-hover-elevate no-default-active-elevate"
                      >
                        {u.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-edit-user-${u.id}`}
                          onClick={() => handleOpenEdit(u)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-delete-user-${u.id}`}
                          onClick={() => setDeleteUserId(u.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={deleteUserId !== null} onOpenChange={(open) => { if (!open) setDeleteUserId(null); }}>
        <AlertDialogContent data-testid="dialog-confirm-delete-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-user"
              onClick={() => {
                if (deleteUserId) deleteMutation.mutate(deleteUserId);
              }}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

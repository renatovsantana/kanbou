import { useState } from "react";
import { useClients, useDeleteClient } from "@/hooks/use-clients";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Client, Competitor } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Phone,
  Instagram,
  Users,
  Target,
  Globe,
  Facebook,
  Linkedin,
  Video,
  X,
  FolderOpen,
  RefreshCw,
  ExternalLink,
  HardDrive,
  Loader2,
} from "lucide-react";
import { ClientForm } from "@/components/client-form";
import { useToast } from "@/hooks/use-toast";

export default function ClientList() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const [deletingClientId, setDeletingClientId] = useState<number | null>(null);
  const [competitorDialogClient, setCompetitorDialogClient] = useState<Client | null>(null);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  const [showCompetitorForm, setShowCompetitorForm] = useState(false);
  const [competitorForm, setCompetitorForm] = useState({
    name: "", instagram: "", facebook: "", tiktok: "", linkedin: "", youtube: "", website: "", notes: "",
  });

  const { data: clients, isLoading } = useClients();
  const deleteClient = useDeleteClient();
  const [syncingClientId, setSyncingClientId] = useState<number | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const { data: driveStatus } = useQuery<{ connected: boolean; user?: { email: string; name: string } }>({
    queryKey: ["/api/drive/status"],
  });

  const syncClientDrive = useMutation({
    mutationFn: async (clientId: number) => {
      setSyncingClientId(clientId);
      const res = await apiRequest("POST", `/api/drive/sync-client/${clientId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Pasta do Google Drive criada com sucesso!" });
      setSyncingClientId(null);
    },
    onError: () => {
      toast({ title: "Erro ao criar pasta no Drive", variant: "destructive" });
      setSyncingClientId(null);
    },
  });

  const syncAllDrive = useMutation({
    mutationFn: async () => {
      setSyncingAll(true);
      const res = await apiRequest("POST", "/api/drive/sync-all");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      const failed = data.results?.filter((r: any) => !r.success).length || 0;
      if (failed > 0) {
        toast({ title: `Sincronização concluída com ${failed} erro(s)`, variant: "destructive" });
      } else {
        toast({ title: "Todos os clientes sincronizados com o Drive!" });
      }
      setSyncingAll(false);
    },
    onError: () => {
      toast({ title: "Erro ao sincronizar com o Drive", variant: "destructive" });
      setSyncingAll(false);
    },
  });

  const { data: competitorsForClient = [] } = useQuery<Competitor[]>({
    queryKey: ["/api/competitors/by-client", competitorDialogClient?.id],
    queryFn: async () => {
      const res = await fetch(`/api/competitors/by-client/${competitorDialogClient?.id}`);
      return res.json();
    },
    enabled: !!competitorDialogClient,
  });

  const createCompetitor = useMutation({
    mutationFn: async (data: { clientId: number } & typeof competitorForm) => {
      const res = await apiRequest("POST", "/api/competitors", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitors/by-client", competitorDialogClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitors"] });
      resetCompetitorForm();
      toast({ title: "Concorrente adicionado!" });
    },
  });

  const updateCompetitor = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof competitorForm) => {
      const res = await apiRequest("PUT", `/api/competitors/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitors/by-client", competitorDialogClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitors"] });
      resetCompetitorForm();
      toast({ title: "Concorrente atualizado!" });
    },
  });

  const deleteCompetitor = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/competitors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitors/by-client", competitorDialogClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitors"] });
      toast({ title: "Concorrente removido." });
    },
  });

  function resetCompetitorForm() {
    setCompetitorForm({ name: "", instagram: "", facebook: "", tiktok: "", linkedin: "", youtube: "", website: "", notes: "" });
    setEditingCompetitor(null);
    setShowCompetitorForm(false);
  }

  function startEditCompetitor(comp: Competitor) {
    setEditingCompetitor(comp);
    setCompetitorForm({
      name: comp.name,
      instagram: comp.instagram || "",
      facebook: comp.facebook || "",
      tiktok: comp.tiktok || "",
      linkedin: comp.linkedin || "",
      youtube: comp.youtube || "",
      website: comp.website || "",
      notes: comp.notes || "",
    });
    setShowCompetitorForm(true);
  }

  function handleSaveCompetitor() {
    if (!competitorForm.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (editingCompetitor) {
      updateCompetitor.mutate({ id: editingCompetitor.id, ...competitorForm });
    } else if (competitorDialogClient) {
      createCompetitor.mutate({ clientId: competitorDialogClient.id, ...competitorForm });
    }
  }

  const filteredClients = clients?.filter((c: Client) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.contactName && c.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeletingClientId(id);
  };

  const confirmDelete = async () => {
    if (deletingClientId !== null) {
      await deleteClient.mutateAsync(deletingClientId);
      setDeletingClientId(null);
    }
  };

  const handleCreate = () => {
    setEditingClient(undefined);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1 className="section-title" data-testid="text-page-title">Clientes</h1>
          <p className="section-subtitle">Gerencie os clientes da agência.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {driveStatus?.connected && (
            <Button
              variant="outline"
              data-testid="button-sync-all-drive"
              onClick={() => syncAllDrive.mutate()}
              disabled={syncingAll}
            >
              {syncingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <HardDrive className="w-4 h-4 mr-2" />
              )}
              Sincronizar Drive
            </Button>
          )}
          <Button
            data-testid="button-new-client"
            onClick={handleCreate}
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Cliente
          </Button>
        </div>
      </div>

      {driveStatus?.connected && (
        <Card className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="font-medium">Google Drive conectado</span>
              {driveStatus.user && (
                <span className="text-muted-foreground">({driveStatus.user.email})</span>
              )}
            </div>
            <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate text-green-600 dark:text-green-400">
              Ativo
            </Badge>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search-clients"
              placeholder="Buscar por nome, contato ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span data-testid="text-client-count">{filteredClients?.length || 0} clientes</span>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[200px]">Cliente</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead className="w-[100px]">Drive</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredClients?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredClients?.map((client: Client) => (
                <TableRow key={client.id} data-testid={`row-client-${client.id}`} className="transition-colors">
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.contactName || "—"}</TableCell>
                  <TableCell>
                    {client.email ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        {client.email}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {client.phone ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        {client.phone}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {client.instagram ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Instagram className="w-3.5 h-3.5 text-muted-foreground" />
                        {client.instagram}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {client.driveFolderUrl ? (
                      <a
                        href={client.driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary"
                        data-testid={`link-drive-folder-${client.id}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : driveStatus?.connected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => syncClientDrive.mutate(client.id)}
                        disabled={syncingClientId === client.id}
                        data-testid={`button-sync-drive-${client.id}`}
                      >
                        {syncingClientId === client.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.isActive ? "default" : "secondary"} className="text-xs no-default-hover-elevate no-default-active-elevate">
                      {client.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-client-${client.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEdit(client)} className="cursor-pointer" data-testid={`button-edit-client-${client.id}`}>
                          <Edit className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setCompetitorDialogClient(client);
                            resetCompetitorForm();
                          }}
                          className="cursor-pointer"
                          data-testid={`button-competitors-client-${client.id}`}
                        >
                          <Target className="mr-2 h-4 w-4" /> Concorrentes
                        </DropdownMenuItem>
                        {driveStatus?.connected && (
                          client.driveFolderUrl ? (
                            <DropdownMenuItem
                              onClick={() => window.open(client.driveFolderUrl!, '_blank')}
                              className="cursor-pointer"
                              data-testid={`button-open-drive-${client.id}`}
                            >
                              <FolderOpen className="mr-2 h-4 w-4" /> Abrir no Drive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => syncClientDrive.mutate(client.id)}
                              className="cursor-pointer"
                              data-testid={`button-sync-drive-menu-${client.id}`}
                            >
                              <HardDrive className="mr-2 h-4 w-4" /> Criar pasta no Drive
                            </DropdownMenuItem>
                          )
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(client.id)}
                          className="text-destructive cursor-pointer focus:text-destructive"
                          data-testid={`button-delete-client-${client.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>
              Preencha os dados do cliente abaixo.
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            client={editingClient}
            onSuccess={() => setIsDialogOpen(false)}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!competitorDialogClient} onOpenChange={(open) => {
        if (!open) {
          setCompetitorDialogClient(null);
          resetCompetitorForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Concorrentes — {competitorDialogClient?.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie os concorrentes deste cliente para acompanhamento estratégico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {competitorsForClient.length > 0 && (
              <div className="space-y-2">
                {competitorsForClient.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/40"
                    data-testid={`competitor-row-${comp.id}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{comp.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {comp.instagram && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Instagram className="w-3 h-3" /> {comp.instagram}
                          </span>
                        )}
                        {comp.facebook && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Facebook className="w-3 h-3" /> {comp.facebook}
                          </span>
                        )}
                        {comp.tiktok && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Video className="w-3 h-3" /> {comp.tiktok}
                          </span>
                        )}
                        {comp.linkedin && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Linkedin className="w-3 h-3" /> {comp.linkedin}
                          </span>
                        )}
                        {comp.website && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Globe className="w-3 h-3" /> {comp.website}
                          </span>
                        )}
                      </div>
                      {comp.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{comp.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditCompetitor(comp)}
                        data-testid={`button-edit-competitor-${comp.id}`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCompetitor.mutate(comp.id)}
                        data-testid={`button-delete-competitor-${comp.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {competitorsForClient.length === 0 && !showCompetitorForm && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum concorrente cadastrado para este cliente.</p>
              </div>
            )}

            {showCompetitorForm ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                    {editingCompetitor ? "Editar Concorrente" : "Novo Concorrente"}
                    <Button variant="ghost" size="icon" onClick={resetCompetitorForm}>
                      <X className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome *</Label>
                    <Input
                      value={competitorForm.name}
                      onChange={(e) => setCompetitorForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nome do concorrente"
                      data-testid="input-competitor-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</Label>
                      <Input
                        value={competitorForm.instagram}
                        onChange={(e) => setCompetitorForm(f => ({ ...f, instagram: e.target.value }))}
                        placeholder="@usuario"
                        data-testid="input-competitor-instagram"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Facebook className="w-3 h-3" /> Facebook</Label>
                      <Input
                        value={competitorForm.facebook}
                        onChange={(e) => setCompetitorForm(f => ({ ...f, facebook: e.target.value }))}
                        placeholder="/pagina"
                        data-testid="input-competitor-facebook"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Video className="w-3 h-3" /> TikTok</Label>
                      <Input
                        value={competitorForm.tiktok}
                        onChange={(e) => setCompetitorForm(f => ({ ...f, tiktok: e.target.value }))}
                        placeholder="@usuario"
                        data-testid="input-competitor-tiktok"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Linkedin className="w-3 h-3" /> LinkedIn</Label>
                      <Input
                        value={competitorForm.linkedin}
                        onChange={(e) => setCompetitorForm(f => ({ ...f, linkedin: e.target.value }))}
                        placeholder="/company/nome"
                        data-testid="input-competitor-linkedin"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> YouTube</Label>
                      <Input
                        value={competitorForm.youtube}
                        onChange={(e) => setCompetitorForm(f => ({ ...f, youtube: e.target.value }))}
                        placeholder="@canal"
                        data-testid="input-competitor-youtube"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> Website</Label>
                      <Input
                        value={competitorForm.website}
                        onChange={(e) => setCompetitorForm(f => ({ ...f, website: e.target.value }))}
                        placeholder="www.exemplo.com"
                        data-testid="input-competitor-website"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Textarea
                      value={competitorForm.notes}
                      onChange={(e) => setCompetitorForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Notas sobre o concorrente..."
                      className="resize-none text-sm"
                      rows={2}
                      data-testid="input-competitor-notes"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={resetCompetitorForm} data-testid="button-cancel-competitor">
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveCompetitor}
                      disabled={createCompetitor.isPending || updateCompetitor.isPending}
                      data-testid="button-save-competitor"
                    >
                      {editingCompetitor ? "Salvar" : "Adicionar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCompetitorForm(true)}
                data-testid="button-add-competitor"
              >
                <Plus className="w-4 h-4 mr-2" /> Adicionar Concorrente
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingClientId !== null} onOpenChange={(open) => {
        if (!open) setDeletingClientId(null);
      }}>
        <AlertDialogContent data-testid="dialog-confirm-delete-client">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-client"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

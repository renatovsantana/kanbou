import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useSearch } from "wouter";
import type { Client, Competitor, User } from "@shared/schema";
import { isInternalRole } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, RichTextDisplay } from "@/components/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  Package,
  Wrench,
  KeyRound,
  Users,
  Hash,
  Building2,
  Info,
  Globe,
  Sparkles,
  Palette,
  Upload,
  FileText,
  ExternalLink,
  Download,
  Link2,
  Phone,
  Mail,
  Copy,
  Check,
  Sun,
  Moon,
  Pencil,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiTiktok, SiLinkedin, SiYoutube } from "react-icons/si";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientProduct {
  id: number;
  clientId: number;
  name: string;
  description: string | null;
  createdAt: string;
}
interface ClientService {
  id: number;
  clientId: number;
  name: string;
  description: string | null;
  createdAt: string;
}
interface ClientCredential {
  id: number;
  clientId: number;
  platform: string;
  username: string | null;
  password: string | null;
  notes: string | null;
  createdAt: string;
}
const SOCIAL_PLATFORMS = [
  { value: "Instagram", icon: SiInstagram },
  { value: "Facebook", icon: SiFacebook },
  { value: "TikTok", icon: SiTiktok },
  { value: "LinkedIn", icon: SiLinkedin },
  { value: "YouTube", icon: SiYoutube },
  { value: "Blog", icon: Globe },
  { value: "Twitter/X", icon: Globe },
  { value: "Outro", icon: Globe },
];

export default function ClientOnboarding() {
  const { toast } = useToast();
  const { user } = useAuth();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialClientId = urlParams.get("clientId") || "";
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);

  useEffect(() => {
    if (initialClientId && initialClientId !== selectedClientId) {
      setSelectedClientId(initialClientId);
    }
  }, [initialClientId]);

  const clientId = selectedClientId ? Number(selectedClientId) : null;

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isInternalRole(user?.role || ""),
  });

  const clientObj = clients.find(c => c.id === clientId);
  const isClientRole = user?.role === "client";

  useEffect(() => {
    if (isClientRole && clients.length > 0 && !selectedClientId) {
      const myClient = clients[0];
      if (myClient) setSelectedClientId(String(myClient.id));
    }
  }, [isClientRole, clients, selectedClientId]);

  const { data: products = [] } = useQuery<ClientProduct[]>({
    queryKey: ["/api/onboarding", clientId, "products"],
    enabled: !!clientId,
  });
  const { data: services = [] } = useQuery<ClientService[]>({
    queryKey: ["/api/onboarding", clientId, "services"],
    enabled: !!clientId,
  });
  const { data: credentials = [] } = useQuery<ClientCredential[]>({
    queryKey: ["/api/onboarding", clientId, "credentials"],
    enabled: !!clientId,
  });
  const { data: competitors = [] } = useQuery<Competitor[]>({
    queryKey: ["/api/competitors"],
    enabled: !!clientId,
  });
  const { data: accessUserIds = [] } = useQuery<number[]>({
    queryKey: ["/api/onboarding", clientId, "access"],
    enabled: !!clientId && user?.role === "admin",
  });

  const clientCompetitors = competitors.filter(c => c.clientId === clientId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-onboarding-title">Onboarding</h1>
        {clientObj && <span className="text-lg text-muted-foreground font-medium">/ {clientObj.name}</span>}
        {!isClientRole && (
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-[260px]" data-testid="select-onboarding-client">
              <SelectValue placeholder="Selecionar cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clients.filter(c => c.isActive !== false).map(c => (
                <SelectItem key={c.id} value={String(c.id)} data-testid={`option-onboarding-client-${c.id}`}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!clientId ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground" data-testid="text-no-client-selected">
            Selecione um cliente para visualizar o onboarding.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-5">
            <AboutSection clientId={clientId} client={clientObj} />
            <NotesSection clientId={clientId} client={clientObj} />
            <MarketTagsSection clientId={clientId} client={clientObj} />
            <TagsSection clientId={clientId} client={clientObj} />
            <ProductsSection clientId={clientId} products={products} />
            <ServicesSection clientId={clientId} services={services} />
          </div>
          <div className="space-y-5">
            <LinkPageSection clientId={clientId} client={clientObj} />
            <CredentialsSection clientId={clientId} credentials={credentials} />
            <BrandIdentitySection clientId={clientId} />
            <CompetitorsSection clientId={clientId} competitors={clientCompetitors} />
            {user?.role === "admin" && (
              <AccessSection clientId={clientId} users={users} accessUserIds={accessUserIds} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AboutSection({ clientId, client }: { clientId: number; client?: Client }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState(client?.about || "");

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/clients/${clientId}/about`, { about }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditing(false);
      toast({ title: "Sobre salvo com sucesso" });
    },
  });

  return (
    <Card className="p-5" data-testid="section-about">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Sobre o Cliente</h2>
        </div>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => { setAbout(client?.about || ""); setEditing(true); }} data-testid="button-edit-about">
            Editar
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-about">
              <Save className="w-3.5 h-3.5 mr-1" /> Salvar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} data-testid="button-cancel-about">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <RichTextEditor content={about} onChange={setAbout} placeholder="Descreva o cliente, seu negócio, público-alvo..." />
      ) : (
        client?.about ? (
          <RichTextDisplay content={client.about} />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma descrição adicionada ainda.</p>
        )
      )}
    </Card>
  );
}

function NotesSection({ clientId, client }: { clientId: number; client?: Client }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(client?.notes || "");

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/clients/${clientId}/notes`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditing(false);
      toast({ title: "Anotações salvas com sucesso" });
    },
  });

  return (
    <Card className="p-5" data-testid="section-notes">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Anotações Livres</h2>
        </div>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => { setNotes(client?.notes || ""); setEditing(true); }} data-testid="button-edit-notes">
            Editar
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-notes">
              <Save className="w-3.5 h-3.5 mr-1" /> Salvar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} data-testid="button-cancel-notes">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <RichTextEditor content={notes} onChange={setNotes} placeholder="Anotações internas sobre o cliente, estratégias, observações..." />
      ) : (
        client?.notes ? (
          <RichTextDisplay content={client.notes} />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma anotação adicionada ainda.</p>
        )
      )}
    </Card>
  );
}

function TagsSection({ clientId, client }: { clientId: number; client?: Client }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState<string[]>(client?.tags || []);
  const [newTag, setNewTag] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/clients/${clientId}/tags`, { tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditing(false);
      toast({ title: "Tags salvas com sucesso" });
    },
  });

  const addTag = () => {
    const t = newTag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setNewTag("");
    }
  };

  return (
    <Card className="p-5" data-testid="section-tags">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Tags & Hashtags</h2>
        </div>
        <div className="flex gap-1 flex-wrap">
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => { setTags(client?.tags || []); setEditing(true); }} data-testid="button-edit-tags">
              Editar
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-tags">
                <Save className="w-3.5 h-3.5 mr-1" /> Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Adicionar tag..."
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
              data-testid="input-new-tag"
            />
            <Button size="sm" onClick={addTag} data-testid="button-add-tag">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                #{tag}
                <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(client?.tags || []).length > 0 ? (
            (client?.tags || []).map((tag, i) => (
              <Badge key={i} variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                #{tag}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma tag adicionada.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function MarketTagsSection({ clientId, client }: { clientId: number; client?: Client }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState<string[]>(client?.marketTags || []);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    setTags(client?.marketTags || []);
  }, [client?.marketTags]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/clients/${clientId}/market-tags`, { marketTags: tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditing(false);
      toast({ title: "Tags de mercado salvas" });
    },
  });

  const addTag = () => {
    const t = newTag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setNewTag("");
    }
  };

  return (
    <Card className="p-5" data-testid="section-market-tags">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Palavras-chave de Mercado</h2>
        </div>
        <div className="flex gap-1 flex-wrap">
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => { setTags(client?.marketTags || []); setEditing(true); }} data-testid="button-edit-market-tags">
              Editar
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-market-tags">
                <Save className="w-3.5 h-3.5 mr-1" /> Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Termos que definem o posicionamento do cliente no mercado. Usados para sugerir hashtags e acompanhar tendências.
      </p>
      {editing ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Ex: moda feminina, sustentável, premium..."
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
              data-testid="input-new-market-tag"
            />
            <Button size="sm" onClick={addTag} data-testid="button-add-market-tag">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, i) => (
              <Badge key={i} variant="outline" className="gap-1">
                {tag}
                <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(client?.marketTags || []).length > 0 ? (
            (client?.marketTags || []).map((tag, i) => (
              <Badge key={i} variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                {tag}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma palavra-chave adicionada.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function CrudSection<T extends { id: number }>({
  title,
  icon: Icon,
  items,
  clientId,
  baseUrl,
  queryKey,
  fields,
  renderItem,
}: {
  title: string;
  icon: any;
  items: T[];
  clientId: number;
  baseUrl: string;
  queryKey: any[];
  fields: { key: string; label: string; type: "text" | "textarea" | "richtext" }[];
  renderItem: (item: T, onDelete: (id: number) => void, onEdit: (item: T) => void) => React.ReactNode;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: Record<string, string>) => apiRequest("POST", `${baseUrl}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setAdding(false);
      setFormData({});
      toast({ title: `${title} adicionado` });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, string> }) =>
      apiRequest("PUT", `${baseUrl.replace(/\/\d+\//, "/").replace(/\/[^/]+$/, "")}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingItem(null);
      setFormData({});
      toast({ title: `${title} atualizado` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `${baseUrl.replace(/\/\d+\//, "/").replace(/\/[^/]+$/, "")}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: `${title} removido` });
    },
  });

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const startEdit = (item: T) => {
    setEditingItem(item);
    const data: Record<string, string> = {};
    fields.forEach(f => { data[f.key] = (item as any)[f.key] || ""; });
    setFormData(data);
    setAdding(true);
  };

  return (
    <Card className="p-5" data-testid={`section-${title.toLowerCase()}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">{title}</h2>
          <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">{items.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setEditingItem(null); setFormData({}); }} data-testid={`button-add-${title.toLowerCase()}`}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {adding && (
        <div className="border rounded-md p-3 mb-3 space-y-2 bg-muted/30">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              {f.type === "richtext" ? (
                <RichTextEditor
                  content={formData[f.key] || ""}
                  onChange={(val) => setFormData({ ...formData, [f.key]: val })}
                  placeholder={f.label}
                />
              ) : f.type === "textarea" ? (
                <Textarea
                  value={formData[f.key] || ""}
                  onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                  className="mt-1"
                  data-testid={`input-${f.key}`}
                />
              ) : (
                <Input
                  value={formData[f.key] || ""}
                  onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                  className="mt-1"
                  data-testid={`input-${f.key}`}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-item">
              <Save className="w-3.5 h-3.5 mr-1" /> {editingItem ? "Atualizar" : "Salvar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setEditingItem(null); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">Nenhum item cadastrado.</p>
        ) : (
          items.map(item => renderItem(item, (id) => deleteMutation.mutate(id), startEdit))
        )}
      </div>
    </Card>
  );
}

function ProductsSection({ clientId, products }: { clientId: number; products: ClientProduct[] }) {
  return (
    <CrudSection
      title="Produtos"
      icon={Package}
      items={products}
      clientId={clientId}
      baseUrl={`/api/onboarding/${clientId}/products`}
      queryKey={["/api/onboarding", clientId, "products"]}
      fields={[
        { key: "name", label: "Nome do Produto", type: "text" },
        { key: "description", label: "Descrição", type: "richtext" },
      ]}
      renderItem={(item, onDelete, onEdit) => (
        <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-md bg-muted/20 group" data-testid={`product-${item.id}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{item.name}</p>
            {item.description && <RichTextDisplay content={item.description} />}
          </div>
          <div className="flex gap-1 shrink-0 invisible group-hover:visible">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)} data-testid={`button-edit-product-${item.id}`}>
              <Save className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)} data-testid={`button-delete-product-${item.id}`}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    />
  );
}

function ServicesSection({ clientId, services }: { clientId: number; services: ClientService[] }) {
  return (
    <CrudSection
      title="Serviços"
      icon={Wrench}
      items={services}
      clientId={clientId}
      baseUrl={`/api/onboarding/${clientId}/services`}
      queryKey={["/api/onboarding", clientId, "services"]}
      fields={[
        { key: "name", label: "Nome do Serviço", type: "text" },
        { key: "description", label: "Descrição", type: "richtext" },
      ]}
      renderItem={(item, onDelete, onEdit) => (
        <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-md bg-muted/20 group" data-testid={`service-${item.id}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{item.name}</p>
            {item.description && <RichTextDisplay content={item.description} />}
          </div>
          <div className="flex gap-1 shrink-0 invisible group-hover:visible">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)} data-testid={`button-edit-service-${item.id}`}>
              <Save className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)} data-testid={`button-delete-service-${item.id}`}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    />
  );
}

function CredentialsSection({ clientId, credentials }: { clientId: number; credentials: ClientCredential[] }) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [form, setForm] = useState({ platform: "", username: "", password: "", notes: "" });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/onboarding/${clientId}/credentials`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", clientId, "credentials"] });
      setAdding(false);
      setForm({ platform: "", username: "", password: "", notes: "" });
      toast({ title: "Credencial adicionada" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/onboarding/credentials/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", clientId, "credentials"] });
      setEditingId(null);
      toast({ title: "Credencial atualizada" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/onboarding/credentials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", clientId, "credentials"] });
      toast({ title: "Credencial removida" });
    },
  });

  const PlatformIcon = ({ platform }: { platform: string }) => {
    const found = SOCIAL_PLATFORMS.find(p => p.value === platform);
    if (!found) return <Globe className="w-4 h-4" />;
    const IconComp = found.icon;
    return <IconComp className="w-4 h-4" />;
  };

  return (
    <Card className="p-5" data-testid="section-credentials">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Credenciais de Redes Sociais</h2>
          <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">{credentials.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setForm({ platform: "", username: "", password: "", notes: "" }); }} data-testid="button-add-credential">
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {adding && (
        <div className="border rounded-md p-3 mb-3 space-y-2 bg-muted/30">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Plataforma</label>
            <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
              <SelectTrigger className="mt-1" data-testid="select-credential-platform">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_PLATFORMS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Usuário / E-mail</label>
            <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="mt-1" data-testid="input-credential-username" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Senha</label>
            <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="mt-1" type="text" data-testid="input-credential-password" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1" data-testid="input-credential-notes" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.platform} data-testid="button-save-credential">
              <Save className="w-3.5 h-3.5 mr-1" /> Salvar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {credentials.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">Nenhuma credencial cadastrada.</p>
        ) : (
          credentials.map(cred => (
            <div key={cred.id} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/20 group" data-testid={`credential-${cred.id}`}>
              <PlatformIcon platform={cred.platform} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{cred.platform}</p>
                <p className="text-xs text-muted-foreground">{cred.username || "-"}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-xs text-muted-foreground font-mono">
                    {showPasswords[cred.id] ? cred.password || "-" : "••••••••"}
                  </p>
                  <button
                    onClick={() => setShowPasswords(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))}
                    className="text-muted-foreground/50 hover:text-muted-foreground"
                    data-testid={`button-toggle-password-${cred.id}`}
                  >
                    {showPasswords[cred.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                {cred.notes && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{cred.notes}</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive invisible group-hover:visible shrink-0" onClick={() => deleteMutation.mutate(cred.id)} data-testid={`button-delete-credential-${cred.id}`}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function CompetitorsSection({ clientId, competitors }: { clientId: number; competitors: Competitor[] }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [competitorToDelete, setCompetitorToDelete] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", instagram: "", facebook: "", tiktok: "", linkedin: "", youtube: "", website: "", notes: "" });

  const resetForm = () => {
    setForm({ name: "", instagram: "", facebook: "", tiktok: "", linkedin: "", youtube: "", website: "", notes: "" });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (comp: Competitor) => {
    setForm({
      name: comp.name || "",
      instagram: comp.instagram || "",
      facebook: comp.facebook || "",
      tiktok: comp.tiktok || "",
      linkedin: comp.linkedin || "",
      youtube: comp.youtube || "",
      website: comp.website || "",
      notes: comp.notes || "",
    });
    setEditing(comp);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    try {
      if (editing) {
        await apiRequest("PUT", `/api/competitors/${editing.id}`, form);
        toast({ title: "Concorrente atualizado" });
      } else {
        await apiRequest("POST", "/api/competitors", { ...form, clientId });
        toast({ title: "Concorrente cadastrado" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/competitors"] });
      resetForm();
    } catch {
      toast({ title: "Erro ao salvar concorrente", variant: "destructive" });
    }
  };

  const handleDeleteConfirm = async () => {
    if (competitorToDelete === null) return;
    try {
      await apiRequest("DELETE", `/api/competitors/${competitorToDelete}`);
      queryClient.invalidateQueries({ queryKey: ["/api/competitors"] });
      toast({ title: "Concorrente removido" });
    } catch {
      toast({ title: "Erro ao remover concorrente", variant: "destructive" });
    }
    setCompetitorToDelete(null);
  };

  return (
    <Card className="p-5" data-testid="section-competitors">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Concorrentes</h2>
          <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">{competitors.length}</Badge>
        </div>
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)} data-testid="button-add-competitor">
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        )}
      </div>

      {showForm && (
        <div className="p-3 rounded-md bg-muted/30 mb-3 space-y-2" data-testid="competitor-form">
          <Input
            placeholder="Nome do concorrente *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            data-testid="input-competitor-name"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <SiInstagram className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Instagram" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} data-testid="input-competitor-instagram" />
            </div>
            <div className="relative">
              <SiFacebook className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Facebook" value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} data-testid="input-competitor-facebook" />
            </div>
            <div className="relative">
              <SiTiktok className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="TikTok" value={form.tiktok} onChange={e => setForm(f => ({ ...f, tiktok: e.target.value }))} data-testid="input-competitor-tiktok" />
            </div>
            <div className="relative">
              <SiLinkedin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="LinkedIn" value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} data-testid="input-competitor-linkedin" />
            </div>
            <div className="relative">
              <SiYoutube className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="YouTube" value={form.youtube} onChange={e => setForm(f => ({ ...f, youtube: e.target.value }))} data-testid="input-competitor-youtube" />
            </div>
            <div className="relative">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} data-testid="input-competitor-website" />
            </div>
          </div>
          <Textarea
            placeholder="Observações (opcional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="resize-none text-sm"
            rows={2}
            data-testid="input-competitor-notes"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={resetForm} data-testid="button-cancel-competitor">Cancelar</Button>
            <Button size="sm" onClick={handleSave} data-testid="button-save-competitor">
              <Save className="w-3.5 h-3.5 mr-1" /> {editing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {competitors.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground">Nenhum concorrente cadastrado.</p>
        ) : (
          competitors.map(comp => (
            <div key={comp.id} className="p-2.5 rounded-md bg-muted/20 group" data-testid={`competitor-${comp.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{comp.name}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {comp.instagram && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <SiInstagram className="w-3 h-3" /> {comp.instagram}
                      </span>
                    )}
                    {comp.facebook && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <SiFacebook className="w-3 h-3" /> {comp.facebook}
                      </span>
                    )}
                    {comp.tiktok && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <SiTiktok className="w-3 h-3" /> {comp.tiktok}
                      </span>
                    )}
                    {comp.linkedin && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <SiLinkedin className="w-3 h-3" /> {comp.linkedin}
                      </span>
                    )}
                    {comp.youtube && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <SiYoutube className="w-3 h-3" /> {comp.youtube}
                      </span>
                    )}
                    {comp.website && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Globe className="w-3 h-3" /> {comp.website}
                      </span>
                    )}
                  </div>
                  {comp.notes && <p className="text-[10px] text-muted-foreground/60 mt-1">{comp.notes}</p>}
                </div>
                <div className="flex items-center gap-0.5 invisible group-hover:visible">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(comp)} data-testid={`button-edit-competitor-${comp.id}`} title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setCompetitorToDelete(comp.id)} data-testid={`button-delete-competitor-${comp.id}`} title="Remover">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={competitorToDelete !== null} onOpenChange={(open) => !open && setCompetitorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover concorrente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este concorrente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-competitor">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-competitor"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AccessSection({ clientId, users, accessUserIds }: { clientId: number; users: User[]; accessUserIds: number[] }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<number[]>(accessUserIds);
  const [editing, setEditing] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/onboarding/${clientId}/access`, { userIds: selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", clientId, "access"] });
      setEditing(false);
      toast({ title: "Acesso atualizado" });
    },
  });

  const toggleUser = (userId: number) => {
    setSelected(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  return (
    <Card className="p-5" data-testid="section-access">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Controle de Acesso</h2>
        </div>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => { setSelected(accessUserIds); setEditing(true); }} data-testid="button-edit-access">
            Editar
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-access">
              <Save className="w-3.5 h-3.5 mr-1" /> Salvar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {users.filter(u => u.isActive !== false && (u.role !== "client" || u.clientId === clientId)).map(u => (
            <label
              key={u.id}
              className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover-elevate"
              data-testid={`access-user-${u.id}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggleUser(u.id)}
                className="rounded"
              />
              <span className="text-sm">{u.name}</span>
              <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{u.role}</Badge>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {accessUserIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os usuários têm acesso (nenhuma restrição).</p>
          ) : (
            accessUserIds.map(uid => {
              const u = users.find(u => u.id === uid);
              return u ? (
                <div key={uid} className="flex items-center gap-2 p-1.5" data-testid={`access-display-${uid}`}>
                  <span className="text-sm">{u.name}</span>
                  <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{u.role}</Badge>
                </div>
              ) : null;
            })
          )}
        </div>
      )}
    </Card>
  );
}

interface BrandIdentityFileData {
  id: number;
  clientId: number;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  driveFileId: string | null;
  driveUrl: string | null;
  category: string | null;
  uploadedBy: number | null;
  createdAt: string;
}

function BrandIdentitySection({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("manual");
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);
  const isEditor = isInternalRole(user?.role || "");

  const { data: files = [] } = useQuery<BrandIdentityFileData[]>({
    queryKey: ["/api/clients", clientId, "brand-identity"],
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      const res = await fetch(`/api/clients/${clientId}/brand-identity`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao enviar");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "brand-identity"] });
      toast({ title: "Arquivo enviado com sucesso" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao enviar arquivo", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (fileId: number) => {
    try {
      await apiRequest("DELETE", `/api/brand-identity/${fileId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "brand-identity"] });
      toast({ title: "Arquivo removido" });
    } catch {
      toast({ title: "Erro ao remover arquivo", variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const CATEGORY_LABELS: Record<string, string> = {
    manual: "Manual da Marca",
    editavel: "Arquivo Editável",
    logo: "Logo",
    tipografia: "Tipografia",
    paleta: "Paleta de Cores",
    geral: "Geral",
  };

  return (
    <Card className="p-5" data-testid="section-brand-identity">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Identidade Visual</h2>
        </div>
        <Badge variant="secondary" className="text-xs">{files.length} arquivo{files.length !== 1 ? "s" : ""}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]" data-testid="select-brand-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" disabled={uploading} asChild>
          <label className="cursor-pointer" data-testid="button-upload-brand-file">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
            Enviar Arquivo
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </Button>
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-brand-files">
          Nenhum arquivo de identidade visual adicionado.
        </p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50" data-testid={`brand-file-${f.id}`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.fileName}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                      {CATEGORY_LABELS[f.category || "geral"] || f.category}
                    </Badge>
                    {f.fileSize && (
                      <span className="text-[10px] text-muted-foreground">{formatFileSize(f.fileSize)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {f.driveFileId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/drive/file/${f.driveFileId}/download`, { credentials: "include" });
                        const data = await res.json();
                        if (data.downloadUrl) {
                          const link = document.createElement("a");
                          link.href = data.downloadUrl;
                          link.target = "_blank";
                          link.download = f.fileName;
                          link.click();
                        }
                      } catch {
                        toast({ title: "Erro ao baixar arquivo", variant: "destructive" });
                      }
                    }}
                    data-testid={`button-download-brand-${f.id}`}
                    title="Baixar arquivo"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
                {f.driveUrl && (
                  <Button variant="ghost" size="icon" asChild title="Abrir no Drive">
                    <a href={f.driveUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-drive-${f.id}`}>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                {isEditor && (
                  <Button variant="ghost" size="icon" onClick={() => setFileToDelete(f.id)} data-testid={`button-delete-brand-${f.id}`} title="Remover arquivo">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={fileToDelete !== null} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover arquivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este arquivo da identidade visual? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-brand">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-brand"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (fileToDelete !== null) {
                  handleDelete(fileToDelete);
                  setFileToDelete(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const LINK_ICON_OPTIONS = [
  { value: "link", label: "Link" },
  { value: "shopping-bag", label: "Loja" },
  { value: "calendar", label: "Agenda" },
  { value: "file-text", label: "Documento" },
  { value: "map-pin", label: "Localização" },
  { value: "headphones", label: "Podcast" },
  { value: "video", label: "Vídeo" },
  { value: "music", label: "Música" },
  { value: "gift", label: "Promoção" },
  { value: "star", label: "Destaque" },
  { value: "heart", label: "Favorito" },
  { value: "message-circle", label: "Chat" },
  { value: "book-open", label: "Blog" },
  { value: "briefcase", label: "Portfolio" },
  { value: "utensils", label: "Cardápio" },
];

interface CustomLinkItem {
  id?: number;
  name: string;
  url: string;
  icon: string;
}

function LinkPageSection({ clientId, client }: { clientId: number; client?: Client }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditor = isInternalRole(user?.role || "");
  const canEditLinkPage = isEditor || user?.role === "client";
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    bio: client?.bio || "",
    whatsapp: client?.whatsapp || "",
    website: client?.website || "",
    facebook: client?.facebook || "",
    tiktok: client?.tiktok || "",
    linkedin: client?.linkedin || "",
    youtube: client?.youtube || "",
    primaryColor: client?.primaryColor || "#84cc16",
    secondaryColor: client?.secondaryColor || "#1a1a2e",
    slug: client?.slug || "",
  });

  const parseVisibility = (raw: string | null | undefined): Record<string, boolean> => {
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  };

  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => parseVisibility(client?.linkPageVisibility));
  const [linkPageTheme, setLinkPageTheme] = useState<string>(client?.linkPageTheme || "auto");
  const [newLink, setNewLink] = useState<CustomLinkItem>({ name: "", url: "", icon: "link" });

  const { data: customLinks = [], refetch: refetchLinks } = useQuery<CustomLinkItem[]>({
    queryKey: ["/api/onboarding", clientId, "custom-links"],
    enabled: !!clientId,
  });

  useEffect(() => {
    if (client) {
      setForm({
        bio: client.bio || "",
        whatsapp: client.whatsapp || "",
        website: client.website || "",
        facebook: client.facebook || "",
        tiktok: client.tiktok || "",
        linkedin: client.linkedin || "",
        youtube: client.youtube || "",
        primaryColor: client.primaryColor || "#84cc16",
        secondaryColor: client.secondaryColor || "#1a1a2e",
        slug: client.slug || "",
      });
      setVisibility(parseVisibility(client.linkPageVisibility));
      setLinkPageTheme(client.linkPageTheme || "auto");
    }
  }, [client]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const toggleVisibility = (field: string) => {
    setVisibility(v => ({ ...v, [field]: v[field] === false ? true : false }));
  };

  const isVisible = (field: string) => visibility[field] !== false;

  const saveMutation = useMutation({
    mutationFn: () => {
      const slug = form.slug || generateSlug(client?.name || "");
      return apiRequest("PUT", `/api/onboarding/${clientId}/linkpage`, {
        bio: form.bio || null,
        whatsapp: form.whatsapp || null,
        website: form.website || null,
        facebook: form.facebook || null,
        tiktok: form.tiktok || null,
        linkedin: form.linkedin || null,
        youtube: form.youtube || null,
        primaryColor: form.primaryColor || null,
        secondaryColor: form.secondaryColor || null,
        slug,
        linkPageVisibility: JSON.stringify(visibility),
        linkPageTheme,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditing(false);
      toast({ title: "Link Page salvo com sucesso" });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("slug") || msg.includes("unique")) {
        toast({ title: "Este slug já está em uso. Escolha outro.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao salvar Link Page", variant: "destructive" });
      }
    },
  });

  const addLinkMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/onboarding/${clientId}/custom-links`, { name: newLink.name, url: newLink.url, icon: newLink.icon, position: customLinks.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", clientId, "custom-links"] });
      setNewLink({ name: "", url: "", icon: "link" });
      toast({ title: "Link adicionado" });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/custom-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", clientId, "custom-links"] });
      toast({ title: "Link removido" });
    },
  });

  const linkUrl = client?.slug ? `${window.location.origin}/link/${client.slug}` : null;

  const copyLink = () => {
    if (linkUrl) {
      navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copiado!" });
    }
  };

  const VISIBILITY_FIELDS = [
    { key: "phone", label: "Telefone", icon: Phone },
    { key: "whatsapp", label: "WhatsApp", icon: Phone },
    { key: "email", label: "Email", icon: Mail },
    { key: "website", label: "Site", icon: Globe },
    { key: "instagram", label: "Instagram", icon: SiInstagram },
    { key: "facebook", label: "Facebook", icon: SiFacebook },
    { key: "tiktok", label: "TikTok", icon: SiTiktok },
    { key: "linkedin", label: "LinkedIn", icon: SiLinkedin },
    { key: "youtube", label: "YouTube", icon: SiYoutube },
    { key: "products", label: "Produtos", icon: Package },
    { key: "services", label: "Serviços", icon: Wrench },
  ];

  return (
    <Card className="p-5" data-testid="section-linkpage">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Link Page</h2>
        </div>
        {canEditLinkPage && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-linkpage">
            <Sparkles className="w-4 h-4 mr-1" /> Editar
          </Button>
        )}
        {editing && (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-linkpage">
              <Save className="w-4 h-4 mr-1" /> Salvar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} data-testid="button-cancel-linkpage">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {linkUrl && (
        <div className="flex items-center gap-2 mb-4 p-2 rounded-md bg-muted/50">
          <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
          <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate" data-testid="link-linkpage-url">
            {linkUrl}
          </a>
          <Button variant="ghost" size="icon" onClick={copyLink} data-testid="button-copy-link">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
          <a href={linkUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" data-testid="button-open-linkpage">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>
      )}

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Slug (URL)</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">/link/</span>
              <Input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                placeholder={generateSlug(client?.name || "")}
                data-testid="input-linkpage-slug"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Bio / Descrição curta</label>
            <Textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Breve descrição do negócio..."
              data-testid="input-linkpage-bio"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">WhatsApp</label>
              <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="5511999999999" data-testid="input-linkpage-whatsapp" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Site</label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." data-testid="input-linkpage-website" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Facebook</label>
              <Input value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} placeholder="URL do Facebook" data-testid="input-linkpage-facebook" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">TikTok</label>
              <Input value={form.tiktok} onChange={e => setForm(f => ({ ...f, tiktok: e.target.value }))} placeholder="URL do TikTok" data-testid="input-linkpage-tiktok" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">LinkedIn</label>
              <Input value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} placeholder="URL do LinkedIn" data-testid="input-linkpage-linkedin" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">YouTube</label>
              <Input value={form.youtube} onChange={e => setForm(f => ({ ...f, youtube: e.target.value }))} placeholder="URL do YouTube" data-testid="input-linkpage-youtube" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Cor Primária</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-10 h-9 rounded cursor-pointer border-0" data-testid="input-linkpage-primary-color" />
                <Input value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="flex-1" />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Cor Secundária</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.secondaryColor} onChange={e => setForm(f => ({ ...f, secondaryColor: e.target.value }))} className="w-10 h-9 rounded cursor-pointer border-0" data-testid="input-linkpage-secondary-color" />
                <Input value={form.secondaryColor} onChange={e => setForm(f => ({ ...f, secondaryColor: e.target.value }))} className="flex-1" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Tema Padrão da Link Page</label>
            <div className="flex gap-2">
              {[
                { value: "auto", label: "Automático", desc: "Segue o dispositivo" },
                { value: "light", label: "Claro", desc: "Sempre claro" },
                { value: "dark", label: "Escuro", desc: "Sempre escuro" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLinkPageTheme(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-md border text-sm transition-colors ${linkPageTheme === opt.value ? "bg-primary/10 border-primary/30 text-foreground" : "bg-muted/30 border-muted text-muted-foreground"}`}
                  data-testid={`button-theme-${opt.value}`}
                >
                  {opt.value === "auto" && <Globe className="w-4 h-4" />}
                  {opt.value === "light" && <Sun className="w-4 h-4" />}
                  {opt.value === "dark" && <Moon className="w-4 h-4" />}
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Visibilidade na Link Page</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VISIBILITY_FIELDS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleVisibility(f.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${isVisible(f.key) ? "bg-primary/10 border-primary/30 text-foreground" : "bg-muted/30 border-muted text-muted-foreground line-through"}`}
                  data-testid={`toggle-visibility-${f.key}`}
                >
                  <f.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{f.label}</span>
                  {isVisible(f.key) ? <Eye className="w-3 h-3 ml-auto shrink-0 text-primary" /> : <EyeOff className="w-3 h-3 ml-auto shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Links Personalizados</label>
            {customLinks.length > 0 && (
              <div className="space-y-2 mb-3">
                {customLinks.map((cl: any) => (
                  <div key={cl.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20" data-testid={`custom-link-${cl.id}`}>
                    <Badge variant="outline" className="shrink-0">{LINK_ICON_OPTIONS.find(o => o.value === cl.icon)?.label || cl.icon}</Badge>
                    <span className="text-sm font-medium truncate">{cl.name}</span>
                    <span className="text-xs text-muted-foreground truncate flex-1">{cl.url}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteLinkMutation.mutate(cl.id)} data-testid={`button-delete-custom-link-${cl.id}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 p-3 rounded-md border border-dashed">
              <div className="flex items-center gap-2">
                <Input value={newLink.name} onChange={e => setNewLink(l => ({ ...l, name: e.target.value }))} placeholder="Nome do link" className="flex-1" data-testid="input-custom-link-name" />
                <Select value={newLink.icon} onValueChange={v => setNewLink(l => ({ ...l, icon: v }))}>
                  <SelectTrigger className="w-[130px]" data-testid="select-custom-link-icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_ICON_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input value={newLink.url} onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))} placeholder="https://..." className="flex-1" data-testid="input-custom-link-url" />
                <Button
                  size="sm"
                  onClick={() => addLinkMutation.mutate()}
                  disabled={!newLink.name || !newLink.url || addLinkMutation.isPending}
                  data-testid="button-add-custom-link"
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {!client?.slug && (
            <p className="text-muted-foreground italic" data-testid="text-linkpage-not-configured">
              Link page não configurado. Clique em "Editar" para configurar.
            </p>
          )}
          {client?.bio && <p className="text-muted-foreground" data-testid="text-linkpage-bio">{client.bio}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {client?.whatsapp && <Badge variant="outline"><Phone className="w-3 h-3 mr-1" /> WhatsApp</Badge>}
            {client?.website && <Badge variant="outline"><Globe className="w-3 h-3 mr-1" /> Site</Badge>}
            {client?.facebook && <Badge variant="outline"><SiFacebook className="w-3 h-3 mr-1" /> Facebook</Badge>}
            {client?.tiktok && <Badge variant="outline"><SiTiktok className="w-3 h-3 mr-1" /> TikTok</Badge>}
            {client?.linkedin && <Badge variant="outline"><SiLinkedin className="w-3 h-3 mr-1" /> LinkedIn</Badge>}
            {client?.youtube && <Badge variant="outline"><SiYoutube className="w-3 h-3 mr-1" /> YouTube</Badge>}
          </div>
          {customLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {customLinks.map((cl: any) => (
                <Badge key={cl.id} variant="outline"><Link2 className="w-3 h-3 mr-1" /> {cl.name}</Badge>
              ))}
            </div>
          )}
          {(client?.primaryColor || client?.secondaryColor) && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-muted-foreground">Cores:</span>
              <div className="w-6 h-6 rounded-md border" style={{ backgroundColor: client?.primaryColor || "#84cc16" }} />
              <div className="w-6 h-6 rounded-md border" style={{ backgroundColor: client?.secondaryColor || "#1a1a2e" }} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

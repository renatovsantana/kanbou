import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, HardDrive, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Trash2, ExternalLink } from "lucide-react";
import { Redirect } from "wouter";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showFields, setShowFields] = useState(false);
  const [showValues, setShowValues] = useState({ clientId: false, clientSecret: false, refreshToken: false });
  const [form, setForm] = useState({ googleClientId: "", googleClientSecret: "", googleRefreshToken: "" });

  if (user?.role !== "admin") {
    return <Redirect to="/" />;
  }

  const { data: driveSettings, isLoading: settingsLoading } = useQuery<{
    googleClientId: string;
    googleClientSecret: string;
    googleRefreshToken: string;
    hasCredentials: boolean;
  }>({
    queryKey: ["/api/settings/drive"],
  });

  const { data: driveStatus } = useQuery<{ connected: boolean; user?: { email: string; name: string } }>({
    queryKey: ["/api/drive/status"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/settings/drive", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/drive"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drive/status"] });
      toast({ title: "Credenciais salvas com sucesso!" });
      if (data.user) {
        toast({ title: `Conectado como ${data.user.name} (${data.user.email})` });
      }
      setShowFields(false);
      setForm({ googleClientId: "", googleClientSecret: "", googleRefreshToken: "" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao salvar credenciais", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/settings/drive"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/drive"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drive/status"] });
      toast({ title: "Credenciais removidas" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.googleClientId || !form.googleClientSecret || !form.googleRefreshToken) {
      toast({ title: "Preencha todas as credenciais", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  const isConnected = driveStatus?.connected === true;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Configurações</h1>
      </div>

      <Card data-testid="card-drive-settings">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Google Drive</CardTitle>
            </div>
            {settingsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isConnected ? (
              <Badge variant="default" className="bg-green-600 dark:bg-green-700" data-testid="badge-drive-connected">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
              </Badge>
            ) : driveSettings?.hasCredentials ? (
              <Badge variant="destructive" data-testid="badge-drive-error">
                <XCircle className="w-3 h-3 mr-1" /> Erro na conexão
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid="badge-drive-disconnected">
                <XCircle className="w-3 h-3 mr-1" /> Não configurado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O Google Drive é usado para armazenar arquivos de identidade visual, anexos de cards do Kanban e aprovações. 
            Configure as credenciais OAuth2 para conectar o Drive da agência.
          </p>

          {isConnected && driveStatus?.user && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-green-50 dark:bg-green-950/30" data-testid="info-drive-user">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium">{driveStatus.user.name}</p>
                <p className="text-xs text-muted-foreground">{driveStatus.user.email}</p>
              </div>
            </div>
          )}

          {driveSettings?.hasCredentials && !showFields && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-32">Client ID:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{driveSettings.googleClientId}</code>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-32">Client Secret:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{driveSettings.googleClientSecret}</code>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-32">Refresh Token:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{driveSettings.googleRefreshToken}</code>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowFields(true)} data-testid="button-edit-drive">
                  Atualizar Credenciais
                </Button>
                <Button variant="outline" size="sm" onClick={() => removeMutation.mutate()} disabled={removeMutation.isPending} data-testid="button-remove-drive">
                  <Trash2 className="w-4 h-4 mr-1" /> Remover
                </Button>
              </div>
            </div>
          )}

          {(!driveSettings?.hasCredentials || showFields) && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted/50 space-y-2">
                <p className="text-sm font-medium">Como obter as credenciais:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a> e crie um projeto</li>
                  <li>Ative a <strong>Google Drive API</strong> em APIs e Serviços &gt; Biblioteca</li>
                  <li>Crie credenciais OAuth 2.0 (Tipo: Aplicativo da Web)</li>
                  <li>Adicione <code className="bg-muted px-1 rounded">https://developers.google.com/oauthplayground</code> como URI de redirecionamento</li>
                  <li>No <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-primary underline">OAuth Playground <ExternalLink className="w-3 h-3 inline" /></a>, use suas credenciais para gerar o Refresh Token</li>
                </ol>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="googleClientId">Client ID</Label>
                  <div className="relative">
                    <Input
                      id="googleClientId"
                      type={showValues.clientId ? "text" : "password"}
                      placeholder="Cole o Client ID aqui"
                      value={form.googleClientId}
                      onChange={(e) => setForm({ ...form, googleClientId: e.target.value })}
                      data-testid="input-google-client-id"
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowValues(v => ({ ...v, clientId: !v.clientId }))}>
                      {showValues.clientId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="googleClientSecret">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="googleClientSecret"
                      type={showValues.clientSecret ? "text" : "password"}
                      placeholder="Cole o Client Secret aqui"
                      value={form.googleClientSecret}
                      onChange={(e) => setForm({ ...form, googleClientSecret: e.target.value })}
                      data-testid="input-google-client-secret"
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowValues(v => ({ ...v, clientSecret: !v.clientSecret }))}>
                      {showValues.clientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="googleRefreshToken">Refresh Token</Label>
                  <div className="relative">
                    <Input
                      id="googleRefreshToken"
                      type={showValues.refreshToken ? "text" : "password"}
                      placeholder="Cole o Refresh Token aqui"
                      value={form.googleRefreshToken}
                      onChange={(e) => setForm({ ...form, googleRefreshToken: e.target.value })}
                      data-testid="input-google-refresh-token"
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowValues(v => ({ ...v, refreshToken: !v.refreshToken }))}>
                      {showValues.refreshToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-drive">
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Salvar e Testar Conexão
                  </Button>
                  {showFields && driveSettings?.hasCredentials && (
                    <Button type="button" variant="outline" onClick={() => setShowFields(false)} data-testid="button-cancel-edit-drive">
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

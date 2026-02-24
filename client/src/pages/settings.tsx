import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, HardDrive, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Trash2, ExternalLink, Upload, Image, Palette, Building2, Sparkles, X } from "lucide-react";
import { Redirect } from "wouter";

type BrandingData = {
  systemName: string;
  systemLogo: string;
  systemFavicon: string;
  systemTheme: string;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { brandTheme, setBrandTheme } = useTheme();
  const [showFields, setShowFields] = useState(false);
  const [showValues, setShowValues] = useState({ clientId: false, clientSecret: false, refreshToken: false });
  const [form, setForm] = useState({ googleClientId: "", googleClientSecret: "", googleRefreshToken: "" });

  const [systemName, setSystemName] = useState("");
  const [systemNameLoaded, setSystemNameLoaded] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";

  const { data: branding, isLoading: brandingLoading } = useQuery<BrandingData>({
    queryKey: ["/api/settings/branding"],
    enabled: isAdmin,
  });

  useEffect(() => {
    if (branding && !systemNameLoaded) {
      setSystemName(branding.systemName || "");
      setSystemNameLoaded(true);
    }
  }, [branding, systemNameLoaded]);

  const { data: driveSettings, isLoading: settingsLoading } = useQuery<{
    googleClientId: string;
    googleClientSecret: string;
    googleRefreshToken: string;
    hasCredentials: boolean;
  }>({
    queryKey: ["/api/settings/drive"],
    enabled: isAdmin,
  });

  const { data: driveStatus } = useQuery<{ connected: boolean; user?: { email: string; name: string } }>({
    queryKey: ["/api/drive/status"],
    enabled: isAdmin,
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

  const brandingMutation = useMutation({
    mutationFn: async (data: { systemName?: string; systemTheme?: string }) => {
      const res = await apiRequest("PUT", "/api/settings/branding", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/branding"] });
      toast({ title: "Configurações salvas!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  if (!isAdmin) {
    return <Redirect to="/" />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.googleClientId || !form.googleClientSecret || !form.googleRefreshToken) {
      toast({ title: "Preencha todas as credenciais", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  const handleSaveBranding = () => {
    brandingMutation.mutate({ systemName });
  };

  const handleSelectTheme = (theme: "classic" | "business" | "creative") => {
    setBrandTheme(theme);
    brandingMutation.mutate({ systemTheme: theme });
  };

  const handleUpload = async (type: "logo" | "favicon", file: File) => {
    if (type === "logo") setUploadingLogo(true);
    else setUploadingFavicon(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/uploads/system/${type}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao enviar");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/settings/branding"] });
      toast({ title: type === "logo" ? "Logo atualizada!" : "Favicon atualizado!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao fazer upload", variant: "destructive" });
    } finally {
      if (type === "logo") setUploadingLogo(false);
      else setUploadingFavicon(false);
    }
  };

  const isConnected = driveStatus?.connected === true;

  const themes = [
    {
      id: "classic" as const,
      name: "Clássico",
      description: "Verde moderno, visual limpo e profissional",
      icon: Palette,
      colors: ["hsl(142 50% 45%)", "hsl(220 15% 13%)", "hsl(210 10% 96%)"],
    },
    {
      id: "business" as const,
      name: "Business",
      description: "Azul corporativo, elegante e sofisticado",
      icon: Building2,
      colors: ["hsl(224 60% 48%)", "hsl(222 22% 11%)", "hsl(220 14% 96%)"],
    },
    {
      id: "creative" as const,
      name: "Criativo",
      description: "Laranja vibrante, ousado e moderno",
      icon: Sparkles,
      colors: ["hsl(18 82% 48%)", "hsl(16 30% 12%)", "hsl(30 15% 96%)"],
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Configurações</h1>
      </div>

      <Card data-testid="card-branding-settings">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Identidade do Sistema</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure o nome, logo e favicon que aparecem em todo o sistema.
          </p>

          <div className="space-y-2">
            <Label htmlFor="systemName">Nome do Sistema</Label>
            <div className="flex gap-2">
              <Input
                id="systemName"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                placeholder="Ex: Minha Agência"
                data-testid="input-system-name"
              />
              <Button
                onClick={handleSaveBranding}
                disabled={brandingMutation.isPending}
                data-testid="button-save-system-name"
              >
                {brandingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Logo do Sistema</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/50" data-testid="preview-system-logo">
                  {branding?.systemLogo ? (
                    <img src={branding.systemLogo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Image className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    data-testid="button-upload-logo"
                  >
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}
                    Enviar Logo
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG ou SVG. Máx 5MB.</p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload("logo", f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Favicon</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/50" data-testid="preview-system-favicon">
                  {branding?.systemFavicon ? (
                    <img src={branding.systemFavicon} alt="Favicon" className="w-8 h-8 object-contain" />
                  ) : (
                    <Image className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={uploadingFavicon}
                    data-testid="button-upload-favicon"
                  >
                    {uploadingFavicon ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}
                    Enviar Favicon
                  </Button>
                  <p className="text-[11px] text-muted-foreground">ICO, PNG. Será redimensionado para 64x64.</p>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload("favicon", f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-theme-settings">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Tema do Sistema</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-5">
            Escolha o esquema de cores para todo o sistema. A mudança é aplicada imediatamente para todos os usuários.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themes.map((t) => {
              const isActive = (branding?.systemTheme || "classic") === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover-elevate"
                  }`}
                  data-testid={`button-theme-${t.id}`}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{t.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{t.description}</p>
                  <div className="flex gap-1.5">
                    {t.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-md border border-border/50"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

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

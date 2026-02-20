import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type InsertClient, type Client } from "@shared/schema";
import { useCreateClient, useUpdateClient } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Save, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface ClientFormProps {
  client?: Client;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(client?.logoUrl || "");
  const [isUploading, setIsUploading] = useState(false);

  const isEditing = !!client;
  const isPending = createClient.isPending || updateClient.isPending;

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      logoUrl: client?.logoUrl || "",
      name: client?.name || "",
      contactName: client?.contactName || "",
      email: client?.email || "",
      phone: client?.phone || "",
      instagram: client?.instagram || "",
      notes: client?.notes || "",
      isActive: client?.isActive ?? true,
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao enviar logo");
      }
      const result = await res.json();
      if (result?.objectPath) {
        setLogoUrl(result.objectPath);
        form.setValue("logoUrl", result.objectPath);
      }
    } catch (err: any) {
      toast({ title: err.message || "Erro ao enviar logo", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  async function onSubmit(data: InsertClient) {
    try {
      if (isEditing && client) {
        await updateClient.mutateAsync({ id: client.id, ...data });
      } else {
        await createClient.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      console.error("Form submission error", error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-end gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted border border-input flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo do cliente"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={isUploading}
                data-testid="input-client-logo"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-xl"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Logo
                  </>
                )}
              </Button>
              {isUploading && (
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full animate-pulse w-full" />
                </div>
              )}
            </div>
          </div>

          <FormField
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <FormItem className="hidden">
                <FormControl>
                  <Input {...field} value={field.value || ""} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Empresa / Cliente</FormLabel>
                <FormControl>
                  <Input data-testid="input-client-name" placeholder="Ex: Nike Brasil" {...field} className="rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pessoa de Contato</FormLabel>
                <FormControl>
                  <Input data-testid="input-contact-name" placeholder="Ex: João Silva" {...field} value={field.value || ""} className="rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input data-testid="input-client-email" type="email" placeholder="contato@empresa.com.br" {...field} value={field.value || ""} className="rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input data-testid="input-client-phone" placeholder="(11) 99999-9999" {...field} value={field.value || ""} className="rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="instagram"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instagram</FormLabel>
              <FormControl>
                <Input data-testid="input-client-instagram" placeholder="@nomedoperfil" {...field} value={field.value || ""} className="rounded-xl" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  data-testid="input-client-notes"
                  placeholder="Informações adicionais sobre o cliente..."
                  className="min-h-[100px] resize-none rounded-xl"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Cliente Ativo</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Clientes inativos não aparecem na lista de seleção ao criar posts.
                </p>
              </div>
              <FormControl>
                <Switch
                  data-testid="switch-client-active"
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <Button data-testid="button-cancel-client" type="button" variant="outline" onClick={onCancel} className="rounded-xl px-6">
              Cancelar
            </Button>
          )}
          <Button
            data-testid="button-save-client"
            type="submit"
            disabled={isPending}
            className="rounded-xl px-8"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? "Atualizar Cliente" : "Cadastrar Cliente"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

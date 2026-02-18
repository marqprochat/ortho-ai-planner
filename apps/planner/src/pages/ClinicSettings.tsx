import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Building2, Save, Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import { useClinic } from "@/context/ClinicContext";
import { clinicService, Clinic } from "@/services/clinicService";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

const clinicSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    nickname: z.string().optional(),
    cro: z.string().optional(),
    website: z.string().optional().or(z.literal("")),
    zipCode: z.string().optional(),
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional().or(z.literal("")),
    logoUrl: z.string().optional(),
});

type ClinicFormValues = z.infer<typeof clinicSchema>;

export default function ClinicSettings() {
    const { currentClinic, refreshClinics } = useClinic();
    const [isLoading, setIsLoading] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const form = useForm<ClinicFormValues>({
        resolver: zodResolver(clinicSchema),
        defaultValues: {
            name: "",
            nickname: "",
            cro: "",
            website: "",
            zipCode: "",
            street: "",
            number: "",
            complement: "",
            district: "",
            city: "",
            state: "",
            logoUrl: "",
        },
    });

    useEffect(() => {
        if (currentClinic) {
            form.reset({
                name: currentClinic.name || "",
                nickname: currentClinic.nickname || "",
                cro: currentClinic.cro || "",
                website: currentClinic.website || "",
                zipCode: currentClinic.zipCode || "",
                street: currentClinic.street || "",
                number: currentClinic.number || "",
                complement: currentClinic.complement || "",
                district: currentClinic.district || "",
                city: currentClinic.city || "",
                state: currentClinic.state || "",
                logoUrl: currentClinic.logoUrl || "",
            });
            setLogoPreview(currentClinic.logoUrl || null);
        }
    }, [currentClinic, form]);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                setLogoPreview(result);
                form.setValue("logoUrl", result); // Saving as base64 for now
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setLogoPreview(null);
        form.setValue("logoUrl", "");
    };

    const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        const cep = e.target.value.replace(/\D/g, "");
        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();
                if (!data.erro) {
                    form.setValue("street", data.logradouro);
                    form.setValue("district", data.bairro);
                    form.setValue("city", data.localidade);
                    form.setValue("state", data.uf);
                    // Focus number field
                    const numberInput = document.getElementById("number");
                    if (numberInput) numberInput.focus();
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
            }
        }
    };

    const onSubmit = async (data: ClinicFormValues) => {
        if (!currentClinic) return;

        setIsLoading(true);
        try {
            // Map form values to Clinic interface, ensuring address is handled
            // We can construct the legacy address field from components if needed, or just leave it
            const updateData: Partial<Clinic> = {
                ...data,
                // Optional: update legacy address field
                address: `${data.street}, ${data.number} - ${data.district}, ${data.city} - ${data.state}`,
            };

            await clinicService.updateClinic(currentClinic.id, updateData);
            if (typeof refreshClinics === 'function') {
                await refreshClinics();
            }
            toast.success("Dados da clínica atualizados com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao atualizar dados da clínica.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!currentClinic) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="ml-20 p-8 transition-all duration-300">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-foreground mb-2">Minha Clínica</h1>
                        <p className="text-muted-foreground">Gerencie as informações da sua clínica para uso em contratos e documentos</p>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            {/* Identidade Visual */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Identidade Visual</CardTitle>
                                    <CardDescription>Logo e informações básicas da clínica</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Logo Upload */}
                                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg border-muted-foreground/25 bg-muted/5">
                                        {logoPreview ? (
                                            <div className="relative group">
                                                <img
                                                    src={logoPreview}
                                                    alt="Logo Preview"
                                                    className="max-h-32 object-contain"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={handleRemoveLogo}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                                <div className="mt-4 flex text-sm leading-6 text-muted-foreground">
                                                    <label
                                                        htmlFor="file-upload"
                                                        className="relative cursor-pointer rounded-md bg-background font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-primary/80"
                                                    >
                                                        <span>Faça upload de um arquivo</span>
                                                        <input
                                                            id="file-upload"
                                                            name="file-upload"
                                                            type="file"
                                                            className="sr-only"
                                                            accept="image/*"
                                                            onChange={handleLogoUpload}
                                                        />
                                                    </label>
                                                    <p className="pl-1">ou arraste e solte</p>
                                                </div>
                                                <p className="text-xs leading-5 text-muted-foreground">PNG, JPG, GIF até 2MB</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nome da Clínica *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: Clínica Odontológica Sorriso" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="nickname"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nome Fantasia / Apelido</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: Unidade Centro" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="cro"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>CRO da Clínica (Responsável Técnico)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: SP-12345" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="website"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Website / Instagram</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: www.minhaclinica.com.br" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Endereço */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Endereço</CardTitle>
                                    <CardDescription>Localização da clínica para documentos</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="zipCode"
                                            render={({ field }) => (
                                                <FormItem className="col-span-1">
                                                    <FormLabel>CEP</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="00000-000"
                                                            {...field}
                                                            onBlur={(e) => {
                                                                field.onBlur();
                                                                handleCepBlur(e);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="street"
                                            render={({ field }) => (
                                                <FormItem className="col-span-3">
                                                    <FormLabel>Logradouro</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Rua, Avenida..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="number"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Número</FormLabel>
                                                    <FormControl>
                                                        <Input id="number" placeholder="123" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="complement"
                                            render={({ field }) => (
                                                <FormItem className="col-span-3">
                                                    <FormLabel>Complemento</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Sala 101, Bloco A..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="district"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bairro</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Bairro" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="city"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Cidade</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Cidade" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="state"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Estado</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="UF" maxLength={2} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end">
                                <Button type="submit" size="lg" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Alterações
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </main>
        </div>
    );
}

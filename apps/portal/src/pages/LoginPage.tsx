import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ArrowRight, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
    const navigate = useNavigate();
    const { login, register } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [isRegisterMode, setIsRegisterMode] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            if (isRegisterMode) {
                await register(email, password, name);
            } else {
                await login(email, password);
            }
            navigate("/dashboard");
        } catch (err: any) {
            setError(err.message || "Erro ao processar solicitação");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent relative overflow-hidden">
            {/* Background Shapes */}
            <div className="absolute top-10 left-10 w-72 h-72 bg-secondary/50 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
            <div className="absolute top-0 right-10 w-72 h-72 bg-accent/50 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-primary/50 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

            <Card className="w-[400px] bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl z-10 text-white">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-white/20 p-3 rounded-full w-fit mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Portal Dentista</CardTitle>
                    <CardDescription className="text-white/80">
                        {isRegisterMode ? "Crie sua conta" : "Acesse todos os seus aplicativos"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="grid w-full items-center gap-4">
                            {isRegisterMode && (
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="name" className="text-white">Nome</Label>
                                    <Input
                                        id="name"
                                        placeholder="Seu nome completo"
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/50"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required={isRegisterMode}
                                    />
                                </div>
                            )}
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="email" className="text-white">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/50"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="password" className="text-white">Senha</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/50"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 p-3 bg-destructive/20 border border-destructive/30 rounded-lg text-destructive-foreground text-sm">
                                {error}
                            </div>
                        )}

                        <div className="mt-6 space-y-3">
                            <Button
                                className="w-full bg-white text-primary hover:bg-white/90 font-bold"
                                type="submit"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    "Processando..."
                                ) : isRegisterMode ? (
                                    <>
                                        <UserPlus className="mr-2 w-4 h-4" /> Criar Conta
                                    </>
                                ) : (
                                    <>
                                        Entrar <ArrowRight className="ml-2 w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 text-sm text-white/80">
                    <button
                        type="button"
                        onClick={() => {
                            setIsRegisterMode(!isRegisterMode);
                            setError("");
                        }}
                        className="hover:text-white transition-colors underline"
                    >
                        {isRegisterMode ? "Já tem uma conta? Entrar" : "Não tem conta? Registrar"}
                    </button>
                </CardFooter>
            </Card>
        </div>
    );
}

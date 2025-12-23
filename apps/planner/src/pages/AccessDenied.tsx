import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function AccessDenied() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="flex justify-center">
                    <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                        <ShieldAlert className="w-16 h-16 text-red-500" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Acesso Negado</h1>
                    <p className="text-slate-400">
                        Você não tem permissão para acessar o Planejador Ortodôntico.
                        Entre em contato com o administrador para solicitar acesso.
                    </p>
                </div>

                <div className="pt-4">
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center px-6 py-3 border border-slate-700 text-base font-medium rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-lg hover:shadow-slate-900/50"
                    >
                        Voltar ao Início
                    </Link>
                </div>

                <p className="text-xs text-slate-600">
                    Se você acredita que isso é um erro, tente fazer logout e login novamente no portal.
                </p>
            </div>
        </div>
    );
}

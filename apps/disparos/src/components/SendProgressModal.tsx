import { X, Send, CheckCircle, XCircle, Loader2, Settings2 } from 'lucide-react';
import type { SendConfig } from '../types';

interface SendProgressModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    config: SendConfig;
    onConfigChange: (config: SendConfig) => void;
    totalMessages: number;
    sentCount: number;
    errorCount: number;
    isSending: boolean;
    currentName?: string;
}

export default function SendProgressModal({
    open, onClose, onConfirm, config, onConfigChange,
    totalMessages, sentCount, errorCount, isSending, currentName
}: SendProgressModalProps) {
    if (!open) return null;

    const progress = totalMessages > 0 ? ((sentCount + errorCount) / totalMessages) * 100 : 0;
    const isDone = sentCount + errorCount === totalMessages && totalMessages > 0 && isSending;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget && !isSending) onClose(); }}>
            <div className="glass-card w-full max-w-md p-6 animate-slide-up shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                            <Send className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground">
                                {isSending ? 'Enviando mensagens...' : 'Confirmar envio'}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {totalMessages} mensagen{totalMessages !== 1 ? 's' : ''} selecionada{totalMessages !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    {!isSending && (
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    )}
                </div>

                {/* Config (before sending) */}
                {!isSending && (
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                            <Settings2 className="w-4 h-4 text-primary" />
                            <span>Configuração de Envio</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">
                                    Intervalo (ms)
                                </label>
                                <input
                                    type="number"
                                    min={200}
                                    max={10000}
                                    step={100}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                    value={config.delayMs}
                                    onChange={e => onConfigChange({ ...config, delayMs: Math.max(200, parseInt(e.target.value) || 1000) })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">{(config.delayMs / 1000).toFixed(1)}s entre envios</p>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">
                                    Limite simultâneo
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                    value={config.concurrentLimit}
                                    onChange={e => onConfigChange({ ...config, concurrentLimit: Math.max(1, parseInt(e.target.value) || 5) })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">máx. paralelos</p>
                            </div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                            ⚡ Tempo estimado: ~{Math.ceil(totalMessages / config.concurrentLimit * config.delayMs / 1000)}s
                        </div>
                    </div>
                )}

                {/* Progress (during sending) */}
                {isSending && (
                    <div className="space-y-4 mb-6">
                        {/* Progress bar */}
                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{Math.round(progress)}%</span>
                            <span className="text-muted-foreground">{sentCount + errorCount} / {totalMessages}</span>
                        </div>

                        {/* Current */}
                        {currentName && !isDone && (
                            <div className="flex items-center gap-2 text-sm text-info">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Enviando para <strong>{currentName}</strong>...</span>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-sm text-emerald-600">
                                <CheckCircle className="w-4 h-4" />
                                <span>{sentCount} enviado{sentCount !== 1 ? 's' : ''}</span>
                            </div>
                            {errorCount > 0 && (
                                <div className="flex items-center gap-1 text-sm text-red-600">
                                    <XCircle className="w-4 h-4" />
                                    <span>{errorCount} erro{errorCount !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>

                        {isDone && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 text-center font-medium">
                                ✅ Envio concluído!
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    {!isSending && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={onConfirm}
                                className="px-5 py-2 text-sm rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20"
                            >
                                <Send className="w-4 h-4" />
                                Enviar {totalMessages} mensagen{totalMessages !== 1 ? 's' : ''}
                            </button>
                        </>
                    )}
                    {isDone && (
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-sm rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white font-medium hover:opacity-90 transition-opacity"
                        >
                            Fechar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

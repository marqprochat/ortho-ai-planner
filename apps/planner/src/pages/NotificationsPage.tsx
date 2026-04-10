import React, { useState, useEffect } from "react";
import { Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const API_URL = import.meta.env.VITE_API_URL || "";

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const res = await fetch(`${API_URL}/api/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (e) {
            console.error("Error fetching notifications", e);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            const token = localStorage.getItem("token");
            await fetch(`${API_URL}/api/notifications/${id}/read`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) {
            console.error("Error marking as read", e);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        for (const id of unreadIds) {
            await markAsRead(id);
        }
    };

    return (
        <div className="container mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Notificações</h1>
                    <p className="text-muted-foreground mt-1">Acompanhe todos os avisos do sistema.</p>
                </div>
                <Button variant="outline" onClick={markAllAsRead} disabled={notifications.every(n => n.isRead)}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar todas como lidas
                </Button>
            </div>

            <div className="grid gap-4">
                {notifications.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-lg shadow-sm flex flex-col items-center">
                        <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-lg">Nenhuma notificação por enquanto.</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div 
                            key={n.id} 
                            className={`p-4 shadow-sm rounded-lg border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-colors ${!n.isRead ? 'bg-primary/5 border-primary/30' : 'bg-card border-border hover:bg-accent/10'}`}
                            onClick={() => !n.isRead && markAsRead(n.id)}
                            style={{ cursor: !n.isRead ? 'pointer' : 'default' }}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    {!n.isRead && <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 shadow-[0_0_8px_hsl(var(--primary))]" />}
                                    <h3 className={`text-base ${!n.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                                        {n.title}
                                    </h3>
                                </div>
                                <p className="text-sm text-foreground/70 pl-0 md:pl-4">{n.message}</p>
                            </div>
                            <div className="text-xs text-muted-foreground/80 whitespace-nowrap pt-2 md:pt-0 border-t md:border-none border-border/50 w-full md:w-auto text-right">
                                {format(new Date(n.createdAt), "dd MMM yy 'às' HH:mm", { locale: ptBR })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

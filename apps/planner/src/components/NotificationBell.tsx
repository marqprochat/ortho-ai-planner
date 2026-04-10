import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
}

export const NotificationBell = ({ isExpanded }: { isExpanded: boolean }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
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
                setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
            }
        } catch (e) {
            console.error("Error fetching notifications", e);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkAsRead = async (id: string) => {
        try {
            const token = localStorage.getItem("token");
            await fetch(`${API_URL}/api/notifications/${id}/read`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchNotifications();
        } catch (e) {
            console.error("Error marking notification as read", e);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-8 w-8 hover:bg-sidebar-accent shrink-0">
                    <Bell className="h-5 w-5 text-sidebar-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 border border-sidebar flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-lg border-border" align={isExpanded ? "center" : "start"} side={isExpanded ? "bottom" : "right"} sideOffset={isExpanded ? 8 : 16}>
                <div className="flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-muted/50 font-semibold text-sm text-foreground">
                        Notificações Recentes
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                Nenhuma notificação.
                            </div>
                        ) : (
                            notifications.slice(0, 5).map((n) => (
                                <div 
                                    key={n.id} 
                                    className={`p-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${!n.isRead ? 'bg-primary/5' : 'bg-background'}`}
                                    onClick={() => handleMarkAsRead(n.id)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`text-sm ${!n.isRead ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>{n.title}</h4>
                                        {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                                    <span className="text-[10px] text-muted-foreground/50 mt-1 block">
                                        {format(new Date(n.createdAt), "dd MMM, HH:mm", { locale: ptBR })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                    <div 
                        className="p-3 text-center text-xs font-semibold text-primary cursor-pointer hover:bg-muted/50 border-t border-border transition-colors bg-background"
                        onClick={() => navigate("/notifications")}
                    >
                        Ver todas
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

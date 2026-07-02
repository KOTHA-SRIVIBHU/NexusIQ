import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string; type: string; title: string; message: string; link: string | null; read: boolean; createdAt: string;
}

function getToken() { return localStorage.getItem('nexusiq_token'); }

async function api(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchUnread = async () => {
    try { const d = await api('/api/notifications/unread'); if (d) setUnread(d.count); } catch { /* ignore */ }
  };

  const fetchAll = async () => {
    try { const d = await api('/api/notifications'); if (d) setNotifications(d.notifications); } catch { /* ignore */ }
    fetchUnread();
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggle = () => {
    if (!open) fetchAll();
    setOpen(!open);
  };

  const handleRead = async (id: string) => {
    await api(`/api/notifications/${id}/read`, { method: 'PATCH' });
    fetchAll();
  };

  const handleReadAll = async () => {
    await api('/api/notifications/read-all', { method: 'POST' });
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleToggle} className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 max-h-96 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button onClick={handleReadAll} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 && (
              <p className="text-gray-400 text-xs text-center py-8">No notifications</p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-indigo-50/30' : ''}`} onClick={() => { if (!n.read) handleRead(n.id); if (n.link) navigate(n.link); setOpen(false); }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'} text-gray-900 truncate`}>{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.read && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
                    {n.link && <ExternalLink className="w-3 h-3 text-gray-300" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

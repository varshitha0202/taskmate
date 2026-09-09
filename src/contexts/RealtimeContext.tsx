import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { realtime } from '../services/realtime';
import { Notification } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

interface RealtimeContextType {
  isConnected: boolean;
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
  showToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  lastEvent: { type: string; payload: any; timestamp: number } | null;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(realtime.status);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastEvent, setLastEvent] = useState<{ type: string; payload: any; timestamp: number } | null>(null);

  const showToast = useCallback(
    (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, title, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshNotifications();
    } else {
      setNotifications([]);
    }
  }, [user, refreshNotifications]);

  useEffect(() => {
    const unsubscribe = realtime.subscribe((event) => {
      setLastEvent({ type: event.type, payload: event.payload, timestamp: Date.now() });
      setIsConnected(true);

      // Handle contextual toast alerts
      switch (event.type) {
        case 'TASK_CREATED':
          if (user?.role === 'ADMIN') {
            showToast('New Task Created', `Task: "${event.payload.title}" (₹${event.payload.budget})`, 'info');
          }
          break;

        case 'TASK_OFFERED':
          if (user?.id === event.payload.agentId) {
            showToast(
              '🎯 New Task Offer Received!',
              `"${event.payload.taskTitle}" is ${event.payload.distanceKm} km away. Reward: ₹${event.payload.budget}`,
              'success'
            );
          } else if (user?.role === 'ADMIN') {
            showToast(
              'Task Offered',
              `Offer dispatched to ${event.payload.agentName} (${event.payload.distanceKm} km away)`,
              'info'
            );
          }
          break;

        case 'TASK_ACCEPTED':
          if (user?.role === 'CUSTOMER') {
            showToast(
              '🚀 Task Accepted!',
              `Agent ${event.payload.agentName} has accepted your task and is on the way.`,
              'success'
            );
          } else if (user?.role === 'ADMIN') {
            showToast(
              'Task Accepted',
              `Agent ${event.payload.agentName} accepted task #${event.payload.taskId.slice(0, 8)}`,
              'success'
            );
          }
          break;

        case 'AGENT_REJECTED':
          if (user?.role === 'ADMIN') {
            showToast(
              'Agent Declined Offer',
              `Agent ${event.payload.agentName} declined task. Auto-reassignment triggered!`,
              'warning'
            );
          } else if (user?.role === 'CUSTOMER') {
            showToast(
              'Matching Update',
              'Finding the next closest verified agent for your task...',
              'info'
            );
          }
          break;

        case 'TASK_UPDATED':
          if (event.payload.status === 'COMPLETED' && user?.role === 'CUSTOMER') {
            showToast('Task completed', 'Your provider completed the task. Please verify and confirm.', 'success');
          } else if (event.payload.status === 'CONFIRMED' && user?.role === 'AGENT') {
            showToast('Payment released', 'Customer confirmed completion. Reward credited.', 'success');
          }
          break;

        case 'DEMO_RESET':
          showToast('System Reset', 'Demo database has been reset to initial state.', 'warning');
          break;
      }

      refreshNotifications();
    });

    return () => {
      unsubscribe();
    };
  }, [user, showToast, refreshNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        toasts,
        removeToast,
        showToast,
        notifications,
        unreadCount,
        markAsRead,
        refreshNotifications,
        lastEvent,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used within a RealtimeProvider');
  return context;
};

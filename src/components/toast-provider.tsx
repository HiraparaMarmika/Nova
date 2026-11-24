"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastKind = "loading" | "success" | "error";
type Toast = { id: number; kind: ToastKind; message: string };
type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind, duration?: number) => number;
  updateToast: (id: number, message: string, kind: ToastKind, duration?: number) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const scheduleDismiss = useCallback((id: number, duration?: number) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    if (duration) timers.current.set(id, setTimeout(() => dismissToast(id), duration));
  }, [dismissToast]);

  const showToast = useCallback((message: string, kind: ToastKind = "success", duration = kind === "loading" ? 0 : 4200) => {
    const id = nextId.current++;
    setToasts(current => [...current, { id, message, kind }]);
    scheduleDismiss(id, duration);
    return id;
  }, [scheduleDismiss]);

  const updateToast = useCallback((id: number, message: string, kind: ToastKind, duration = kind === "loading" ? 0 : 4200) => {
    setToasts(current => current.map(toast => toast.id === id ? { ...toast, message, kind } : toast));
    scheduleDismiss(id, duration);
  }, [scheduleDismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return <ToastContext.Provider value={{ showToast, updateToast, dismissToast }}>{children}<div className="toast-region" aria-live="polite" aria-atomic="true">{toasts.map(toast => <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"} key={toast.id}><span className="toast-icon" aria-hidden="true">{toast.kind === "loading" ? "..." : toast.kind === "success" ? "OK" : "!"}</span><span>{toast.message}</span>{toast.kind !== "loading" && <button type="button" className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">&times;</button>}</div>)}</div></ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

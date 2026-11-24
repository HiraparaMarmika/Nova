import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/toast-provider";

const brandIcons = { icon: "/brand/nova-logo.png", shortcut: "/brand/nova-logo.png", apple: "/brand/nova-logo.png" };

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  return cookieStore.get("nova-locale")?.value === "en"
    ? { title: "NOVA | Plan home cleaning online", description: "Find independent cleaners for one-time or recurring home cleaning in Germany.", icons: brandIcons }
    : { title: "NOVA | Haushaltsreinigung online planen", description: "Finde selbstständige Reinigungskräfte für einmalige oder regelmäßige Haushaltsreinigung.", icons: brandIcons };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const initialLocale = cookieStore.get("nova-locale")?.value === "en" ? "en" : "de";
  return <html lang={initialLocale}><body><LocaleProvider initialLocale={initialLocale}><ToastProvider>{children}</ToastProvider></LocaleProvider></body></html>;
}

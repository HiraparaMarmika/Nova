import "server-only";

export function adminActivationUrl(origin: string, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  return new URL(`/admin/activate?token=${encodeURIComponent(token)}`, appUrl).toString();
}

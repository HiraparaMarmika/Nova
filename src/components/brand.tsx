import Image from "next/image";
import Link from "next/link";

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return <Link href="/" className={`brand ${inverted ? "brand-inverted" : ""}`} aria-label="NOVA home / Startseite">
    <Image src="/brand/nova-logo.png" alt="NOVA" width={138} height={46} priority />
  </Link>;
}

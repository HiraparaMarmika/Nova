export type Money = number;
export const euros = (cents: Money) => new Intl.NumberFormat("de-DE", { style:"currency", currency:"EUR" }).format(cents / 100);
export const percentageOf = (cents: Money, bps: number) => Math.round((cents * bps) / 10_000);


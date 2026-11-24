import { percentageOf } from "../lib/money";
export type CommissionInput={grossCents:number; recurring:boolean; completedRecurringOrdinal?:number; convertedFromOneTime?:boolean};
export function commissionFor(input: CommissionInput){if(!input.recurring)return {basisPoints:2800,amountCents:percentageOf(input.grossCents,2800)};const ordinal=input.completedRecurringOrdinal ?? 1;const bps=input.convertedFromOneTime||ordinal>=3?2000:3000;return {basisPoints:bps,amountCents:percentageOf(input.grossCents,bps)};}


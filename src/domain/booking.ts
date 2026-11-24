import "server-only";
import { commissionFor } from "./commission";
export function snapshotVisit(input:{durationMinutes:number; rateCents:number; extrasCents:number; recurring:boolean; ordinal?:number; converted?:boolean}){const grossCents=Math.round(input.durationMinutes/60*input.rateCents)+input.extrasCents;const commission=commissionFor({grossCents,recurring:input.recurring,completedRecurringOrdinal:input.ordinal,convertedFromOneTime:input.converted});return {grossCents,commissionCents:commission.amountCents,commissionBps:commission.basisPoints,cleanerNetCents:grossCents-commission.amountCents};}


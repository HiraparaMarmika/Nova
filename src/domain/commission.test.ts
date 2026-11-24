import { describe, expect, it } from "vitest";
import { commissionFor } from "./commission";
describe("commission policy",()=>{it("applies 28% to one-time visits",()=>expect(commissionFor({grossCents:10000,recurring:false})).toEqual({basisPoints:2800,amountCents:2800}));it("uses 30%, then 20% recurring tiers",()=>{expect(commissionFor({grossCents:10000,recurring:true,completedRecurringOrdinal:2}).basisPoints).toBe(3000);expect(commissionFor({grossCents:10000,recurring:true,completedRecurringOrdinal:3}).basisPoints).toBe(2000)});it("uses conversion rate from the first recurring completion",()=>expect(commissionFor({grossCents:10000,recurring:true,convertedFromOneTime:true}).basisPoints).toBe(2000));});


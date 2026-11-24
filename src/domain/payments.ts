import "server-only";
export type PaymentAdapter = { authorize(input:{amountCents:number; idempotencyKey:string}):Promise<{reference:string; status:"AUTHORIZED"|"REQUIRES_ACTION"}>; capture(reference:string,amountCents:number):Promise<void>; release(reference:string):Promise<void> };
export const localPaymentAdapter: PaymentAdapter = { async authorize({idempotencyKey}){return {reference:`local_auth_${idempotencyKey}`,status:"AUTHORIZED"};},async capture(){},async release(){} };


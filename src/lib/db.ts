import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";
const globalForPrisma=global as unknown as { prisma?:PrismaClient };
export const prisma=globalForPrisma.prisma ?? new PrismaClient();
if(process.env.NODE_ENV!=="production")globalForPrisma.prisma=prisma;
export async function withRls<T>(identity:{id:string;role:string}, action:(tx:Prisma.TransactionClient)=>Promise<T>){return prisma.$transaction(async(tx:Prisma.TransactionClient)=>{await tx.$executeRaw`SELECT set_config('app.account_id', ${identity.id}, true), set_config('app.role', ${identity.role}, true)`;return action(tx);});}


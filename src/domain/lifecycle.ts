export type VisitStatus = "REQUESTED"|"ACCEPTED"|"SCHEDULED"|"IN_PROGRESS"|"COMPLETED"|"CONFIRMED"|"SETTLED"|"DECLINED"|"EXPIRED"|"CANCELLED_BY_CUSTOMER"|"CANCELLED_BY_CLEANER"|"CANCELLED_BY_ADMIN"|"NO_SHOW"|"DISPUTED";
const transitions: Record<VisitStatus, VisitStatus[]> = {
  REQUESTED:["ACCEPTED","DECLINED","EXPIRED","CANCELLED_BY_CUSTOMER","CANCELLED_BY_ADMIN"], ACCEPTED:["SCHEDULED","CANCELLED_BY_CUSTOMER","CANCELLED_BY_CLEANER","CANCELLED_BY_ADMIN"], SCHEDULED:["IN_PROGRESS","CANCELLED_BY_CUSTOMER","CANCELLED_BY_CLEANER","CANCELLED_BY_ADMIN","NO_SHOW"], IN_PROGRESS:["COMPLETED","NO_SHOW","DISPUTED"], COMPLETED:["CONFIRMED","DISPUTED"], CONFIRMED:["SETTLED","DISPUTED"], SETTLED:[], DECLINED:[], EXPIRED:[], CANCELLED_BY_CUSTOMER:[], CANCELLED_BY_CLEANER:[], CANCELLED_BY_ADMIN:[], NO_SHOW:["DISPUTED"], DISPUTED:["CONFIRMED","CANCELLED_BY_ADMIN"]
};
export function assertTransition(from: VisitStatus, to: VisitStatus){if(!transitions[from].includes(to))throw new Error(`Invalid visit transition: ${from} → ${to}`);}
export function transition(from: VisitStatus,to:VisitStatus,actorId:string,reason?:string){assertTransition(from,to);return {fromStatus:from,toStatus:to,actorId,reason,createdAt:new Date()};}


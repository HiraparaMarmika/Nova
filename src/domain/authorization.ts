import "server-only";
export type Portal = "CUSTOMER"|"CLEANER"|"ADMIN";
export type SessionScope={accountId:string; portal:Portal; state:"ACTIVE"|"RESTRICTED"|"SUSPENDED"};
export function assertAccess(session:SessionScope, portal:Portal){if(session.portal!==portal)throw new Error("Portal-scoped session required");if(session.state==="SUSPENDED")throw new Error("Account suspended");}
export function assertOwner(subjectId:string, resourceOwnerId:string){if(subjectId!==resourceOwnerId)throw new Error("Resource ownership required");}


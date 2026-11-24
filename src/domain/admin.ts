import "server-only";
export function adminAudit(adminId:string,action:string,targetType:string,targetId:string,reason:string,metadata?:Record<string,unknown>){if(!reason.trim())throw new Error("An admin mutation requires a reason");return {adminId,action,targetType,targetId,reason,metadata};}


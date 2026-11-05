// Account-only groups resolve identity from the signed-in user's membership, never the device.
export function participantIdentity(p:{userId:string|null;identityKey:string|null},access:string,userId:string|undefined,keys:string[]){
 const byAccount=!!p.userId && p.userId===userId;
 return {claimed:!!p.userId||!!p.identityKey,mine:byAccount||(access!=="REGISTERED_ONLY"&&!p.userId&&!!p.identityKey&&keys.includes(p.identityKey))};
}

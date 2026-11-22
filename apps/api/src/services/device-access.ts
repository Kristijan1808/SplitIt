import { prisma } from "../core.js";

// Preserve existing group ownership on the original device without accounts.
// Never claim old participants or bills using a name or a public participant ID.
export async function preserveDeviceAccess(groupId: string, keys: string[]) {
  const device = keys.find(k => k.startsWith("guest:"));
  const legacy = keys.find(k => k.startsWith("user:"));
  if (!device || !legacy) return;
  const previous = await prisma.groupSession.findUnique({where:{groupId_key:{groupId,key:legacy}}});
  if (!previous) return;
  await prisma.$transaction(async tx => {
    const current = await tx.groupSession.findUnique({where:{groupId_key:{groupId,key:device}}});
    const rank: Record<string,number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 };
    const role = current && rank[current.role] > rank[previous.role] ? current.role : previous.role;
    await tx.groupSession.upsert({where:{groupId_key:{groupId,key:device}},create:{groupId,key:device,role},update:{role}});
    await tx.group.updateMany({where:{id:groupId,ownerKey:legacy},data:{ownerKey:device}});
    await tx.person.updateMany({where:{groupId,identityKey:legacy},data:{identityKey:device}});
    await tx.expense.updateMany({where:{groupId,creatorKey:legacy},data:{creatorKey:device}});
    await tx.expenseDraft.updateMany({where:{groupId,creatorKey:legacy},data:{creatorKey:device}});
  });
}

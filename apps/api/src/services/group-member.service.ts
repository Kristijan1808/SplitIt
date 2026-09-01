import type { AuthUser } from "../core.js";
import { prisma } from "../core.js";

export class GroupMemberService {
  addIfNeeded = async (
    groupId: string,
    user: AuthUser,
    role: "OWNER" | "MEMBER" = "MEMBER"
  ) => {
    await prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id
        }
      },
      update: {},
      create: {
        groupId,
        userId: user.id,
        role
      }
    });
  };

  findByUser = async (groupId: string, userId: string) =>
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId }
      }
    });
}

export const groupMemberService = new GroupMemberService();

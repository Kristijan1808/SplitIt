import type { RequestHandler } from "express";
import {participantIdentity} from "./participant-identity.js";
import { prisma,getUserFromRequest } from "../core.js";
import { groupDetailsInclude, serializeGroup } from "../utils.js";
import { billKeys } from "./bill-permissions.js";
import { calculateBalances } from "./balance-domain.js";

export const groupSnapshot: RequestHandler = async (req, res, next) => {
  try {
    const group = res.locals.group;
    const keys = billKeys(req);
    const user=getUserFromRequest(req);
    const [details, selections, transfers, sessions] = await Promise.all([
      prisma.group.findUnique({
        where: { id: group.id },
        include: groupDetailsInclude
      }),
      prisma.draftSelection.findMany({
        where: { draft: { groupId: group.id, confirmedExpenseId: null } }
      }),
      prisma.settlementTransfer.findMany({
        where: { groupId: group.id },
        orderBy: { createdAt: "desc" }
      }),
      prisma.groupSession.findMany({ where: { groupId: group.id } })
    ]);

    if (!details) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    // Existing members from older groups may not have an account-linked participant yet.
    if(group.accessType==="REGISTERED_ONLY" && user && !details.people.some(p=>p.userId===user.id)){
      const linked=await prisma.person.upsert({where:{groupId_userId:{groupId:group.id,userId:user.id}},create:{groupId:group.id,userId:user.id,name:user.username},update:{}});
      details.people.push(linked);
    }
    res.json({
      group: serializeGroup(details),
      drafts: [],
      history: details.history,
      settlements: calculateBalances(
        details.people,
        details.expenses,
        transfers.filter((transfer) => !transfer.voidedAt)
      ),
      workflow: {
        avatar: group.avatar,
        archived: group.archived,
        canAdmin: res.locals.admin,
        canOwn: res.locals.owner,
        people: details.people.map((person) => ({
          id: person.id,
          name: person.name,
          role: sessions.find((session) => session.key === person.identityKey)?.role ?? "MEMBER",
          inactive: person.inactive,
          ...participantIdentity(person,group.accessType,user?.id,keys)
        })),
        selections,
        transfers: transfers.map((transfer) => ({
          ...transfer,
          amount: Number(transfer.amount)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
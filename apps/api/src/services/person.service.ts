import type { NextFunction, Request, Response } from "express";
import {
  prisma
} from "../core.js";
import * as schemas from "../schemas/schemas.js";
import {
  serializeGroup
} from "../utils.js";
import { ensureCanEditGroup } from "./access.service.js";
import { groupService } from "./group.service.js";


export class PersonService {


  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body =
        schemas.addPersonSchema.parse(
          req.body
        );

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug as string
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const name =
        body.name.trim();

      const existingPerson =
        await prisma.person.findFirst({
          where: {
            groupId: group.id,
            name: {
              equals: name,
              mode: "insensitive"
            }
          }
        });

      if (existingPerson) {
        return res.status(409).json({
          error:
            "A participant with that name already exists in this group"
        });
      }

      await prisma.person.create({
        data: {
          name,
          groupId: group.id
        }
      });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "CREATE",
          entity: "PERSON",
          message:
            `${name} was added`
        }
      });

      const updated =
        await groupService.getGroupBySlug(
          req.params.slug as string
        );

      res.status(201).json(
        serializeGroup(
          updated!,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body =
        schemas.addPersonSchema.parse(
          req.body
        );

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug as string
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const person =
        await prisma.person.findFirst({
          where: {
            id: req.params.personId as string,
            groupId: group.id
          }
        });

      if (!person) {
        return res.status(404).json({
          error: "Person not found"
        });
      }

      const newName =
        body.name.trim();

      await prisma.person.update({
        where: {
          id: person.id
        },

        data: {
          name: newName
        }
      });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "UPDATE",
          entity: "PERSON",
          entityId: person.id,

          message:
            `Person changed from "${person.name}" to "${newName}"`,

          oldValue:
            person.name,

          newValue:
            newName
        }
      });

      const updated =
        await groupService.getGroupBySlug(
          req.params.slug as string
        );

      res.json(
        serializeGroup(
          updated!,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  
  };

  remove = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug as string
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const person =
        await prisma.person.findFirst({
          where: {
            id: req.params.personId as string,
            groupId: group.id
          }
        });

      if (!person) {
        return res.status(404).json({
          error: "Person not found"
        });
      }

      await prisma.person.delete({
        where: {
          id: person.id
        }
      });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "DELETE",
          entity: "PERSON",
          entityId: person.id,

          message:
            `${person.name} was removed`,

          oldValue:
            person.name
        }
      });

      const updated = await groupService.getGroupBySlug(req.params.slug as string);

      res.json(serializeGroup(updated!,access.user));
    } catch (error) {
      next(error);
    }
  
  };

}

export const personService = new PersonService();

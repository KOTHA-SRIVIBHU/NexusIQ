import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { z } from "zod";

const router = Router();

router.post("/", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { name, description } = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
    const team = await prisma.team.create({
      data: { name, description: description || "", organizationId: req.user!.organizationId },
    });
    res.status(201).json(team);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Invalid input", details: err.issues }); return; }
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const teams = await prisma.team.findMany({
    where: { organizationId: req.user!.organizationId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  res.json({ teams });
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const team = await prisma.team.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        folders: {
          include: {
            _count: { select: { documents: true } },
            documents: {
              orderBy: { createdAt: "desc" },
              include: { uploadedBy: { select: { id: true, name: true, email: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    res.json({ team });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { name, description } = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
    const team = await prisma.team.updateMany({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      data: { name, description: description || "" },
    });
    if (team.count === 0) { res.status(404).json({ error: "Team not found" }); return; }
    res.json({ message: "Team updated" });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Invalid input", details: err.issues }); return; }
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const team = await prisma.team.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
  await prisma.teamRequest.deleteMany({ where: { toTeamId: team.id } });
  await prisma.teamRequest.deleteMany({ where: { fromTeamId: team.id } });
  await prisma.team.delete({ where: { id: team.id } });
  res.json({ message: "Team deleted" });
});

router.post("/:id/members", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { userId, role } = z.object({ userId: z.string(), role: z.enum(["LEAD", "MEMBER"]) }).parse(req.body);
    const team = await prisma.team.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    await prisma.teamMember.deleteMany({ where: { userId, organizationId: req.user!.organizationId } });
    const member = await prisma.teamMember.create({ data: { userId, teamId: team.id, role, organizationId: req.user!.organizationId } });
    res.status(201).json(member);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Invalid input", details: err.issues }); return; }
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:teamId/members/:userId", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  await prisma.teamMember.deleteMany({
    where: { teamId: String(req.params.teamId), userId: String(req.params.userId) },
  });
  res.json({ message: "Member removed from team" });
});

export default router;

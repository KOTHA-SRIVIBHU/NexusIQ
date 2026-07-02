import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, generateToken } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { z } from "zod";

const router = Router();

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { toTeamId, reason } = z.object({ toTeamId: z.string(), reason: z.string().optional() }).parse(req.body);
    const existing = await prisma.teamRequest.findFirst({
      where: { userId: req.user!.userId, status: "PENDING" },
    });
    if (existing) { res.status(409).json({ error: "You already have a pending request" }); return; }

    const currentMembership = await prisma.teamMember.findFirst({ where: { userId: req.user!.userId } });
    const request = await prisma.teamRequest.create({
      data: {
        userId: req.user!.userId,
        fromTeamId: currentMembership?.teamId || null,
        toTeamId,
        reason: reason || "",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    res.status(201).json(request);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Invalid input", details: err.issues }); return; }
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
  const requests = await prisma.teamRequest.findMany({
    where: isAdmin ? { toTeam: { organizationId: req.user!.organizationId } } : { userId: req.user!.userId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      fromTeam: { select: { id: true, name: true } },
      toTeam: { select: { id: true, name: true } },
      admin: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ requests });
});

router.patch("/:id/approve", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const request = await prisma.teamRequest.findUnique({ where: { id: String(req.params.id) }, include: { toTeam: true } });
  if (!request || request.toTeam.organizationId !== req.user!.organizationId) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.status !== "PENDING") { res.status(400).json({ error: "Request already handled" }); return; }

  await prisma.teamMember.deleteMany({ where: { userId: request.userId } });
  await prisma.teamMember.create({ data: { userId: request.userId, teamId: request.toTeamId, role: "MEMBER", organizationId: request.toTeam.organizationId } });

  await prisma.teamRequest.update({ where: { id: request.id }, data: { status: "APPROVED", adminId: req.user!.userId } });
  await prisma.notification.create({ data: { userId: request.userId, type: "team_approved", title: "Team Change Approved", message: `You've been moved to ${request.toTeam.name}`, link: "/settings/requests" } });

  res.json({ message: "Team change approved" });
});

router.patch("/:id/deny", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const request = await prisma.teamRequest.findUnique({ where: { id: String(req.params.id) }, include: { toTeam: true } });
    if (!request || request.toTeam.organizationId !== req.user!.organizationId) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "PENDING") { res.status(400).json({ error: "Request already handled" }); return; }

    await prisma.teamRequest.update({ where: { id: request.id }, data: { status: "DENIED", adminId: req.user!.userId, adminNote: reason || null } });
    await prisma.notification.create({ data: { userId: request.userId, type: "team_denied", title: "Team Change Declined", message: reason ? `Reason: ${reason}` : "Your team change request was declined", link: "/settings/requests" } });

    res.json({ message: "Team change denied" });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Invalid input", details: err.issues }); return; }
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

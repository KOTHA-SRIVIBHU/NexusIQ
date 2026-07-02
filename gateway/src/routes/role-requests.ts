import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, generateToken } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { z } from "zod";

const router = Router();

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { requestedRole, reason } = z.object({ requestedRole: z.enum(["EDITOR", "ADMIN"]), reason: z.string().optional() }).parse(req.body);
    const currentMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: req.user!.organizationId, userId: req.user!.userId } },
    });
    if (!currentMembership) { res.status(404).json({ error: "Membership not found" }); return; }

    const existing = await prisma.roleRequest.findFirst({
      where: { userId: req.user!.userId, organizationId: req.user!.organizationId, status: "PENDING" },
    });
    if (existing) { res.status(409).json({ error: "You already have a pending role request" }); return; }

    const roleHierarchy: Record<string, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    if (roleHierarchy[requestedRole] <= roleHierarchy[currentMembership.role]) {
      res.status(400).json({ error: "You already have this role or higher" });
      return;
    }

    const request = await prisma.roleRequest.create({
      data: {
        userId: req.user!.userId,
        organizationId: req.user!.organizationId,
        currentRole: currentMembership.role,
        requestedRole,
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
  const requests = await prisma.roleRequest.findMany({
    where: isAdmin ? { organizationId: req.user!.organizationId } : { userId: req.user!.userId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      admin: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ requests });
});

router.patch("/:id/approve", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const request = await prisma.roleRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!request || request.organizationId !== req.user!.organizationId) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.status !== "PENDING") { res.status(400).json({ error: "Request already handled" }); return; }

  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: request.organizationId, userId: request.userId } },
    data: { role: request.requestedRole },
  });
  await prisma.roleRequest.update({ where: { id: request.id }, data: { status: "APPROVED", adminId: req.user!.userId } });
  await prisma.notification.create({ data: { userId: request.userId, type: "role_approved", title: "Role Upgrade Approved", message: `You've been upgraded to ${request.requestedRole}`, link: "/settings/requests" } });

  res.json({ message: "Role upgrade approved" });
});

router.patch("/:id/deny", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const request = await prisma.roleRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!request || request.organizationId !== req.user!.organizationId) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "PENDING") { res.status(400).json({ error: "Request already handled" }); return; }

    await prisma.roleRequest.update({ where: { id: request.id }, data: { status: "DENIED", adminId: req.user!.userId, adminNote: reason || null } });
    await prisma.notification.create({ data: { userId: request.userId, type: "role_denied", title: "Role Upgrade Declined", message: reason ? `Reason: ${reason}` : "Your role upgrade request was declined", link: "/settings/requests" } });

    res.json({ message: "Role upgrade denied" });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Invalid input", details: err.issues }); return; }
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

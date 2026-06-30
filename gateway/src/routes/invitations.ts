import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import prisma from "../lib/prisma.js";
import { authMiddleware, generateToken } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import bcrypt from "bcryptjs";
import { z } from "zod";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["VIEWER", "EDITOR", "ADMIN"]),
});

const acceptSchema = z.object({
  token: z.string(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
});

router.post("/", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = inviteSchema.parse(req.body);

    const existingMember = await prisma.organizationMember.findFirst({
      where: { organizationId: req.user!.organizationId, user: { email: data.email } },
    });
    if (existingMember) {
      res.status(409).json({ error: "User is already a member" });
      return;
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: { email: data.email, role: data.role, token, organizationId: req.user!.organizationId, expiresAt },
    });

    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      inviteLink: `${FRONTEND_URL}/accept-invite?token=${token}`,
      expiresAt: invitation.expiresAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.issues });
      return;
    }
    console.error("Invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const invitations = await prisma.invitation.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: "desc" },
  });

  const withLinks = invitations.map((inv) => ({
    ...inv,
    inviteLink: `${FRONTEND_URL}/accept-invite?token=${inv.token}`,
  }));

  res.json({ invitations: withLinks });
});

router.get("/resolve", async (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invitation) {
    res.status(404).json({ error: "Invalid invitation token" });
    return;
  }

  if (invitation.acceptedAt) {
    res.status(410).json({ error: "Invitation has already been used" });
    return;
  }

  if (invitation.expiresAt < new Date()) {
    res.status(410).json({ error: "Invitation has expired" });
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });

  res.json({
    email: invitation.email,
    organizationName: invitation.organization.name,
    organizationId: invitation.organizationId,
    role: invitation.role,
    token: invitation.token,
    hasAccount: !!existingUser,
  });
});

router.post("/accept", async (req: Request, res: Response) => {
  try {
    const data = acceptSchema.parse(req.body);
    const invitation = await prisma.invitation.findUnique({
      where: { token: data.token },
      include: { organization: true },
    });

    if (!invitation) {
      res.status(404).json({ error: "Invalid invitation token" });
      return;
    }

    if (invitation.acceptedAt) {
      res.status(410).json({ error: "Invitation has already been used" });
      return;
    }

    if (invitation.expiresAt < new Date()) {
      res.status(410).json({ error: "Invitation has expired" });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });

    // If no account and no name/password provided, error
    if (!existingUser && (!data.name || !data.password)) {
      res.status(400).json({ error: "Name and password required to create account" });
      return;
    }

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;

      const alreadyMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
      });
      if (alreadyMember) {
        res.status(409).json({ error: "Already a member of this organization" });
        return;
      }
    } else {
      const hashedPassword = await bcrypt.hash(data.password!, 10);
      const newUser = await prisma.user.create({
        data: { email: invitation.email, password: hashedPassword, name: data.name! },
      });
      userId = newUser.id;
    }

    await prisma.organizationMember.create({
      data: { userId, organizationId: invitation.organizationId, role: invitation.role },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    const token = generateToken({
      userId,
      email: invitation.email,
      organizationId: invitation.organizationId,
      role: invitation.role,
    });

    const user = existingUser || await prisma.user.findUnique({ where: { id: userId } });

    res.json({
      token,
      user: { id: userId, email: invitation.email, name: user!.name },
      organization: { id: invitation.organizationId, name: invitation.organization.name },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.issues });
      return;
    }
    console.error("Accept invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const invitation = await prisma.invitation.findUnique({ where: { id: String(req.params.id) } });

    if (!invitation) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    if (invitation.organizationId !== req.user!.organizationId) {
      res.status(403).json({ error: "Not your organization's invitation" });
      return;
    }

    if (invitation.acceptedAt) {
      res.status(400).json({ error: "Cannot cancel an already accepted invitation" });
      return;
    }

    await prisma.invitation.delete({ where: { id: invitation.id } });
    res.json({ message: "Invitation cancelled" });
  } catch (err) {
    console.error("Cancel invite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { z } from "zod";

const router = Router();

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["VIEWER", "EDITOR", "ADMIN"]),
});

router.post("/", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = inviteSchema.parse(req.body);
    const organizationId = req.user!.organizationId;

    const existingMember = await prisma.organizationMember.findFirst({
      where: { organizationId, user: { email: data.email } },
    });
    if (existingMember) {
      res.status(409).json({ error: "User is already a member of this organization" });
      return;
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email: data.email,
        role: data.role,
        token,
        organizationId,
        expiresAt,
      },
    });

    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      inviteLink: `${req.protocol}://${req.get("host")}/accept-invite?token=${token}`,
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
  res.json({ invitations });
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

  res.json({
    email: invitation.email,
    organizationName: invitation.organization.name,
    role: invitation.role,
    token: invitation.token,
  });
});

router.post("/accept", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      token: z.string(),
      name: z.string().min(1).optional(),
      password: z.string().min(6).optional(),
    });
    const data = schema.parse(req.body);

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

    if (!existingUser && (!data.name || !data.password)) {
      res.status(400).json({ error: "Name and password required to create account" });
      return;
    }

    const { generateToken } = await import("../middleware/auth.js");
    const bcrypt = await import("bcryptjs");

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
        data: {
          email: invitation.email,
          password: hashedPassword,
          name: data.name!,
        },
      });
      userId = newUser.id;
    }

    await prisma.organizationMember.create({
      data: {
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
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

    res.json({
      token,
      user: { id: userId, email: invitation.email, name: existingUser?.name || data.name },
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

export default router;

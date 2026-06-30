import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { generateToken, authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  organizationName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/register", async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    let orgSlug = data.organizationName.toLowerCase().replace(/\s+/g, "-");
    const existingSlug = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (existingSlug) {
      orgSlug = `${orgSlug}-${Date.now()}`;
    }

    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: data.organizationName, slug: orgSlug },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name,
        },
      });

      await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "SUPER_ADMIN",
        },
      });

      return { user, organizationId: org.id, orgName: org.name };
    });

    const token = generateToken({
      userId: user.user.id,
      email: user.user.email,
      organizationId: user.organizationId,
      role: "SUPER_ADMIN",
    });

    res.status(201).json({
      token,
      user: {
        id: user.user.id,
        email: user.user.email,
        name: user.user.name,
      },
      organization: {
        id: user.organizationId,
        name: user.orgName,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.issues });
      return;
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/create-org", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { organizationName } = z.object({ organizationName: z.string().min(1) }).parse(req.body);
    const orgSlug = organizationName.toLowerCase().replace(/\s+/g, "-");

    const existingSlug = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    const slug = existingSlug ? `${orgSlug}-${Date.now()}` : orgSlug;

    const org = await prisma.organization.create({ data: { name: organizationName, slug } });

    await prisma.organizationMember.create({
      data: { userId: req.user!.userId, organizationId: org.id, role: "SUPER_ADMIN" },
    });

    const token = generateToken({
      userId: req.user!.userId,
      email: req.user!.email,
      organizationId: org.id,
      role: "SUPER_ADMIN",
    });

    res.status(201).json({ token, organization: { id: org.id, name: org.name, role: "SUPER_ADMIN" } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.issues });
      return;
    }
    console.error("Create org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (!membership) {
      res.status(403).json({ error: "No organization membership found" });
      return;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      role: membership.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: {
        id: membership.organizationId,
        name: membership.organization.name,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.issues });
      return;
    }
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: {
      memberships: {
        include: { organization: true },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    organizations: user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
    })),
  });
});

router.get("/members", authMiddleware, async (req: Request, res: Response) => {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: req.user!.organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  res.json({
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  });
});

const changeRoleSchema = z.object({
  role: z.enum(["VIEWER", "EDITOR", "ADMIN"]),
});

router.patch("/members/:userId/role", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = changeRoleSchema.parse(req.body);
    const targetUserId = String(req.params.userId);

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: req.user!.organizationId, userId: targetUserId } },
    });

    if (!membership) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (membership.role === "SUPER_ADMIN" && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only Super Admins can change another Super Admin's role" });
      return;
    }

    const updated = await prisma.organizationMember.update({
      where: { id: membership.id },
      data: { role: data.role },
    });

    res.json({ id: targetUserId, role: updated.role });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.issues });
      return;
    }
    console.error("Change role error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/switch-org", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { organizationId } = z.object({ organizationId: z.string().uuid() }).parse(req.body);

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: req.user!.userId } },
    });

    if (!membership) {
      res.status(403).json({ error: "Not a member of this organization" });
      return;
    }

    const token = generateToken({
      userId: req.user!.userId,
      email: req.user!.email,
      organizationId,
      role: membership.role,
    });

    res.json({ token, organization: { id: organizationId, role: membership.role } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.issues });
      return;
    }
    console.error("Switch org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/members/:userId", authMiddleware, requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const targetUserId = String(req.params.userId);
    const currentUserId = req.user!.userId;

    if (targetUserId === currentUserId) {
      res.status(400).json({ error: "Cannot remove yourself. Ask another admin." });
      return;
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: req.user!.organizationId, userId: targetUserId } },
    });

    if (!membership) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (membership.role === "SUPER_ADMIN" && req.user!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only Super Admins can remove a Super Admin" });
      return;
    }

    await prisma.organizationMember.delete({ where: { id: membership.id } });
    res.json({ message: "Member removed from organization" });
  } catch (err) {
    console.error("Remove member error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

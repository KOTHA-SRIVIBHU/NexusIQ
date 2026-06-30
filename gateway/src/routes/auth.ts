import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
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
    const orgSlug = data.organizationName.toLowerCase().replace(/\s+/g, "-");

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

router.get("/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { verify } = await import("jsonwebtoken");
    const token = authHeader.slice(7);
    const decoded = verify(token, process.env.JWT_SECRET || "dev-secret-change-in-production") as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.get("/members", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { verify } = await import("jsonwebtoken");
    const token = authHeader.slice(7);
    const decoded = verify(token, process.env.JWT_SECRET || "dev-secret-change-in-production") as any;

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: decoded.organizationId },
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
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;

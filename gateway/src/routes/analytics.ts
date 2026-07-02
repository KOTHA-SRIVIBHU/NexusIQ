import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

export const analyticsRouter = Router();

analyticsRouter.use(authMiddleware);

analyticsRouter.get("/overview", async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;

    const [totalDocs, readyDocs, failedDocs, totalTokens, folders, users, recentUploads] =
      await Promise.all([
        prisma.document.count({ where: { organizationId: orgId } }),
        prisma.document.count({ where: { organizationId: orgId, status: "READY" } }),
        prisma.document.count({ where: { organizationId: orgId, status: "FAILED" } }),
        prisma.document.aggregate({
          where: { organizationId: orgId, status: "READY" },
          _sum: { tokenCount: true },
        }),
        prisma.folder.count({ where: { organizationId: orgId } }),
        prisma.organizationMember.count({ where: { organizationId: orgId } }),
        prisma.document.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

    const docsByType = await prisma.document.groupBy({
      by: ["mimeType"],
      where: { organizationId: orgId },
      _count: true,
    });

    const docsThisWeek = await prisma.document.count({
      where: {
        organizationId: orgId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    res.json({
      totalDocs,
      readyDocs,
      failedDocs,
      totalTokens: totalTokens._sum.tokenCount || 0,
      folders,
      members: users,
      docsThisWeek,
      docsByType,
      recentUploads,
    });
  } catch (err) {
    console.error("Analytics overview error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

analyticsRouter.get("/team/:teamId", async (req: Request, res: Response) => {
  try {
    const teamId = String(req.params.teamId);
    const orgId = req.user!.organizationId;

    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId },
    });
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }

    const [totalDocs, readyDocs, failedDocs, totalTokens, folders, memberCount] =
      await Promise.all([
        prisma.document.count({
          where: { organizationId: orgId, folder: { teamId } },
        }),
        prisma.document.count({
          where: { organizationId: orgId, status: "READY", folder: { teamId } },
        }),
        prisma.document.count({
          where: { organizationId: orgId, status: "FAILED", folder: { teamId } },
        }),
        prisma.document.aggregate({
          where: { organizationId: orgId, status: "READY", folder: { teamId } },
          _sum: { tokenCount: true },
        }),
        prisma.folder.count({ where: { organizationId: orgId, teamId } }),
        prisma.teamMember.count({ where: { teamId } }),
      ]);

    const docsByType = await prisma.document.groupBy({
      by: ["mimeType"],
      where: { organizationId: orgId, folder: { teamId } },
      _count: true,
    });

    const docsThisWeek = await prisma.document.count({
      where: {
        organizationId: orgId,
        folder: { teamId },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    res.json({
      teamName: team.name,
      totalDocs,
      readyDocs,
      failedDocs,
      totalTokens: totalTokens._sum.tokenCount || 0,
      folders,
      members: memberCount,
      docsThisWeek,
      docsByType,
    });
  } catch (err) {
    console.error("Team analytics error:", err);
    res.status(500).json({ error: "Failed to fetch team analytics" });
  }
});

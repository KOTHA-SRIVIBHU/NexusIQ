import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

export const logsRouter = Router();

logsRouter.use(authMiddleware);

logsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 50));
    const action = req.query.action as string | undefined;
    const folderId = req.query.folderId as string | undefined;

    const where: any = { folder: { organizationId: orgId } };
    if (action) where.action = action;
    if (folderId) where.folderId = folderId;

    const [logs, total] = await Promise.all([
      prisma.folderLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { folder: { select: { name: true, teamId: true } } },
      }),
      prisma.folderLog.count({ where }),
    ]);

    const allFolders = await prisma.folder.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, teamId: true },
    });

    res.json({
      logs: logs.map((l) => ({
        id: l.id, action: l.action, documentName: l.documentName,
        userName: l.userName, folderId: l.folderId, folderName: l.folder.name,
        createdAt: l.createdAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      folders: allFolders,
    });
  } catch (err) {
    console.error("Logs error:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

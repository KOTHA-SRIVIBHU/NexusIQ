import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

export const searchRouter = Router();

const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8000";

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

searchRouter.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query, topK } = req.body;
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Query string is required" });
      return;
    }

    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const userRoleLevel = ROLE_HIERARCHY[req.user!.role] ?? -1;

    const userTeamIds = (
      await prisma.teamMember.findMany({
        where: { userId, team: { organizationId: orgId } },
        select: { teamId: true },
      })
    ).map((t) => t.teamId);

    const docs = await prisma.document.findMany({
      where: { organizationId: orgId, status: "READY" },
      select: {
        id: true,
        originalName: true,
        folder: {
          select: { id: true, teamId: true, minViewRole: true, isPrivate: true, team: { select: { id: true } } },
        },
      },
    });

    const accessibleDocs = docs.filter((doc) => {
      if (!doc.folder) return true;

      if (doc.folder.teamId) {
        const isTeamMember = userTeamIds.includes(doc.folder.teamId);
        if (isTeamMember) return true;
        if (doc.folder.isPrivate) return false;
        const viewLevel = ROLE_HIERARCHY[doc.folder.minViewRole] ?? 0;
        return userRoleLevel >= viewLevel;
      }

      const viewLevel = ROLE_HIERARCHY[doc.folder.minViewRole] ?? 0;
      return userRoleLevel >= viewLevel;
    });

    if (accessibleDocs.length === 0) {
      res.json({ results: [], documents: [] });
      return;
    }

    const mlRes = await fetch(`${ML_ENGINE_URL}/search-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentIds: accessibleDocs.map((d) => d.id),
        query,
        topK: topK || 5,
      }),
    });

    if (!mlRes.ok) {
      const err = await mlRes.json().catch(() => ({ detail: "ML Engine error" }));
      res.status(502).json({ error: err.detail || "Search failed" });
      return;
    }

    const data = await mlRes.json();
    const docMap = new Map(accessibleDocs.map((d) => [d.id, d.originalName]));

    const results = (data.results || []).map((r: any) => ({
      ...r,
      documentName: docMap.get(r.documentId) || "Unknown",
    }));

    const filteredResults = results.filter((r: any) => docMap.has(r.documentId));

    res.json({ results: filteredResults, documents: accessibleDocs });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

searchRouter.post("/global", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string" || !query.trim()) {
      res.json({ members: [], folders: [], files: [], logs: [] });
      return;
    }

    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const q = query.trim();

    const userTeamIds = (
      await prisma.teamMember.findMany({
        where: { userId, team: { organizationId: orgId } },
        select: { teamId: true },
      })
    ).map((t) => t.teamId);

    const userRoleLevel = ROLE_HIERARCHY[req.user!.role] ?? -1;

    const [allMembers, allFolders, allDocs, allLogs] = await Promise.all([
      prisma.organizationMember.findMany({
        where: { organizationId: orgId, user: { name: { contains: q } } },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: 20,
      }),
      prisma.folder.findMany({
        where: {
          organizationId: orgId,
          name: { contains: q },
          OR: [
            { teamId: null },
            { teamId: { in: userTeamIds } },
            { teamId: { not: null }, isPrivate: false, minViewRole: { in: ["VIEWER", "EDITOR", "ADMIN", "SUPER_ADMIN"].filter(r => ROLE_HIERARCHY[r]! <= userRoleLevel) } },
          ],
        },
        include: { team: { select: { name: true } }, _count: { select: { documents: true } } },
        take: 20,
      }),
      prisma.document.findMany({
        where: { organizationId: orgId, originalName: { contains: q } },
        include: { uploadedBy: { select: { name: true } }, folder: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.folderLog.findMany({
        where: { folder: { organizationId: orgId }, documentName: { contains: q } },
        include: { folder: { select: { name: true, teamId: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const folders = allFolders.map((f) => ({
      id: f.id, name: f.name, teamName: f.team?.name || null, docCount: f._count.documents, teamId: f.teamId,
    }));

    const files = allDocs.map((d) => ({
      id: d.id, name: d.originalName, uploadedBy: d.uploadedBy.name, folderName: d.folder?.name || null, folderId: d.folderId,
    }));

    const logs = allLogs.map((l) => ({
      id: l.id, action: l.action, documentName: l.documentName, userName: l.userName, folderName: l.folder.name, createdAt: l.createdAt,
    }));

    const members = allMembers.map((m) => ({
      id: m.user.id, name: m.user.name, email: m.user.email, role: m.role,
    }));

    res.json({ members, folders, files, logs });
  } catch (err) {
    console.error("Global search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

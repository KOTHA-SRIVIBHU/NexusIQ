import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

export const askRouter = Router();

const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8000";

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

askRouter.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query, documentIds } = req.body;
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
      res.json({ answer: "No documents available to search.", citations: [] });
      return;
    }

    const mlRes = await fetch(`${ML_ENGINE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentIds: documentIds || accessibleDocs.map((d) => d.id),
        query,
      }),
    });

    if (!mlRes.ok) {
      const err = await mlRes.json().catch(() => ({ detail: "ML Engine error" }));
      res.status(502).json({ error: err.detail || "Ask failed" });
      return;
    }

    const data = await mlRes.json();
    const docMap = new Map(accessibleDocs.map((d) => [d.id, d.originalName]));
    const folderMap = new Map(accessibleDocs.map((d) => [d.id, d.folder?.id || null]));

    const citations = (data.citations || []).map((c: any) => ({
      ...c,
      documentName: docMap.get(c.documentId) || "Unknown",
      folderId: folderMap.get(c.documentId) || null,
    }));

    res.json({ answer: data.answer, citations });
  } catch (err) {
    console.error("Ask error:", err);
    res.status(500).json({ error: "Ask failed" });
  }
});

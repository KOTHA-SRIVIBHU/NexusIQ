import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

export const folderRouter = Router();

folderRouter.use(authMiddleware);

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

async function checkFolderAccess(folderId: string, user: { userId: string; organizationId: string; role: string },
  requireEdit = false, requireDelete = false): Promise<{ ok: boolean; folder?: any; error?: string; status?: number }> {

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, organizationId: user.organizationId },
    include: { team: { include: { members: { where: { userId: user.userId } } } } },
  });
  if (!folder) return { ok: false, error: "Folder not found", status: 404 };

  const userRoleLevel = ROLE_HIERARCHY[user.role] ?? -1;
  const adminLevel = ROLE_HIERARCHY["ADMIN"];

  if (requireDelete) {
    if (userRoleLevel < adminLevel) return { ok: false, error: "Only admins can delete", status: 403 };
    return { ok: true, folder };
  }

  const isTeamMember = folder.team && folder.team.members.length > 0;

  if (folder.teamId && !isTeamMember) {
    const viewLevel = ROLE_HIERARCHY[folder.minViewRole] ?? 0;
    if (userRoleLevel < viewLevel) return { ok: false, error: "You don't have permission to view this folder. Contact an admin.", status: 403 };
    if (requireEdit) {
      const editLevel = ROLE_HIERARCHY[folder.minEditRole] ?? 1;
      if (userRoleLevel < editLevel) return { ok: false, error: "You don't have permission to edit this folder. Contact an admin.", status: 403 };
    }
  } else if (folder.teamId && isTeamMember) {
    if (requireEdit) {
      const editLevel = ROLE_HIERARCHY[folder.minEditRole] ?? 1;
      if (userRoleLevel < editLevel) return { ok: false, error: "You don't have permission to edit this folder. Contact an admin.", status: 403 };
    }
  } else {
    const viewLevel = ROLE_HIERARCHY[folder.minViewRole] ?? 0;
    if (userRoleLevel < viewLevel) return { ok: false, error: "You don't have permission to view this folder. Contact an admin.", status: 403 };
    if (requireEdit) {
      const editLevel = ROLE_HIERARCHY[folder.minEditRole] ?? 1;
      if (userRoleLevel < editLevel) return { ok: false, error: "You don't have permission to edit this folder. Contact an admin.", status: 403 };
    }
  }

  return { ok: true, folder };
}

folderRouter.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const userRoleLevel = ROLE_HIERARCHY[req.user!.role] ?? 0;

    const userTeams = await prisma.teamMember.findMany({
      where: { userId, team: { organizationId: orgId } },
      select: { teamId: true },
    });
    const teamIds = userTeams.map((t) => t.teamId);

    const isOrgAdmin = userRoleLevel >= ROLE_HIERARCHY["ADMIN"];

    const folders = await prisma.folder.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { teamId: null },
          ...(isOrgAdmin
            ? [{ teamId: { not: null } }]
            : [
                { teamId: { in: teamIds } },
                { teamId: { not: null }, isPrivate: false, minViewRole: { in: ["VIEWER", "EDITOR", "ADMIN"].filter(r => ROLE_HIERARCHY[r]! <= userRoleLevel) } },
              ]
          ),
        ],
      },
      include: {
        _count: { select: { documents: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: [{ teamId: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    });

    res.json({ folders });
  } catch (err) {
    console.error("List folders error:", err);
    res.status(500).json({ error: "Failed to list folders" });
  }
});

folderRouter.post("/", requireRole("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { name, parentId, teamId, minViewRole, minEditRole, isPrivate } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }

    if (teamId) {
      const team = await prisma.team.findFirst({
        where: { id: teamId, organizationId: req.user!.organizationId },
      });
      if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    }

    const validRoles = ["VIEWER", "EDITOR", "ADMIN", "SUPER_ADMIN"];
    const viewRole = validRoles.includes(minViewRole) ? minViewRole : "VIEWER";
    const editRole = validRoles.includes(minEditRole) ? minEditRole : "EDITOR";

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        organizationId: req.user!.organizationId,
        parentId: parentId || null,
        teamId: teamId || null,
        minViewRole: viewRole,
        minEditRole: editRole,
        isPrivate: teamId ? (isPrivate === true) : false,
      },
    });

    res.status(201).json({ folder });
  } catch (err) {
    console.error("Create folder error:", err);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

async function canManagePrivacy(userId: string, userRole: string, teamId: string | null): Promise<boolean> {
  const userRoleLevel = ROLE_HIERARCHY[userRole] ?? -1;
  if (userRoleLevel >= ROLE_HIERARCHY["ADMIN"]) return true;
  if (teamId) {
    const tm = await prisma.teamMember.findFirst({
      where: { userId, teamId, role: "LEAD" },
    });
    return !!tm;
  }
  return false;
}

folderRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name, minViewRole, minEditRole, isPrivate } = req.body;
    const { ok, error, status, folder } = await checkFolderAccess(String(req.params.id), req.user!, true);
    if (!ok) { res.status(status || 403).json({ error }); return; }

    const data: any = {};
    if (name && typeof name === "string" && name.trim()) data.name = name.trim();
    if (minViewRole) data.minViewRole = minViewRole;
    if (minEditRole) data.minEditRole = minEditRole;
    if (isPrivate !== undefined && folder.teamId) {
      const canPrivate = await canManagePrivacy(req.user!.userId, req.user!.role, folder.teamId);
      if (!canPrivate) { res.status(403).json({ error: "Only team leads and admins can change privacy" }); return; }
      data.isPrivate = isPrivate === true;
    }

    const updated = await prisma.folder.update({ where: { id: folder.id }, data });
    res.json({ folder: updated });
  } catch (err) {
    console.error("Update folder error:", err);
    res.status(500).json({ error: "Failed to update folder" });
  }
});

folderRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { ok, error, status, folder } = await checkFolderAccess(String(req.params.id), req.user!, false, true);
    if (!ok) { res.status(status || 403).json({ error }); return; }

    const docCount = await prisma.document.count({ where: { folderId: folder.id, organizationId: req.user!.organizationId } });
    if (docCount > 0) {
      res.status(400).json({ error: `Cannot delete folder with ${docCount} file(s). Move or delete files first.` });
      return;
    }

    await prisma.folderPermission.deleteMany({ where: { folderId: folder.id } });
    await prisma.folderLog.deleteMany({ where: { folderId: folder.id } });
    await prisma.folder.delete({ where: { id: folder.id } });
    res.json({ message: "Folder deleted" });
  } catch (err) {
    console.error("Delete folder error:", err);
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

folderRouter.post("/batch-delete", async (req: Request, res: Response) => {
  try {
    const { folderIds } = req.body;
    if (!Array.isArray(folderIds) || folderIds.length === 0) {
      res.status(400).json({ error: "folderIds must be a non-empty array" });
      return;
    }

    const orgId = req.user!.organizationId;
    const folders = await prisma.folder.findMany({
      where: { id: { in: folderIds }, organizationId: orgId },
      include: { _count: { select: { documents: true } } },
    });

    const adminLevel = ROLE_HIERARCHY["ADMIN"];
    const userLevel = ROLE_HIERARCHY[req.user!.role] ?? -1;
    if (userLevel < adminLevel) {
      res.status(403).json({ error: "Only admins can delete folders" });
      return;
    }

    const nonEmpty = folders.find((f) => f._count.documents > 0);
    if (nonEmpty) {
      res.status(400).json({ error: `Folder "${nonEmpty.name}" has ${nonEmpty._count.documents} file(s). Cannot delete.` });
      return;
    }

    const ids = folders.map((f) => f.id);
    await prisma.folderPermission.deleteMany({ where: { folderId: { in: ids } } });
    await prisma.folderLog.deleteMany({ where: { folderId: { in: ids } } });
    await prisma.folder.deleteMany({ where: { id: { in: ids } } });

    res.json({ message: `Deleted ${ids.length} folder(s)` });
  } catch (err) {
    console.error("Batch delete folders error:", err);
    res.status(500).json({ error: "Failed to delete folders" });
  }
});

folderRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { ok, error, status, folder } = await checkFolderAccess(String(req.params.id), req.user!);
    if (!ok) { res.status(status || 403).json({ error }); return; }

    const [documents, logs] = await Promise.all([
      prisma.document.findMany({
        where: { folderId: folder.id, organizationId: req.user!.organizationId },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      }),
      prisma.folderLog.findMany({
        where: { folderId: folder.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    res.json({ folder: { ...folder, documents, logs } });
  } catch (err) {
    console.error("Get folder error:", err);
    res.status(500).json({ error: "Failed to get folder" });
  }
});

folderRouter.put("/:id/documents", async (req: Request, res: Response) => {
  try {
    const { documentIds } = req.body;
    const { ok, error, status, folder } = await checkFolderAccess(String(req.params.id), req.user!, true);
    if (!ok) { res.status(status || 403).json({ error }); return; }

    if (!Array.isArray(documentIds)) { res.status(400).json({ error: "documentIds must be an array" }); return; }

    await prisma.document.updateMany({
      where: { id: { in: documentIds }, organizationId: req.user!.organizationId },
      data: { folderId: folder.id },
    });

    res.json({ message: "Documents moved to folder" });
  } catch (err) {
    console.error("Assign documents error:", err);
    res.status(500).json({ error: "Failed to assign documents" });
  }
});

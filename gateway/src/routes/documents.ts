import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { addToQueue } from "../services/queue.js";

const UPLOADS_DIR = path.resolve("uploads");

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/markdown",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

export const documentRouter = Router();
export const internalRouter = Router();

documentRouter.post("/upload", authMiddleware, upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

    let folderId = req.body.folderId || undefined;
    if (!folderId) {
      let general = await prisma.folder.findFirst({
        where: { organizationId: req.user!.organizationId, name: "General", teamId: null },
      });
      if (!general) {
        general = await prisma.folder.create({
          data: { name: "General", organizationId: req.user!.organizationId },
        });
      }
      folderId = general.id;
    }
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, organizationId: req.user!.organizationId },
      });
      if (!folder) { res.status(400).json({ error: "Folder not found" }); return; }
    }

    const doc = await prisma.document.create({
      data: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storagePath: req.file.path,
        status: "UPLOADING",
        organizationId: req.user!.organizationId,
        uploadedById: req.user!.userId,
        folderId,
      },
    });

    if (folderId) {
      await prisma.folderLog.create({
        data: {
          folderId,
          action: "UPLOAD",
          documentId: doc.id,
          documentName: doc.originalName,
          userId: req.user!.userId,
          userName: req.user!.email,
        },
      });
    }

    await addToQueue(doc.id);

    res.status(201).json({
      id: doc.id,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
      status: "UPLOADING",
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

documentRouter.get("/", authMiddleware, async (req: Request, res: Response) => {
  const documents = await prisma.document.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { uploadedBy: { select: { id: true, name: true } }, folder: { select: { id: true, name: true, teamId: true } } },
  });
  res.json({ documents });
});

documentRouter.post("/batch-delete", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { documentIds } = req.body;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({ error: "documentIds must be a non-empty array" });
      return;
    }

    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
    const isEditor = req.user!.role === "EDITOR";

    const docs = await prisma.document.findMany({
      where: { id: { in: documentIds }, organizationId: orgId },
    });

    const toDelete: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const doc of docs) {
      if (isAdmin) {
        toDelete.push(doc.id);
      } else if (isEditor && doc.uploadedById === userId && Date.now() - doc.createdAt.getTime() < 3600000) {
        toDelete.push(doc.id);
      } else {
        failed.push({ id: doc.id, reason: "No permission to delete" });
      }
    }

    if (toDelete.length > 0) {
      const logs = docs.filter((d) => toDelete.includes(d.id) && d.folderId).map((d) => ({
        folderId: d.folderId!,
        action: "DELETE",
        documentId: d.id,
        documentName: d.originalName,
        userId,
        userName: req.user!.email,
      }));

      if (logs.length > 0) {
        await prisma.folderLog.createMany({ data: logs });
      }

      for (const doc of docs.filter((d) => toDelete.includes(d.id))) {
        try { await fs.promises.unlink(doc.storagePath); } catch { /* ignore */ }
      }

      await prisma.document.deleteMany({ where: { id: { in: toDelete } } });
    }

    res.json({ deleted: toDelete.length, failed });
  } catch (err) {
    console.error("Batch delete documents error:", err);
    res.status(500).json({ error: "Failed to delete documents" });
  }
});

documentRouter.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    });
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

    const userRole = req.user!.role;
    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
    const isOwner = doc.uploadedById === req.user!.userId;
    const withinHour = Date.now() - doc.createdAt.getTime() < 60 * 60 * 1000;
    const isEditor = userRole === "EDITOR";

    if (isAdmin) {
      // can delete any
    } else if (isEditor && isOwner && withinHour) {
      // can delete own within 1 hour
    } else {
      res.status(403).json({ error: "You don't have permission to delete this document" });
      return;
    }

    if (doc.storagePath) {
      try { await fs.promises.unlink(doc.storagePath); } catch { /* file may not exist */ }
    }

    if (doc.folderId) {
      await prisma.folderLog.create({
        data: {
          folderId: doc.folderId,
          action: "DELETE",
          documentId: doc.id,
          documentName: doc.originalName,
          userId: req.user!.userId,
          userName: req.user!.email,
        },
      });
    }

    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("Delete document error:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

documentRouter.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const doc = await prisma.document.findFirst({
    where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    include: { uploadedBy: { select: { id: true, name: true } }, folder: { select: { id: true, name: true, teamId: true } } },
  });
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  res.json(doc);
});

internalRouter.get("/documents/:id/file", async (req: Request, res: Response) => {
  const doc = await prisma.document.findUnique({ where: { id: String(req.params.id) } });
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  res.setHeader("Content-Disposition", `inline; filename="${doc.originalName}"`);
  res.sendFile(doc.storagePath);
});

internalRouter.post("/documents/callback", async (req: Request, res: Response) => {
  try {
    const { documentId, status, pageCount, tokenCount, error } = req.body;
    if (!documentId || !status) { res.status(400).json({ error: "Missing required fields" }); return; }

    if (status === "READY") {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "READY", pageCount, tokenCount, errorMessage: null },
      });
    } else {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "FAILED", errorMessage: error || "Processing failed" },
      });
    }

    res.json({ message: "Callback received" });
  } catch (err) {
    console.error("Callback error:", err);
    res.status(500).json({ error: "Callback processing failed" });
  }
});

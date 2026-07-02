import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ notifications });
});

router.get("/unread", authMiddleware, async (req: Request, res: Response) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.userId, read: false },
  });
  res.json({ count });
});

router.patch("/:id/read", authMiddleware, async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: req.user!.userId },
    data: { read: true },
  });
  res.json({ message: "Marked as read" });
});

router.post("/read-all", authMiddleware, async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.userId, read: false },
    data: { read: true },
  });
  res.json({ message: "All marked as read" });
});

export default router;

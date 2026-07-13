import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

export const askFeedbackRouter = Router();

askFeedbackRouter.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { query, rewrittenQuery, answer, citations, feedback } = req.body;

    if (!query || !answer || !feedback || !["UP", "DOWN"].includes(feedback)) {
      res.status(400).json({ error: "query, answer, and feedback (UP|DOWN) are required" });
      return;
    }

    await prisma.askFeedback.create({
      data: {
        query,
        rewrittenQuery: rewrittenQuery || null,
        answer,
        citations: JSON.stringify(citations || []),
        feedback,
        userId: req.user!.userId,
        organizationId: req.user!.organizationId,
      },
    });

    res.json({ message: "Feedback recorded" });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

askFeedbackRouter.get("/stats", authMiddleware, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.organizationId;

    const [up, down, recent] = await Promise.all([
      prisma.askFeedback.count({ where: { organizationId: orgId, feedback: "UP" } }),
      prisma.askFeedback.count({ where: { organizationId: orgId, feedback: "DOWN" } }),
      prisma.askFeedback.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { query: true, feedback: true, createdAt: true },
      }),
    ]);

    res.json({ up, down, total: up + down, recent });
  } catch (err) {
    console.error("Feedback stats error:", err);
    res.status(500).json({ error: "Failed to fetch feedback stats" });
  }
});

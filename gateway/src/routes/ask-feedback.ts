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

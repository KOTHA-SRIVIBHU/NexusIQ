import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import invitationRoutes from "./routes/invitations.js";
import teamRoutes from "./routes/teams.js";
import teamRequestRoutes from "./routes/team-requests.js";
import roleRequestRoutes from "./routes/role-requests.js";
import notificationRoutes from "./routes/notifications.js";
import { documentRouter, internalRouter } from "./routes/documents.js";
import { searchRouter } from "./routes/search.js";
import { askRouter } from "./routes/ask.js";
import { folderRouter } from "./routes/folders.js";
import { analyticsRouter } from "./routes/analytics.js";
import { logsRouter } from "./routes/logs.js";
import { authMiddleware } from "./middleware/auth.js";
import { startWorker } from "./services/queue.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nexusiq-gateway" });
});

app.use("/api/auth", authRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/team-requests", teamRequestRoutes);
app.use("/api/role-requests", roleRequestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/documents", documentRouter);
app.use("/api/search", searchRouter);
app.use("/api/ask", askRouter);
app.use("/api/folders", folderRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/logs", logsRouter);
app.use("/internal", internalRouter);

app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "You are authenticated", user: req.user });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
  startWorker();
});

export default app;

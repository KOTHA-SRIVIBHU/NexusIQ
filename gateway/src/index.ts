import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import invitationRoutes from "./routes/invitations.js";
import { authMiddleware } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nexusiq-gateway" });
});

app.use("/api/auth", authRoutes);
app.use("/api/invitations", invitationRoutes);

app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "You are authenticated", user: req.user });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});

export default app;

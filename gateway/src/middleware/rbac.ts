import { Request, Response, NextFunction } from "express";

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
    const minRequired = Math.min(
      ...allowedRoles.map((r) => ROLE_HIERARCHY[r] ?? 99)
    );

    if (userLevel < minRequired) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export function requireOrgMembership(req: Request, res: Response, next: NextFunction): void {
  const orgId = req.params.organizationId || req.body.organizationId;
  if (orgId && req.user?.organizationId !== orgId) {
    res.status(403).json({ error: "Not a member of this organization" });
    return;
  }
  next();
}

/**
 * FarmFreshFarmer — Admin Approval Workflow Routes
 * =================================================
 */
import type { Express, Request, Response, NextFunction } from "express";
import { eq, or, and, desc } from "drizzle-orm";
import { products, categories, productApprovalHistory, users } from "../../../shared/schema";
import { db } from "../../db";

type ApprovalAction = "approved" | "rejected" | "under_review";

function h(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err: any) => {
      console.error("[approval route error]", err?.message || err);
      if (!res.headersSent) res.status(500).json({ message: err?.message || "Server error" });
    });
  };
}

const STAFF_ROLES = [
  "admin", "warehouse_admin", "manager_admin", "subadmin", "custom_subadmin",
  "customer_rep", "local_grievance_officer", "zonal_grievance_officer", "chief_grievance_officer",
];

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.session?.userId && req.session?.role && STAFF_ROLES.includes(req.session.role)) return next();
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.cookies?.accessToken ?? req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import("jsonwebtoken")).default;
      let decoded: any;
      try { decoded = jwt.verify(token, process.env.JWT_SECRET || "farmfreshfarmer-jwt-secret") as any; }
      catch { decoded = jwt.decode(token) as any; }
      if (decoded?.role && STAFF_ROLES.includes(decoded.role)) {
        req.session.userId = typeof decoded.userId === "string" ? parseInt(decoded.userId, 10) : decoded.userId ?? decoded.sub;
        req.session.role = decoded.role;
        return next();
      }
      if (decoded?.userId || decoded?.sub) {
        const uid = decoded.userId ?? decoded.sub;
        const [user] = await db.select().from(users).where(eq(users.id, typeof uid === "string" ? parseInt(uid, 10) : uid));
        if (user && STAFF_ROLES.includes(user.role)) { req.session.userId = user.id; req.session.role = user.role; return next(); }
      }
    } catch { /* fall through */ }
  }
  res.status(401).json({ message: "Unauthorized" });
}

async function assertPrimaryAdmin(req: Request, res: Response): Promise<boolean> {
  const uid = req.session?.userId;
  if (!uid) { res.status(401).json({ message: "Unauthorized" }); return false; }
  const [user] = await db.select().from(users).where(eq(users.id, uid));
  if (!user) { res.status(401).json({ message: "Unauthorized" }); return false; }
  const isPrimary = Boolean(user.isPrimaryAdmin) || user.email?.toLowerCase() === "admin@farmfreshfarmer.com" || (user.role === "admin" && user.id === 1);
  if (!isPrimary) { res.status(403).json({ message: "Only the primary admin can perform this action." }); return false; }
  return true;
}

async function resolveSubmitterName(submittedBy: number | null | undefined): Promise<string | null> {
  if (!submittedBy) return null;
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, submittedBy));
  return u?.name ?? null;
}

export function registerApprovalRoutes(app: Express, _storage: any): void {

  app.get("/api/admin/approvals/products", requireAdmin, h(async (_req, res) => {
    const rows = await db.select().from(products)
      .where(or(eq(products.approvalStatus, "pending"), eq(products.approvalStatus, "under_review")))
      .orderBy(desc(products.createdAt));
    const result = await Promise.all(rows.map(async (p) => ({
      id: p.id, name: p.name, image: p.image, price: p.price,
      categorySlug: p.categorySlug, approvalStatus: p.approvalStatus,
      submittedBy: p.submittedBy, approvalNote: p.approvalNote,
      createdAt: p.createdAt, submitterName: await resolveSubmitterName(p.submittedBy),
    })));
    return res.json(result);
  }));

  app.get("/api/admin/approvals/categories", requireAdmin, h(async (_req, res) => {
    const rows = await db.select().from(categories)
      .where(or(eq(categories.approvalStatus, "pending"), eq(categories.approvalStatus, "under_review")))
      .orderBy(desc(categories.createdAt));
    const result = await Promise.all(rows.map(async (c) => ({
      id: c.id, name: c.name, slug: c.slug,
      approvalStatus: c.approvalStatus, submittedBy: c.submittedBy,
      approvalNote: c.approvalNote, createdAt: c.createdAt,
      submitterName: await resolveSubmitterName(c.submittedBy),
    })));
    return res.json(result);
  }));

  app.patch("/api/admin/approvals/products/:id", requireAdmin, h(async (req, res) => {
    const ok = await assertPrimaryAdmin(req, res);
    if (!ok) return;
    const idRaw = req.params.id;
    const id = parseInt(Array.isArray(idRaw) ? idRaw[0] : idRaw, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid product id" });
    const { action, note } = req.body as { action?: ApprovalAction; note?: string };
    const VALID: ApprovalAction[] = ["approved", "rejected", "under_review"];
    if (!action || !VALID.includes(action)) return res.status(400).json({ message: `'action' must be one of: ${VALID.join(", ")}` });
    const [existing] = await db.select().from(products).where(eq(products.id, id));
    if (!existing) return res.status(404).json({ message: "Product not found" });
    const patch: Record<string, any> = { approvalStatus: action, approvalNote: note ?? null, updatedAt: new Date() };
    if (action === "approved") patch.active = true;
    if (action === "rejected") patch.active = false;
    const [updated] = await db.update(products).set(patch).where(eq(products.id, id)).returning();
    await db.insert(productApprovalHistory).values({
      entityType: "product", entityId: id, entityName: existing.name ?? "",
      action, fromStatus: existing.approvalStatus ?? null, toStatus: action,
      adminUserId: req.session.userId ?? null, submittedByUserId: existing.submittedBy ?? null, note: note ?? null,
    });
    return res.json({ success: true, product: updated });
  }));

  app.patch("/api/admin/approvals/categories/:id", requireAdmin, h(async (req, res) => {
    const ok = await assertPrimaryAdmin(req, res);
    if (!ok) return;
    const idRaw = req.params.id;
    const id = parseInt(Array.isArray(idRaw) ? idRaw[0] : idRaw, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid category id" });
    const { action, note } = req.body as { action?: ApprovalAction; note?: string };
    const VALID: ApprovalAction[] = ["approved", "rejected", "under_review"];
    if (!action || !VALID.includes(action)) return res.status(400).json({ message: `'action' must be one of: ${VALID.join(", ")}` });
    const [existing] = await db.select().from(categories).where(eq(categories.id, id));
    if (!existing) return res.status(404).json({ message: "Category not found" });
    const patch: Record<string, any> = { approvalStatus: action, approvalNote: note ?? null };
    if (action === "approved") patch.active = true;
    if (action === "rejected") patch.active = false;
    const [updated] = await db.update(categories).set(patch).where(eq(categories.id, id)).returning();
    await db.insert(productApprovalHistory).values({
      entityType: "category", entityId: id, entityName: existing.name ?? "",
      action, fromStatus: existing.approvalStatus ?? null, toStatus: action,
      adminUserId: req.session.userId ?? null, submittedByUserId: existing.submittedBy ?? null, note: note ?? null,
    });
    return res.json({ success: true, category: updated });
  }));

  app.get("/api/admin/approvals/history", requireAdmin, h(async (req, res) => {
    const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
    const conditions: any[] = [];
    if (entityType && ["product", "category"].includes(entityType)) conditions.push(eq(productApprovalHistory.entityType, entityType));
    if (entityId) { const eid = parseInt(entityId, 10); if (!isNaN(eid)) conditions.push(eq(productApprovalHistory.entityId, eid)); }
    const rows = await db.select().from(productApprovalHistory)
      .where(conditions.length > 0 ? and(...(conditions as [any, ...any[]])) : undefined)
      .orderBy(desc(productApprovalHistory.createdAt)).limit(50);
    return res.json(rows);
  }));
}

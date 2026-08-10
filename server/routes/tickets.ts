import type { Express, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql, eq, desc, and, or } from 'drizzle-orm';
import { supportTickets, users } from '@shared/schema';
import { sendTelegramGrievanceAlert } from '../services/telegram';

const ALLOWED_STAFF_ROLES = [
  'admin', 'warehouse_admin', 'manager_admin', 'subadmin', 'custom_subadmin',
  'customer_rep', 'local_grievance_officer', 'zonal_grievance_officer', 'chief_grievance_officer'
];

async function requireStaffOrAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionUser = (req.session as any)?.userId ? (req.session as any) : null;
  if (sessionUser?.role && ALLOWED_STAFF_ROLES.includes(sessionUser.role)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.cookies?.accessToken || req.cookies?.token);
  if (token) {
    try {
      const jwt = (await import('jsonwebtoken')).default;
      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'farmfreshfarmer-jwt-secret') as any;
      } catch {
        decoded = jwt.decode(token) as any;
      }
      if (decoded?.role && ALLOWED_STAFF_ROLES.includes(decoded.role)) {
        (req as any).user = { id: decoded.userId || decoded.sub, name: decoded.name || decoded.username || 'Staff Rep', role: decoded.role };
        return next();
      }
    } catch {}
  }

  if (sessionUser?.userId) {
    try {
      const [u] = await db.select().from(users).where(eq(users.id, sessionUser.userId));
      if (u && ALLOWED_STAFF_ROLES.includes(u.role)) {
        (req as any).user = u;
        return next();
      }
    } catch {}
  }

  return res.status(403).json({ message: 'Access Denied: Staff or Admin privileges required.' });
}

export function registerTicketRoutes(app: Express) {
  // Ensure table exists
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      ticket_id VARCHAR(32) NOT NULL UNIQUE,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      concern TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      priority VARCHAR(16) NOT NULL DEFAULT 'medium',
      assigned_agent_id INTEGER,
      assigned_agent_name TEXT,
      admin_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `).catch(err => console.warn('[tickets] Table creation check:', err?.message || err));

  // POST /api/support-tickets — Raise a new ticket
  app.post('/api/support-tickets', async (req: Request, res: Response) => {
    try {
      const { customerName, customerPhone, customerEmail, concern, userId } = req.body;

      if (!customerName || !customerPhone || !customerEmail || !concern) {
        return res.status(400).json({ message: 'All fields (name, phone, email, concern) are required.' });
      }

      const ticketNum = Math.floor(1000 + Math.random() * 9000);
      const ticketId = `TICK-${Date.now().toString().slice(-4)}${ticketNum}`;

      const [newTicket] = await db.insert(supportTickets).values({
        ticketId,
        userId: userId ? Number(userId) : null,
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerEmail: String(customerEmail).trim().toLowerCase(),
        concern: String(concern).trim(),
        status: 'open',
        priority: 'medium',
      }).returning();

      // Dispatch Telegram Alert to Staff
      const alertMsg = `🎫 <b>[NEW SUPPORT TICKET RAISED]</b>\n` +
        `<b>Ticket ID:</b> <code>${ticketId}</code>\n` +
        `<b>Name:</b> ${customerName}\n` +
        `<b>Phone:</b> ${customerPhone}\n` +
        `<b>Email:</b> ${customerEmail}\n` +
        `<b>Concern:</b> "${concern}"\n\n` +
        `👉 <b>Log in to Admin Panel to solve:</b>\nhttps://www.farmfreshfarmer.com/admin/tickets`;
      
      await sendTelegramGrievanceAlert(alertMsg).catch(() => {});

      return res.json({
        success: true,
        message: `Ticket #${ticketId} created successfully.`,
        ticket: newTicket,
      });
    } catch (err: any) {
      console.error('[tickets] Error creating ticket:', err);
      return res.status(500).json({ message: 'Failed to create support ticket' });
    }
  });

  // GET /api/support-tickets/my — Customer view their tickets
  app.get('/api/support-tickets/my', async (req: Request, res: Response) => {
    try {
      const email = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
      const userId = (req.session as any)?.userId ? Number((req.session as any).userId) : null;

      if (!email && !userId) {
        return res.json({ tickets: [] });
      }

      let query = db.select().from(supportTickets);
      if (userId && email) {
        query = query.where(or(eq(supportTickets.userId, userId), eq(supportTickets.customerEmail, email))) as any;
      } else if (userId) {
        query = query.where(eq(supportTickets.userId, userId)) as any;
      } else if (email) {
        query = query.where(eq(supportTickets.customerEmail, email)) as any;
      }

      const tickets = await query.orderBy(desc(supportTickets.createdAt));
      return res.json({ tickets });
    } catch (err) {
      console.error('[tickets] Error fetching my tickets:', err);
      return res.status(500).json({ message: 'Failed to fetch tickets' });
    }
  });

  // GET /api/admin/support-tickets — Staff/Admin list all tickets
  app.get('/api/admin/support-tickets', requireStaffOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const statusFilter = req.query.status ? String(req.query.status) : null;
      let query = db.select().from(supportTickets);

      if (statusFilter && statusFilter !== 'all') {
        query = query.where(eq(supportTickets.status, statusFilter)) as any;
      }

      const tickets = await query.orderBy(desc(supportTickets.createdAt));
      return res.json({ tickets });
    } catch (err) {
      console.error('[tickets] Error fetching admin tickets:', err);
      return res.status(500).json({ message: 'Failed to fetch tickets' });
    }
  });

  // PATCH /api/admin/support-tickets/:id — Update ticket status or notes
  app.patch('/api/admin/support-tickets/:id', requireStaffOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const ticketId = Number(req.params.id);
      const { status, adminNotes, priority, assignedAgentName } = req.body;
      const staffUser = (req as any).user;

      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = String(status); // open | under_solving | solved | closed
      if (priority) updateData.priority = String(priority);
      if (adminNotes !== undefined) updateData.adminNotes = String(adminNotes);
      if (assignedAgentName !== undefined) updateData.assignedAgentName = String(assignedAgentName);
      else if (staffUser?.name) updateData.assignedAgentName = staffUser.name;

      const [updated] = await db.update(supportTickets)
        .set(updateData)
        .where(eq(supportTickets.id, ticketId))
        .returning();

      return res.json({ success: true, ticket: updated });
    } catch (err) {
      console.error('[tickets] Error updating ticket:', err);
      return res.status(500).json({ message: 'Failed to update ticket' });
    }
  });
}

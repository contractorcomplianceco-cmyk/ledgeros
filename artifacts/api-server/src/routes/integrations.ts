import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  integrationEventsTable,
  productMappingsTable,
} from "@workspace/db";
import {
  CreateIntegrationEventBody,
  ActionIntegrationEventBody,
  ActionIntegrationEventParams,
  CreateProductMappingBody,
} from "@workspace/api-zod";
import { requirePermission } from "../lib/auth";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

router.get(
  "/integration-events",
  requirePermission("integrations.view"),
  async (req, res): Promise<void> => {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await db.select().from(integrationEventsTable);
    res.json(
      rows
        .filter((r) => !status || r.status === status)
        .sort((a, b) => b.id - a.id),
    );
  },
);

// Ingestion endpoint used by the Integration Service role. Events are ALWAYS
// received as "new" and never auto-posted to the ledger; a human must action them.
router.post(
  "/integration-events",
  requirePermission("integrations.ingest"),
  async (req, res): Promise<void> => {
    const parsed = CreateIntegrationEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [event] = await db
      .insert(integrationEventsTable)
      .values({
        sourceApp: d.sourceApp,
        eventType: d.eventType,
        status: "new",
        summary: d.summary ?? null,
        amount: d.amount ?? null,
        payload: d.payload ?? null,
      })
      .returning();
    await recordAudit(req, {
      action: "ingest",
      recordType: "integration_event",
      recordId: event.id,
      after: event,
    });
    res.status(201).json(event);
  },
);

// Human review of an inbound event: accept (mark for manual entry) or dismiss.
// This never posts to the ledger automatically.
router.post(
  "/integration-events/:id/action",
  requirePermission("integrations.manage"),
  async (req, res): Promise<void> => {
    const params = ActionIntegrationEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = ActionIntegrationEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(integrationEventsTable)
      .where(eq(integrationEventsTable.id, params.data.id));
    if (!before) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (before.status !== "new") {
      res.status(400).json({
        error: `This event has already been ${before.status}.`,
      });
      return;
    }
    const action = parsed.data.action;
    let status: string;
    if (action === "accept") status = "accepted";
    else if (action === "dismiss") status = "dismissed";
    else {
      res.status(400).json({ error: `Unknown action: ${action}` });
      return;
    }
    const [event] = await db
      .update(integrationEventsTable)
      .set({ status })
      .where(eq(integrationEventsTable.id, params.data.id))
      .returning();
    await recordAudit(req, {
      action: `event.${action}`,
      recordType: "integration_event",
      recordId: event.id,
      before: { status: before.status },
      after: { status },
      note: parsed.data.note ?? null,
    });
    res.json(event);
  },
);

router.get(
  "/product-mappings",
  requirePermission("integrations.view"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(productMappingsTable);
    res.json(rows.sort((a, b) => a.id - b.id));
  },
);

router.post(
  "/product-mappings",
  requirePermission("integrations.manage"),
  async (req, res): Promise<void> => {
    const parsed = CreateProductMappingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [mapping] = await db
      .insert(productMappingsTable)
      .values({
        sourceApp: d.sourceApp,
        eventType: d.eventType,
        action: d.action,
        revenueAccountId: d.revenueAccountId ?? null,
        costAccountId: d.costAccountId ?? null,
        autoDraft: d.autoDraft ?? false,
        notes: d.notes ?? null,
      })
      .returning();
    await recordAudit(req, {
      action: "create",
      recordType: "product_mapping",
      recordId: mapping.id,
      after: mapping,
    });
    res.status(201).json(mapping);
  },
);

export default router;

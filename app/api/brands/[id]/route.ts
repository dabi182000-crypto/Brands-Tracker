import { env } from "cloudflare:workers";

const STATUSES = ["Starting", "In progress", "Done", "Uploaded"] as const;
const ASSET_STATUSES = ["Not requested", "Request sent", "Partly received", "Assets received"] as const;
const REMINDER_STATUSES = ["No reminder", "1st Reminder", "2nd Reminder", "Last Reminder"] as const;
const SEASON_PHASES = ["Pre", "Main"] as const;

type Status = (typeof STATUSES)[number];
type AssetStatus = (typeof ASSET_STATUSES)[number];
type ReminderStatus = (typeof REMINDER_STATUSES)[number];
type SeasonPhase = (typeof SEASON_PHASES)[number];

type BrandRow = {
  id: number;
  name: string;
  employee: string;
  season: string;
  season_phase: SeasonPhase;
  asset_status: string;
  reminder_status: string;
  status: Status;
  progress: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && STATUSES.includes(value as Status);
}

function isAssetStatus(value: unknown): value is AssetStatus {
  return typeof value === "string" && ASSET_STATUSES.includes(value as AssetStatus);
}

function isReminderStatus(value: unknown): value is ReminderStatus {
  return typeof value === "string" && REMINDER_STATUSES.includes(value as ReminderStatus);
}

function isSeasonPhase(value: unknown): value is SeasonPhase {
  return typeof value === "string" && SEASON_PHASES.includes(value as SeasonPhase);
}

function toBrand(row: BrandRow) {
  const legacyReminder = isReminderStatus(row.asset_status) && row.asset_status !== "No reminder"
    ? row.asset_status
    : null;
  return {
    id: row.id,
    name: row.name,
    employee: row.employee,
    season: row.season,
    seasonPhase: row.season_phase,
    assetStatus: isAssetStatus(row.asset_status) ? row.asset_status : "Request sent",
    reminderStatus: isReminderStatus(row.reminder_status) && row.reminder_status !== "No reminder"
      ? row.reminder_status
      : legacyReminder ?? "No reminder",
    status: row.status,
    progress: row.progress,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Invalid brand." }, { status: 400 });
    }

    const payload = (await request.json()) as {
      status?: unknown;
      employee?: unknown;
      season?: unknown;
      seasonPhase?: unknown;
      assetStatus?: unknown;
      reminderStatus?: unknown;
      progress?: unknown;
      notes?: unknown;
    };
    const employee = typeof payload.employee === "string" ? payload.employee.trim() : "";
    const season = typeof payload.season === "string" ? payload.season.trim() : "";
    const seasonPhase = payload.seasonPhase;
    const assetStatus = payload.assetStatus === undefined ? null : payload.assetStatus;
    const reminderStatus = payload.reminderStatus;
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const progress = typeof payload.progress === "number" ? payload.progress : Number.NaN;
    if (
      !isStatus(payload.status) ||
      !employee ||
      !season ||
      !isSeasonPhase(seasonPhase) ||
      (assetStatus !== null && !isAssetStatus(assetStatus)) ||
      !isReminderStatus(reminderStatus) ||
      employee.length > 80 ||
      season.length > 30 ||
      !Number.isInteger(progress) ||
      progress < 0 ||
      progress > 100 ||
      notes.length > 500
    ) {
      return Response.json({ error: "Invalid brand details." }, { status: 400 });
    }

    const brand = await env.DB.prepare(
      `UPDATE brands
       SET employee = ?, season = ?, season_phase = ?, asset_status = COALESCE(?, asset_status), reminder_status = ?, status = ?, progress = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       RETURNING id, name, employee, season, season_phase, asset_status, reminder_status, status, progress, notes, created_at, updated_at`,
    )
      .bind(employee, season, seasonPhase, assetStatus, reminderStatus, payload.status, progress, notes, id)
      .first<BrandRow>();

    if (!brand) {
      return Response.json({ error: "Brand not found." }, { status: 404 });
    }

    return Response.json({ brand: toBrand(brand) });
  } catch {
    return Response.json({ error: "Could not save this update." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Invalid brand." }, { status: 400 });
    }

    const deleted = await env.DB.prepare("DELETE FROM brands WHERE id = ? RETURNING id")
      .bind(id)
      .first<{ id: number }>();

    if (!deleted) {
      return Response.json({ error: "Brand not found." }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Could not remove this brand." }, { status: 500 });
  }
}

import { env } from "cloudflare:workers";

const STATUSES = ["Starting", "In progress", "Done", "Uploaded"] as const;

type Status = (typeof STATUSES)[number];

type BrandRow = {
  id: number;
  name: string;
  employee: string;
  season: string;
  status: Status;
  progress: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

function isStatus(value: unknown): value is Status {
  return typeof value === "string" && STATUSES.includes(value as Status);
}

function toBrand(row: BrandRow) {
  return {
    id: row.id,
    name: row.name,
    employee: row.employee,
    season: row.season,
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
      progress?: unknown;
      notes?: unknown;
    };
    const employee = typeof payload.employee === "string" ? payload.employee.trim() : "";
    const season = typeof payload.season === "string" ? payload.season.trim() : "";
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const progress = typeof payload.progress === "number" ? payload.progress : Number.NaN;
    if (
      !isStatus(payload.status) ||
      !employee ||
      !season ||
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
       SET employee = ?, season = ?, status = ?, progress = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       RETURNING id, name, employee, season, status, progress, notes, created_at, updated_at`,
    )
      .bind(employee, season, payload.status, progress, notes, id)
      .first<BrandRow>();

    if (!brand) {
      return Response.json({ error: "Brand not found." }, { status: 404 });
    }

    return Response.json({ brand: toBrand(brand) });
  } catch {
    return Response.json({ error: "Could not save this update." }, { status: 500 });
  }
}

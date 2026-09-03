import { env } from "cloudflare:workers";

const STATUSES = ["Starting", "In progress", "Done", "Uploaded"] as const;
const ASSET_STATUSES = ["Not requested", "Request sent", "Assets received", "Partly received"] as const;

type Status = (typeof STATUSES)[number];
type AssetStatus = (typeof ASSET_STATUSES)[number];

type BrandRow = {
  id: number;
  name: string;
  employee: string;
  season: string;
  asset_status: AssetStatus;
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

function toBrand(row: BrandRow) {
  return {
    id: row.id,
    name: row.name,
    employee: row.employee,
    season: row.season,
    assetStatus: row.asset_status,
    status: row.status,
    progress: row.progress,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const result = await env.DB.prepare(
      `SELECT id, name, employee, season, asset_status, status, progress, notes, created_at, updated_at
       FROM brands
       ORDER BY updated_at DESC, id DESC`,
    ).all<BrandRow>();

    return Response.json({ brands: result.results.map(toBrand) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const detail = message.includes("no such table")
      ? " The database will be ready when the tracker is first published."
      : "";
    return Response.json({ error: `Could not load brands.${detail}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      employee?: string;
      season?: string;
      assetStatus?: unknown;
      status?: unknown;
      progress?: unknown;
      notes?: string;
    };
    const name = payload.name?.trim() ?? "";
    const employee = payload.employee?.trim() ?? "";
    const season = payload.season?.trim() ?? "";
    const assetStatus = payload.assetStatus ?? "Not requested";
    const status = payload.status ?? "Starting";
    const progress = typeof payload.progress === "number" ? payload.progress : 0;
    const notes = payload.notes?.trim() ?? "";

    if (!name) {
      return Response.json({ error: "Brand name is required." }, { status: 400 });
    }
    if (name.length > 100) {
      return Response.json({ error: "Brand name must be 100 characters or less." }, { status: 400 });
    }
    if (!employee) {
      return Response.json({ error: "Employee name is required." }, { status: 400 });
    }
    if (!season) {
      return Response.json({ error: "Brand season is required." }, { status: 400 });
    }
    if (employee.length > 80 || season.length > 30) {
      return Response.json({ error: "Employee name or season is too long." }, { status: 400 });
    }
    if (!isAssetStatus(assetStatus) || !isStatus(status) || !Number.isInteger(progress) || progress < 0 || progress > 100 || notes.length > 500) {
      return Response.json({ error: "Invalid brand details." }, { status: 400 });
    }

    const brand = await env.DB.prepare(
      `INSERT INTO brands (name, employee, season, asset_status, status, progress, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id, name, employee, season, asset_status, status, progress, notes, created_at, updated_at`,
    )
      .bind(name, employee, season, assetStatus, status, progress, notes)
      .first<BrandRow>();

    if (!brand) {
      throw new Error("Brand was not created.");
    }

    return Response.json({ brand: toBrand(brand) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const duplicate = message.toLowerCase().includes("unique");
    return Response.json(
      { error: duplicate ? "This brand is already in the tracker." : "Could not add the brand." },
      { status: duplicate ? 409 : 500 },
    );
  }
}

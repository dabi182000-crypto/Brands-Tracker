"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Cloud, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const stages = ["Starting", "In progress", "Done", "Uploaded"] as const;

type Stage = (typeof stages)[number];

type Brand = {
  id: number;
  name: string;
  employee: string;
  season: string;
  status: Stage;
  progress: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const stageInfo: Record<Stage, { barClass: string }> = {
  Starting: {
    barClass: "[&_[data-slot=progress-indicator]]:bg-slate-500",
  },
  "In progress": {
    barClass: "[&_[data-slot=progress-indicator]]:bg-blue-600",
  },
  Done: {
    barClass: "[&_[data-slot=progress-indicator]]:bg-amber-500",
  },
  Uploaded: {
    barClass: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
  },
};

function formatUpdated(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function Home() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandName, setBrandName] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [season, setSeason] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  const summary = useMemo(
    () => ({
      uploaded: brands.filter((brand) => brand.status === "Uploaded").length,
      active: brands.filter((brand) => brand.status === "In progress").length,
    }),
    [brands],
  );

  useEffect(() => {
    let active = true;

    void fetch("/api/brands", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { brands?: Brand[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load brands.");
        return data.brands ?? [];
      })
      .then((loadedBrands) => {
        if (active) setBrands(loadedBrands);
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load brands.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function addBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!brandName.trim() || !employeeName.trim() || !season.trim()) {
      setMessage("Enter the brand name, employee name, and season first.");
      return;
    }

    setAdding(true);
    setMessage("");
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brandName,
          employee: employeeName,
          season,
          status: "Starting",
          progress: 0,
          notes: "",
        }),
      });
      const data = (await response.json()) as { brand?: Brand; error?: string };
      if (!response.ok || !data.brand) throw new Error(data.error ?? "Could not add the brand.");
      setBrands((current) => [data.brand!, ...current]);
      setBrandName("");
      setEmployeeName("");
      setSeason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add the brand.");
    } finally {
      setAdding(false);
    }
  }

  async function updateBrand(
    brand: Brand,
    changes: Partial<Pick<Brand, "status" | "employee" | "season" | "progress" | "notes">>,
  ) {
    setSavingId(brand.id);
    setMessage("");
    try {
      const response = await fetch(`/api/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: changes.status ?? brand.status,
          employee: changes.employee ?? brand.employee,
          season: changes.season ?? brand.season,
          progress: changes.progress ?? brand.progress,
          notes: changes.notes ?? brand.notes,
        }),
      });
      const data = (await response.json()) as { brand?: Brand; error?: string };
      if (!response.ok || !data.brand) throw new Error(data.error ?? "Could not save this update.");
      setBrands((current) => current.map((item) => (item.id === brand.id ? data.brand! : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this update.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dbe8ff_0,_transparent_32rem)] px-4 py-6 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 border-b border-border pb-6">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <Cloud className="size-4" aria-hidden="true" />
              Saved automatically
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Brand Upload Tracker</h1>
            <p className="mt-2 text-base text-muted-foreground">Track every brand upload in one simple view.</p>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Tracker summary">
          <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total brands</p>
            <p className="mt-1 text-2xl font-semibold">{brands.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">In progress</p>
            <p className="mt-1 text-2xl font-semibold text-blue-700 dark:text-blue-300">{summary.active}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Uploaded</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{summary.uploaded}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_45px_-35px_rgba(17,47,90,0.55)]">
          <form onSubmit={addBrand} className="grid gap-3 border-b border-border bg-secondary/55 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_12rem_8rem_auto] xl:items-end sm:p-5">
            <label className="grid gap-1.5 text-sm font-medium">
              Brand name
              <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="e.g. Brioni" maxLength={100} disabled={adding} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Employee name
              <Input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="e.g. Mahmoud" maxLength={80} disabled={adding} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Season
              <Input value={season} onChange={(event) => setSeason(event.target.value)} placeholder="e.g. AW26" maxLength={30} disabled={adding} />
            </label>
            <Button type="submit" className="w-full sm:w-auto" disabled={adding}>
              {adding ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              Add brand
            </Button>
          </form>

          {message && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-200">{message}</p>}

          <Table>
            <TableHeader className="bg-card">
              <TableRow className="hover:bg-card">
                <TableHead className="pl-5">Brand</TableHead>
                <TableHead>Season</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="min-w-44">Progress</TableHead>
                <TableHead className="min-w-52">Notes</TableHead>
                <TableHead className="pr-5">Last update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center text-muted-foreground"><LoaderCircle className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading tracker…</TableCell></TableRow>
              ) : brands.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-44 text-center"><CheckCircle2 className="mx-auto mb-2 size-6 text-primary" aria-hidden="true" /><p className="font-medium">No brands added yet</p><p className="mt-1 text-sm text-muted-foreground">Add the first brand above to start tracking.</p></TableCell></TableRow>
              ) : brands.map((brand) => {
                const stage = stageInfo[brand.status];
                const isSaving = savingId === brand.id;
                return (
                  <TableRow key={brand.id}>
                    <TableCell className="pl-5">
                      <p className="font-medium">{brand.name}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>by</span>
                        <Input
                          aria-label={`Employee for ${brand.name}`}
                          defaultValue={brand.employee}
                          className="h-6 min-w-24 border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
                          onBlur={(event) => {
                            const employee = event.target.value.trim();
                            if (employee && employee !== brand.employee) void updateBrand(brand, { employee });
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Season for ${brand.name}`}
                        defaultValue={brand.season}
                        className="h-8 w-20 text-sm"
                        onBlur={(event) => {
                          const updatedSeason = event.target.value.trim();
                          if (updatedSeason && updatedSeason !== brand.season) void updateBrand(brand, { season: updatedSeason });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={brand.status} onValueChange={(value) => void updateBrand(brand, { status: value as Stage })} disabled={isSaving}>
                        <SelectTrigger size="sm" className="min-w-34"><SelectValue /></SelectTrigger>
                        <SelectContent>{stages.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-44 items-center gap-2.5">
                        <Progress value={brand.progress} className={stage.barClass} aria-label={`${brand.name}: ${brand.progress}% complete`} />
                        <div className="flex items-center gap-0.5">
                          <Input
                            aria-label={`Progress percentage for ${brand.name}`}
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            defaultValue={brand.progress}
                            className="h-8 w-14 px-2 text-right text-sm font-semibold tabular-nums"
                            onBlur={(event) => {
                              const progress = Number(event.target.value);
                              if (Number.isInteger(progress) && progress >= 0 && progress <= 100 && progress !== brand.progress) {
                                void updateBrand(brand, { progress });
                              } else if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
                                event.target.value = String(brand.progress);
                              }
                            }}
                          />
                          <span className="text-sm font-semibold">%</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Textarea
                        aria-label={`Notes for ${brand.name}`}
                        defaultValue={brand.notes}
                        placeholder="Add a note…"
                        maxLength={500}
                        className="min-h-8 h-8 min-w-52 resize-none py-1.5 text-sm"
                        onBlur={(event) => {
                          const notes = event.target.value.trim();
                          if (notes !== brand.notes) void updateBrand(brand, { notes });
                        }}
                      />
                    </TableCell>
                    <TableCell className="pr-5 text-sm text-muted-foreground">{isSaving ? "Saving…" : formatUpdated(brand.updatedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
        <p className="mt-4 text-sm text-muted-foreground">Type any percentage from 0% to 100% beside the progress bar. Notes save when you click outside the field.</p>
      </div>
    </main>
  );
}

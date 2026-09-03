"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, MessageSquareText, Plus, Save, Search, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

const stages = ["Starting", "In progress", "Done", "Uploaded"] as const;
const assetStatuses = ["Not requested", "Request sent", "Assets received", "Partly received"] as const;

type Stage = (typeof stages)[number];
type AssetStatus = (typeof assetStatuses)[number];

type Brand = {
  id: number;
  name: string;
  employee: string;
  season: string;
  assetStatus: AssetStatus;
  status: Stage;
  progress: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type BrandDraft = Pick<Brand, "employee" | "season" | "assetStatus" | "status" | "progress" | "notes">;

function draftFromBrand(brand: Brand): BrandDraft {
  return {
    employee: brand.employee,
    season: brand.season,
    assetStatus: brand.assetStatus,
    status: brand.status,
    progress: brand.progress,
    notes: brand.notes,
  };
}

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

const stageProgress: Record<Stage, number> = {
  Starting: 0,
  "In progress": 50,
  Done: 75,
  Uploaded: 100,
};

const stageOrder: Record<Stage, number> = {
  Starting: 0,
  "In progress": 1,
  Done: 2,
  Uploaded: 3,
};

const assetStatusOrder: Record<AssetStatus, number> = {
  "Not requested": 0,
  "Request sent": 1,
  "Partly received": 2,
  "Assets received": 3,
};

type BrandSort =
  | "recent"
  | "stage-ascending"
  | "stage-descending"
  | "employee-ascending"
  | "employee-descending";

type StatusFilter = "all" | Stage;
type AssetSort = "none" | "ascending" | "descending";

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
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [brandSort, setBrandSort] = useState<BrandSort>("recent");
  const [assetSort, setAssetSort] = useState<AssetSort>("none");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [drafts, setDrafts] = useState<Record<number, BrandDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  const summary = useMemo(
    () => ({
      uploaded: brands.filter((brand) => brand.status === "Uploaded").length,
      active: brands.filter((brand) => brand.status === "In progress").length,
    }),
    [brands],
  );

  const visibleBrands = useMemo(() => {
    const query = appliedSearch.trim().toLocaleLowerCase();
    const searchedBrands = query
      ? brands.filter((brand) => brand.name.toLocaleLowerCase().includes(query))
      : brands;
    const filtered = statusFilter === "all"
      ? searchedBrands
      : searchedBrands.filter((brand) => brand.status === statusFilter);

    return [...filtered].sort((a, b) => {
      if (assetSort !== "none") {
        const assetDifference = assetStatusOrder[a.assetStatus] - assetStatusOrder[b.assetStatus];
        if (assetDifference !== 0) {
          return assetSort === "ascending" ? assetDifference : -assetDifference;
        }
      }

      if (brandSort === "recent") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }

      if (brandSort === "employee-ascending" || brandSort === "employee-descending") {
        const employeeDifference = a.employee.localeCompare(b.employee);
        if (employeeDifference !== 0) {
          return brandSort === "employee-ascending" ? employeeDifference : -employeeDifference;
        }
        return a.name.localeCompare(b.name);
      }

      const stageDifference = stageOrder[a.status] - stageOrder[b.status];
      if (stageDifference !== 0) {
        return brandSort === "stage-ascending" ? stageDifference : -stageDifference;
      }

      return a.name.localeCompare(b.name);
    });
  }, [appliedSearch, assetSort, brandSort, brands, statusFilter]);

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
          assetStatus: "Not requested",
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

  function getDraft(brand: Brand) {
    return drafts[brand.id] ?? draftFromBrand(brand);
  }

  function setBrandDraft(brand: Brand, changes: Partial<BrandDraft>) {
    setDrafts((current) => ({
      ...current,
      [brand.id]: { ...current[brand.id] ?? draftFromBrand(brand), ...changes },
    }));
  }

  async function saveBrand(brand: Brand) {
    const draft = getDraft(brand);
    const employee = draft.employee.trim();
    const updatedSeason = draft.season.trim();
    const notes = draft.notes.trim();

    if (!employee || !updatedSeason || !Number.isInteger(draft.progress) || draft.progress < 0 || draft.progress > 100) {
      setMessage("Enter an employee, season, and a progress value from 0% to 100% before saving.");
      return;
    }

    setSavingId(brand.id);
    setMessage("");
    try {
      const response = await fetch(`/api/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          employee,
          season: updatedSeason,
          assetStatus: draft.assetStatus,
          progress: draft.progress,
          notes,
        }),
      });
      const data = (await response.json()) as { brand?: Brand; error?: string };
      if (!response.ok || !data.brand) throw new Error(data.error ?? "Could not save this update.");
      setBrands((current) => current.map((item) => (item.id === brand.id ? data.brand! : item)));
      setDrafts((current) => {
        const next = { ...current };
        delete next[brand.id];
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this update.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeBrand(brand: Brand) {
    setRemovingId(brand.id);
    setMessage("");
    try {
      const response = await fetch(`/api/brands/${brand.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not remove this brand.");
      setBrands((current) => current.filter((item) => item.id !== brand.id));
      setDrafts((current) => {
        const next = { ...current };
        delete next[brand.id];
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove this brand.");
    } finally {
      setRemovingId(null);
    }
  }

  function exportBrands() {
    if (brands.length === 0) {
      setMessage("Add at least one brand before exporting.");
      return;
    }

    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Brand", "Employee", "Season", "Asset status", "Stage", "Progress", "Notes", "Last update"],
      ...brands.map((brand) => [
        brand.name,
        brand.employee,
        brand.season,
        brand.assetStatus,
        brand.status,
        `${brand.progress}%`,
        brand.notes,
        formatUpdated(brand.updatedAt),
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `brand-upload-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dbe8ff_0,_transparent_32rem)] px-4 py-6 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 border-b border-border pb-6">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <Save className="size-4" aria-hidden="true" />
              Save changes manually
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

          <div className="grid gap-4 border-b border-border bg-card p-4 sm:p-5 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(34rem,1.1fr)] xl:items-end">
            <form
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                setAppliedSearch(searchDraft);
              }}
            >
              <label className="grid flex-1 gap-1.5 text-sm font-medium">
                Search brands
                <Input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search by brand name"
                  maxLength={100}
                />
              </label>
              <Button type="submit" className="w-full sm:w-auto">
                <Search aria-hidden="true" />
                Search
              </Button>
            </form>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Show status
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {stages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Sort brands
                <Select value={brandSort} onValueChange={(value) => setBrandSort(value as BrandSort)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Latest update</SelectItem>
                    <SelectItem value="stage-ascending">Starting to Uploaded</SelectItem>
                    <SelectItem value="stage-descending">Uploaded to Starting</SelectItem>
                    <SelectItem value="employee-ascending">Employee: A to Z</SelectItem>
                    <SelectItem value="employee-descending">Employee: Z to A</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Sort assets
                <Select value={assetSort} onValueChange={(value) => setAssetSort(value as AssetSort)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No asset sorting</SelectItem>
                    <SelectItem value="ascending">Not requested to received</SelectItem>
                    <SelectItem value="descending">Received to not requested</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <Button type="button" variant="outline" className="h-10 w-full self-end" onClick={exportBrands} disabled={loading || brands.length === 0}>
                <Download aria-hidden="true" />
                Export CSV
              </Button>
            </div>
          </div>

          {message && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-200">{message}</p>}

          <Table>
            <TableHeader className="bg-card">
              <TableRow className="hover:bg-card">
                <TableHead className="h-9 min-w-32 px-2 pl-4 text-xs">Brand</TableHead>
                <TableHead className="h-9 px-2 text-xs">Season</TableHead>
                <TableHead className="h-9 min-w-32 px-2 text-xs">Assets</TableHead>
                <TableHead className="h-9 min-w-28 px-2 text-xs">Stage</TableHead>
                <TableHead className="h-9 min-w-36 px-2 text-xs">Progress</TableHead>
                <TableHead className="h-9 min-w-44 px-2 text-xs">Notes</TableHead>
                <TableHead className="h-9 min-w-22 px-2 text-xs">Last update</TableHead>
                <TableHead className="h-9 px-2 text-right text-xs">Save</TableHead>
                <TableHead className="h-9 px-2 pr-4 text-right text-xs">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="h-36 text-center text-sm text-muted-foreground"><LoaderCircle className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading tracker…</TableCell></TableRow>
              ) : visibleBrands.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-40 text-center"><CheckCircle2 className="mx-auto mb-2 size-6 text-primary" aria-hidden="true" /><p className="text-sm font-medium">{brands.length === 0 ? "No brands added yet" : "No matching brands"}</p><p className="mt-1 text-xs text-muted-foreground">{brands.length === 0 ? "Add the first brand above to start tracking." : "Try another brand name."}</p></TableCell></TableRow>
              ) : visibleBrands.map((brand) => {
                const draft = getDraft(brand);
                const stage = stageInfo[draft.status];
                const isSaving = savingId === brand.id;
                const isRemoving = removingId === brand.id;
                return (
                  <TableRow key={brand.id}>
                    <TableCell className="min-w-32 px-2 py-2 pl-4">
                      <p className="text-sm font-semibold">{brand.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>by</span>
                        <Input
                          aria-label={`Employee for ${brand.name}`}
                          value={draft.employee}
                          disabled={isSaving || isRemoving}
                          className="h-5 min-w-20 border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
                          onChange={(event) => setBrandDraft(brand, { employee: event.target.value })}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <Input
                        aria-label={`Season for ${brand.name}`}
                        value={draft.season}
                        disabled={isSaving || isRemoving}
                        className="h-7 w-18 text-xs"
                        onChange={(event) => setBrandDraft(brand, { season: event.target.value })}
                      />
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <Select value={draft.assetStatus} onValueChange={(value) => setBrandDraft(brand, { assetStatus: value as AssetStatus })} disabled={isSaving || isRemoving}>
                        <SelectTrigger size="sm" className="h-7 min-w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{assetStatuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <Select
                        value={draft.status}
                        onValueChange={(value) => {
                          const status = value as Stage;
                          setBrandDraft(brand, { status, progress: stageProgress[status] });
                        }}
                        disabled={isSaving || isRemoving}
                      >
                        <SelectTrigger size="sm" className="h-7 min-w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{stages.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex min-w-36 items-center gap-2">
                        <Progress value={draft.progress} className={stage.barClass} aria-label={`${brand.name}: ${draft.progress}% complete`} />
                        <div className="flex items-center gap-0.5">
                          <Input
                            aria-label={`Progress percentage for ${brand.name}`}
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={draft.progress}
                            disabled={isSaving || isRemoving}
                            className="h-7 w-12 px-1.5 text-right text-xs font-semibold tabular-nums"
                            onChange={(event) => setBrandDraft(brand, { progress: Number(event.target.value) })}
                          />
                          <span className="text-xs font-semibold">%</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex min-w-44 items-center gap-1.5">
                        <Textarea
                          aria-label={`Notes for ${brand.name}`}
                          value={draft.notes}
                          placeholder="Add a note…"
                          maxLength={500}
                          disabled={isSaving || isRemoving}
                          className="h-7 min-h-7 min-w-36 w-36 resize-none py-1 text-xs"
                          onChange={(event) => setBrandDraft(brand, { notes: event.target.value })}
                        />
                        <HoverCard openDelay={100} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <button type="button" aria-label={`Preview notes for ${brand.name}`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <MessageSquareText className="size-3.5" aria-hidden="true" />
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent side="top" align="start" className="w-72 rounded-xl border-border bg-card p-3">
                            <p className="text-xs font-semibold text-foreground">Notes for {brand.name}</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{draft.notes || "No notes added yet."}</p>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{formatUpdated(brand.updatedAt)}</TableCell>
                    <TableCell className="px-2 py-2 text-right">
                      <Button type="button" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => void saveBrand(brand)} disabled={isSaving || isRemoving}>
                        {isSaving ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Save className="size-3.5" aria-hidden="true" />}
                        {isSaving ? "Saving…" : "Save"}
                      </Button>
                    </TableCell>
                    <TableCell className="px-2 py-2 pr-4 text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isSaving || isRemoving}>
                            {isRemoving ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {brand.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove this brand from the tracker.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => void removeBrand(brand)}>Remove brand</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
        <p className="mt-4 text-sm text-muted-foreground">Use Save after changing a brand. You can still export the full tracker as a CSV file.</p>
      </div>
    </main>
  );
}

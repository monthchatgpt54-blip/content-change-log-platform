"use client";

import * as React from "react";
import {
  Activity,
  ArchiveRestore,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Download,
  FileDiff,
  FilePlus2,
  Globe2,
  LayoutDashboard,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type View = "overview" | "audit" | "changes" | "review" | "sites" | "batches" | "settings";

type Site = {
  id: string;
  name: string;
  url: string;
  niche: string;
  targetMarket: string;
  languageStandard: string;
  publishingMode: string;
  wordpressStatus: string | null;
};

type Audit = {
  id: string;
  reference: string;
  title: string;
  siteId: string;
  status: string;
  score: number;
  summary: string;
  provider: string;
  createdAt: string;
};

type ChangeEntry = {
  id: string;
  auditId: string;
  contentItemId: string;
  siteId: string;
  reference: string;
  exactLocation: string;
  contentKind: string;
  category: string;
  issue: string;
  action: string;
  priority: string;
  beforeText: string;
  afterText: string;
  reason: string;
  evidence: string | null;
  confidence: number;
  status: string;
  reviewerComment: string | null;
  title: string;
  createdAt: string;
};

type Batch = {
  id: string;
  name: string;
  status: string;
  totalItems: number;
  processedItems: number;
  approvedItems: number;
  failedItems: number;
};

type Workspace = {
  sites: Site[];
  audits: Audit[];
  changes: ChangeEntry[];
  batches: Batch[];
  activities: Array<{ id: string; action: string; detail: string; createdAt: string }>;
  metrics: { content: number; needsReview: number; verified: number; activeBatches: number };
  capabilities: { openAI: boolean; wordpress: boolean; permanentDelete: boolean };
};

const emptyWorkspace: Workspace = {
  sites: [],
  audits: [],
  changes: [],
  batches: [],
  activities: [],
  metrics: { content: 0, needsReview: 0, verified: 0, activeBatches: 0 },
  capabilities: { openAI: false, wordpress: false, permanentDelete: false },
};

const navBase = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
  { id: "audit" as const, label: "New audit", icon: FilePlus2 },
  { id: "changes" as const, label: "Change logs", icon: FileDiff },
  { id: "review" as const, label: "Review queue", icon: ClipboardCheck },
  { id: "sites" as const, label: "Sites", icon: Globe2 },
  { id: "batches" as const, label: "Batch jobs", icon: Workflow },
];

const statusTone: Record<string, string> = {
  needs_review: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  applied: "border-sky-200 bg-sky-50 text-sky-800",
  verified: "border-green-200 bg-green-50 text-green-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
  restored: "border-slate-200 bg-slate-50 text-slate-700",
  queued: "border-slate-200 bg-slate-50 text-slate-700",
  processing: "border-sky-200 bg-sky-50 text-sky-800",
};

function prettyStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day ago`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: React.ElementType }) {
  return (
    <Card className="border-0 shadow-[0_1px_0_rgba(16,39,29,.08),0_16px_40px_rgba(16,39,29,.05)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Icon className="size-5" /></span>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function Overview({ data, onNavigate, refresh }: { data: Workspace; onNavigate: (view: View) => void; refresh: () => void }) {
  const latest = data.audits[0];
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Content records" value={String(data.metrics.content)} note={`Across ${data.sites.length} website profile${data.sites.length === 1 ? "" : "s"}`} icon={BookOpenCheck} />
        <Metric label="Needs review" value={String(data.metrics.needsReview)} note="Approval is required before publishing" icon={CircleAlert} />
        <Metric label="Approved or verified" value={String(data.metrics.verified)} note="Every decision remains traceable" icon={ShieldCheck} />
        <Metric label="Active batches" value={String(data.metrics.activeBatches)} note="Up to 40 items per controlled batch" icon={Activity} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
        <Card className="overflow-hidden border-0 shadow-[0_16px_45px_rgba(16,39,29,.06)]">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Latest review</p>
              <CardTitle className="mt-2 text-xl">{latest?.title ?? "Create your first content audit"}</CardTitle>
            </div>
            <Badge variant="outline" className={statusTone[latest?.status ?? "queued"]}>{latest ? prettyStatus(latest.status) : "Not started"}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {latest ? (
              <>
                <div className="grid border-b sm:grid-cols-3">
                  {[
                    ["Change log", latest.reference],
                    ["Review engine", latest.provider === "openai" ? "OpenAI + rules" : "Deterministic rules"],
                    ["Created", timeAgo(latest.createdAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b p-5 last:border-0 sm:border-r sm:border-b-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="mt-2 text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="p-5">
                  <p className="text-sm leading-6 text-muted-foreground">{latest.summary}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={() => onNavigate("review")} className="gap-2">Review changes <ChevronRight className="size-4" /></Button>
                    <Button variant="outline" onClick={() => onNavigate("changes")}>Open register</Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8">
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">Paste existing or new content. The platform preserves the original, runs quality checks, and creates a detailed master change log.</p>
                <Button onClick={() => onNavigate("audit")} className="mt-5 gap-2"><Sparkles className="size-4" /> Start first audit</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-primary text-primary-foreground shadow-[0_16px_45px_rgba(16,39,29,.16)]">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#c5d4ca]">Publishing control</p>
            <CardTitle className="text-xl">Manual approval is on</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-[#d8e3dc]">No draft can be published until every proposed change has a reviewer decision and an approved revision exists.</p>
            <div className="space-y-3 rounded-xl border border-white/15 bg-white/5 p-4 text-sm">
              <div className="flex items-center justify-between gap-3"><span>WordPress access</span><Badge className="bg-white/10 text-white">{data.capabilities.wordpress ? "Connected" : "Not connected"}</Badge></div>
              <div className="flex items-center justify-between gap-3"><span>OpenAI analysis</span><Badge className="bg-white/10 text-white">{data.capabilities.openAI ? "Configured" : "Rules fallback"}</Badge></div>
              <div className="flex items-center justify-between gap-3"><span>Permanent delete</span><span className="font-semibold text-[#dff56a]">Blocked</span></div>
            </div>
            <Button onClick={() => onNavigate("sites")} className="w-full bg-accent text-accent-foreground hover:bg-[#d2ec50]">Configure connections</Button>
          </CardContent>
        </Card>
      </section>

      <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Recent activity</p><CardTitle className="mt-2 text-xl">Editorial operations</CardTitle></div>
          <Button variant="ghost" size="sm" className="gap-2" onClick={refresh}><RefreshCw className="size-4" /> Refresh</Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.activities.length ? data.activities.map((item) => (
            <div key={item.id} className="flex items-center gap-4 rounded-xl border bg-white p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary"><CheckCircle2 className="size-4" /></span>
              <div className="min-w-0 flex-1"><p className="font-semibold">{prettyStatus(item.action)}</p><p className="truncate text-sm text-muted-foreground">{item.detail}</p></div>
              <time className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</time>
            </div>
          )) : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Activity will appear after your first audit or review decision.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function NewAudit({ sites, onComplete }: { sites: Site[]; onComplete: () => void }) {
  const [siteId, setSiteId] = React.useState(sites[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [contentType, setContentType] = React.useState("service");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [content, setContent] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const effectiveSiteId = siteId || sites[0]?.id || "";

  async function runAudit() {
    if (!title.trim()) return toast.error("Add a clear content title.");
    if (content.trim().length < 20) return toast.error("Add the content you want to review.");
    setRunning(true);
    try {
      const selected = sites.find((site) => site.id === effectiveSiteId) ?? sites[0];
      const result = await api<{ audit: { reference: string; findings: number; provider: string } }>("/api/audits", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title, siteId: selected?.id, content, contentType, sourceUrl, primaryKeyword: keyword,
          targetMarket: selected?.targetMarket ?? "United States",
          languageStandard: selected?.languageStandard ?? "American English",
        }),
      });
      toast.success(`${result.audit.reference} created with ${result.audit.findings} change entries.`);
      onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audit failed.");
    } finally {
      setRunning(false);
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    try {
      const result = await api<{ content: string }>("/api/uploads", { method: "POST", body: form });
      setContent(result.content);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, "").replaceAll(/[-_]/g, " "));
      toast.success("File loaded. Review the text before running the audit.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.06)]">
        <CardHeader className="border-b"><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Create a review</p><CardTitle className="text-2xl">Audit existing or new content</CardTitle></CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2"><Label>Website</Label><Select value={effectiveSiteId} onValueChange={setSiteId}><SelectTrigger className="w-full"><SelectValue placeholder="Choose a site" /></SelectTrigger><SelectContent>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Content type</Label><Select value={contentType} onValueChange={setContentType}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="service">Service page</SelectItem><SelectItem value="blog">Blog article</SelectItem><SelectItem value="category">Category page</SelectItem><SelectItem value="product">Product page</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="audit-title">Content title</Label><Input id="audit-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Local SEO Service Page Refresh" /></div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="keyword">Primary keyword</Label><Input id="keyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="e.g. local SEO services" /></div>
            <div className="space-y-2"><Label htmlFor="url">Current page URL</Label><Input id="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} type="url" placeholder="https://example.com/page/" /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label htmlFor="content">Content</Label><span className="text-xs text-muted-foreground">{content.trim() ? content.trim().split(/\s+/).length : 0} words</span></div>
            <Textarea id="content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste the full content here. The original will be preserved as Version 0." className="min-h-80 resize-y bg-white text-base leading-7" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runAudit} disabled={running} className="gap-2">{running ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{running ? "Creating audit…" : "Run master audit"}</Button>
            <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.html,.htm,.csv,.json" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
            <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Upload text file</Button>
            <span className="text-sm text-muted-foreground">Original text is never overwritten.</span>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)]">
          <CardHeader><CardTitle className="text-lg">Master review coverage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {["Exact before/after text", "American English and voice", "Claims and trust", "Duplicate and repetition", "Keyword and structure", "Manual approval gate"].map((label) => (
              <div key={label} className="flex items-center gap-3 text-sm"><Check className="size-4 text-[#6f9620]" /><span>{label}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-0 bg-[#ecf7d2] shadow-none"><CardContent className="p-5"><ShieldCheck className="size-6 text-primary" /><p className="mt-4 font-semibold">Evidence-first workflow</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Unsupported facts are not invented. Semantic AI review activates when a server key is configured; deterministic safety checks always run.</p></CardContent></Card>
      </div>
    </div>
  );
}

function ChangeLog({ data, reviewMode = false, refresh }: { data: Workspace; reviewMode?: boolean; refresh: () => void }) {
  const rows = reviewMode ? data.changes.filter((change) => change.status === "needs_review") : data.changes;
  const [selectedId, setSelectedId] = React.useState(rows[0]?.id ?? "");
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0];

  async function changeAction(action: "approve" | "reject" | "recheck" | "restore" | "verify") {
    if (!selected) return;
    if (action === "recheck" && !comment.trim()) return toast.error("Add a precise recheck instruction first.");
    setBusy(true);
    try {
      const result = await api<{ rechecked?: boolean }>("/api/changes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changeId: selected.id, action, comment }) });
      toast.success(action === "recheck" ? (result.rechecked ? `${selected.reference} rechecked. Review the updated proposal.` : "Recheck instruction saved. Configure OpenAI to regenerate the proposal.") : `${selected.reference} marked ${action}.`);
      setComment("");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    } finally { setBusy(false); }
  }

  async function createRevision(action: "apply_approved" | "restore_original") {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api<{ revision: { revisionNumber: number; applied: number } }>("/api/revisions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentItemId: selected.contentItemId, action }) });
      toast.success(`Revision ${result.revision.revisionNumber} created.`);
      refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Revision failed."); }
    finally { setBusy(false); }
  }

  async function sendToWordPress(status: "draft" | "publish") {
    if (!selected) return;
    setBusy(true);
    try {
      await api("/api/wordpress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "publish", siteId: selected.siteId, contentItemId: selected.contentItemId, status }) });
      toast.success(status === "publish" ? "Content published to WordPress." : "WordPress draft created.");
      refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "WordPress action failed."); }
    finally { setBusy(false); }
  }

  if (!rows.length) {
    return <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)]"><CardContent className="grid min-h-80 place-items-center p-8 text-center"><div><ClipboardCheck className="mx-auto size-10 text-muted-foreground" /><p className="mt-4 font-semibold">{reviewMode ? "The review queue is clear" : "No change entries yet"}</p><p className="mt-2 text-sm text-muted-foreground">{reviewMode ? "New audit findings will appear here." : "Run a content audit to build the master register."}</p></div></CardContent></Card>;
  }

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_27rem]">
      <Card className="min-w-0 border-0 shadow-[0_16px_45px_rgba(16,39,29,.06)]">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">{reviewMode ? "Decision queue" : "All recorded changes"}</p><CardTitle className="mt-2 text-xl">Master change register</CardTitle></div>
          <Button variant="outline" size="sm" className="gap-2" asChild><a href="/api/changes/export"><Download className="size-4" /> Export CSV</a></Button>
        </CardHeader>
        <CardContent className="p-0"><div className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Content / exact location</TableHead><TableHead>Issue</TableHead><TableHead>Action</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((change) => (
            <TableRow key={change.id} className="cursor-pointer" data-state={selected?.id === change.id ? "selected" : undefined} onClick={() => setSelectedId(change.id)}>
              <TableCell className="font-mono text-xs font-semibold">{change.reference}</TableCell>
              <TableCell className="min-w-60"><p className="font-medium">{change.title}</p><p className="mt-1 text-xs text-muted-foreground">{change.exactLocation}</p></TableCell>
              <TableCell className="min-w-48">{change.issue}</TableCell><TableCell><Badge variant="outline">{change.action}</Badge></TableCell><TableCell>{change.priority}</TableCell>
              <TableCell><Badge variant="outline" className={statusTone[change.status]}>{prettyStatus(change.status)}</Badge></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></div></CardContent>
      </Card>

      {selected && <Card className="h-fit border-0 shadow-[0_16px_45px_rgba(16,39,29,.07)]">
        <CardHeader className="border-b"><div className="flex items-center justify-between gap-2"><Badge variant="outline">{selected.reference}</Badge><Badge variant="outline" className={statusTone[selected.status]}>{prettyStatus(selected.status)}</Badge></div><CardTitle className="pt-2 text-lg">{selected.exactLocation}</CardTitle><p className="text-sm text-muted-foreground">{prettyStatus(selected.contentKind)} · {selected.category} · {selected.confidence}% confidence</p></CardHeader>
        <CardContent className="space-y-5 p-5">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Before</p><p className="diff-before rounded-r-lg p-4 text-sm leading-6">{selected.beforeText}</p></div>
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">After</p><p className="diff-after rounded-r-lg p-4 text-sm leading-6">{selected.afterText}</p></div>
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editorial and SEO reason</p><p className="text-sm leading-6 text-muted-foreground">{selected.reason}</p></div>
          {selected.evidence && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidence</p><p className="text-sm leading-6 text-muted-foreground">{selected.evidence}</p></div>}
          {reviewMode && <>
            <Separator />
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a precise recheck instruction or reviewer note…" className="min-h-24" />
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={busy} onClick={() => changeAction("approve")} className="gap-2"><Check className="size-4" /> Approve</Button>
              <Button disabled={busy} variant="outline" onClick={() => changeAction("recheck")} className="gap-2"><RefreshCw className="size-4" /> Recheck</Button>
              <Button disabled={busy} variant="outline" onClick={() => changeAction("restore")} className="gap-2"><ArchiveRestore className="size-4" /> Restore</Button>
              <Button disabled={busy} variant="outline" onClick={() => changeAction("reject")} className="gap-2 text-destructive"><X className="size-4" /> Reject</Button>
            </div>
          </>}
          {!reviewMode && <>
            <Separator />
            <div className="grid gap-2">
              <Button disabled={busy} onClick={() => createRevision("apply_approved")}>Create revision from approved edits</Button>
              <div className="grid grid-cols-2 gap-2"><Button disabled={busy} variant="outline" onClick={() => sendToWordPress("draft")}>WordPress draft</Button><Button disabled={busy} variant="outline" onClick={() => sendToWordPress("publish")}>Publish</Button></div>
              <Button disabled={busy} variant="ghost" onClick={() => createRevision("restore_original")}>Restore protected original</Button>
            </div>
          </>}
        </CardContent>
      </Card>}
    </div>
  );
}

function SitesView({ data, refresh, processBatch }: { data: Workspace; refresh: () => void; processBatch: (id: string) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [niche, setNiche] = React.useState("");
  const [selectedSite, setSelectedSite] = React.useState(data.sites[0]?.id ?? "");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const effectiveSelectedSite = selectedSite || data.sites[0]?.id || "";

  async function addSite() {
    if (!name || !url || !niche) return toast.error("Complete the site name, URL, and niche.");
    setBusy(true);
    try {
      const result = await api<{ site: Site }>("/api/sites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, url, niche, targetMarket: "United States", languageStandard: "American English", publishingMode: "manual_approval" }) });
      setSelectedSite(result.site.id); setName(""); setUrl(""); setNiche(""); refresh(); toast.success("Website profile added.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Site could not be added."); }
    finally { setBusy(false); }
  }

  async function connectWordPress() {
    if (!effectiveSelectedSite || !username || !password) return toast.error("Choose a site and add the restricted WordPress credentials.");
    setBusy(true);
    try {
      await api("/api/wordpress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "connect", siteId: effectiveSelectedSite, username, applicationPassword: password }) });
      setPassword(""); refresh(); toast.success("WordPress connection verified and encrypted.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "WordPress connection failed."); }
    finally { setBusy(false); }
  }

  async function importWordPress() {
    setBusy(true);
    try {
      const result = await api<{ batchId: string; imported: number }>("/api/wordpress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "import", siteId: effectiveSelectedSite, postType: "posts", limit: 40 }) });
      toast.success(`${result.imported} WordPress items queued. The live site was not changed.`);
      await processBatch(result.batchId);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Import failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.06)]">
          <CardHeader className="border-b"><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Site profiles</p><CardTitle className="mt-2 text-xl">Connected websites</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-5">
            {data.sites.map((site) => <div key={site.id} className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-4"><span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Globe2 className="size-5" /></span><div><p className="font-semibold">{site.name}</p><a className="mt-1 block text-sm text-muted-foreground hover:underline" href={site.url} target="_blank" rel="noreferrer">{site.url}</a><p className="mt-1 text-xs text-muted-foreground">{site.niche} · {site.targetMarket} · {site.languageStandard}</p></div></div><Badge variant="outline" className={site.wordpressStatus === "connected" ? statusTone.approved : statusTone.needs_review}>{site.wordpressStatus === "connected" ? "WordPress connected" : "WordPress not connected"}</Badge></div>
              <Separator className="my-5" /><div className="grid gap-4 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">Publishing mode</p><p className="mt-1 font-semibold">{prettyStatus(site.publishingMode)}</p></div><div><p className="text-muted-foreground">Isolation</p><p className="mt-1 font-semibold">Separate site profile</p></div><div><p className="text-muted-foreground">Permanent delete</p><p className="mt-1 font-semibold">Blocked</p></div></div>
            </div>)}
          </CardContent>
        </Card>
        <Card className="h-fit border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)]">
          <CardHeader><CardTitle className="text-lg">Add website profile</CardTitle></CardHeader>
          <CardContent className="space-y-4"><div className="space-y-2"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Legal" /></div><div className="space-y-2"><Label>HTTPS URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" /></div><div className="space-y-2"><Label>Niche</Label><Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Legal services" /></div><Button disabled={busy} onClick={addSite} className="w-full">Add site</Button></CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)]">
        <CardHeader><CardTitle className="text-lg">Secure WordPress connection</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={effectiveSelectedSite} onValueChange={setSelectedSite}><SelectTrigger className="w-full"><SelectValue placeholder="Choose site" /></SelectTrigger><SelectContent>{data.sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent></Select>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Restricted username" />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Application password" />
          <Button disabled={busy} onClick={connectWordPress}>Test & encrypt</Button>
          <div className="lg:col-span-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-muted-foreground">Use a dedicated Editor account and an application password. Theme, plugin, user, deletion, price, and stock operations are not implemented.</p><Button variant="outline" disabled={busy || !data.sites.find((site) => site.id === effectiveSelectedSite)?.wordpressStatus} onClick={importWordPress}>Import latest 40 posts</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}

function BatchesView({ data, processBatch, refresh }: { data: Workspace; processBatch: (id: string) => Promise<void>; refresh: () => void }) {
  const [siteId, setSiteId] = React.useState(data.sites[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [content, setContent] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const effectiveSiteId = siteId || data.sites[0]?.id || "";

  async function createBatch() {
    const blocks = content.split(/\n-{3,}\n/).map((value) => value.trim()).filter(Boolean);
    if (!name.trim() || !blocks.length) return toast.error("Add a batch name and at least one content block.");
    if (blocks.length > 40) return toast.error("A batch can contain up to 40 items.");
    const items = blocks.map((block, index) => {
      const lines = block.split("\n");
      const first = lines[0]?.replace(/^#\s*/, "").trim();
      const hasTitle = lines.length > 1 && first.length < 180;
      return { title: hasTitle ? first : `Content item ${index + 1}`, content: hasTitle ? lines.slice(1).join("\n").trim() : block, contentType: "page" };
    });
    if (items.some((item) => item.content.length < 20)) return toast.error("Every item needs a title line and at least 20 characters of content.");
    setBusy(true);
    try {
      const result = await api<{ batch: { id: string } }>("/api/batches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId: effectiveSiteId, name, publishingMode: "manual_approval", items }) });
      toast.success(`${items.length} items queued. Processing has started.`);
      await processBatch(result.batch.id);
      setContent(""); setName(""); refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Batch failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
      <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.06)]">
        <CardHeader className="flex flex-row items-center justify-between border-b"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Controlled background work</p><CardTitle className="mt-2 text-xl">Content batches</CardTitle></div></CardHeader>
        <CardContent className="space-y-4 p-5">
          {data.batches.length ? data.batches.map((batch) => {
            const progress = batch.totalItems ? Math.round((batch.processedItems / batch.totalItems) * 100) : 0;
            return <div key={batch.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{batch.name}</p><p className="mt-1 text-sm text-muted-foreground">{batch.processedItems} of {batch.totalItems} prepared · {batch.failedItems} failed</p></div><Badge variant="outline" className={statusTone[batch.status]}>{prettyStatus(batch.status)}</Badge></div><Progress value={progress} className="mt-4 h-2" /><div className="mt-4 flex gap-2">{batch.processedItems < batch.totalItems && <Button size="sm" variant="outline" onClick={() => processBatch(batch.id)}>Resume processing</Button>}<Button size="sm" variant="ghost" onClick={refresh}>Refresh</Button></div></div>;
          }) : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No batches yet. Create a controlled 1–40 item job from the form.</p>}
        </CardContent>
      </Card>
      <Card className="h-fit border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)]">
        <CardHeader><CardTitle className="text-lg">New batch</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={effectiveSiteId} onValueChange={setSiteId}><SelectTrigger className="w-full"><SelectValue placeholder="Choose site" /></SelectTrigger><SelectContent>{data.sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent></Select>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Batch name" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-72" placeholder={"# First page title\nFull content…\n\n---\n\n# Second page title\nFull content…"} />
          <p className="text-xs leading-5 text-muted-foreground">Separate items with a line containing <strong>---</strong>. Each first line becomes the item title. Maximum 40.</p>
          <Button disabled={busy} onClick={createBatch} className="w-full gap-2">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />} Create & process batch</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsView({ data }: { data: Workspace }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)]"><CardHeader><CardTitle>Analysis provider</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-semibold">OpenAI Responses API</p><p className="text-sm text-muted-foreground">Server-side only, with deterministic fallback</p></div><Badge variant="outline" className={data.capabilities.openAI ? statusTone.approved : statusTone.needs_review}>{data.capabilities.openAI ? "Configured" : "Awaiting key"}</Badge></div><p className="text-sm leading-6 text-muted-foreground">The API key is a deployment secret. It is never sent to the browser or committed to GitHub. Any authorized ChatGPT user of the private app gets an isolated owner workspace.</p></CardContent></Card>
      <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)]"><CardHeader><CardTitle>Safety defaults</CardTitle></CardHeader><CardContent className="space-y-4">{[["Manual approval before publish", true], ["Preserve immutable Version 0", true], ["Block unreviewed publishing", true], ["Allow permanent deletion", false]].map(([label, checked]) => <div key={String(label)} className="flex items-center justify-between gap-4"><Label className="font-normal">{String(label)}</Label><Switch checked={Boolean(checked)} disabled /></div>)}</CardContent></Card>
      <Card className="border-0 shadow-[0_16px_45px_rgba(16,39,29,.05)] lg:col-span-2"><CardHeader><CardTitle>Master change-log fields</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{["Unique reference", "Content and exact location", "Issue and category", "Action type", "Priority", "Before and after", "Editorial/SEO reason", "Evidence", "Confidence", "Reviewer decision", "Reviewer instruction", "Revision and activity trail"].map((item) => <div key={item} className="flex items-center gap-2 rounded-lg bg-secondary/70 p-3"><Check className="size-4 text-[#6f9620]" /> {item}</div>)}</CardContent></Card>
    </div>
  );
}

export function DashboardClient({ userName }: { userName: string }) {
  const [view, setView] = React.useState<View>("overview");
  const [data, setData] = React.useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      setData(await api<Workspace>("/api/bootstrap"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace could not be loaded.");
    } finally { setLoading(false); }
  }, []);
  React.useEffect(() => {
    let active = true;
    api<Workspace>("/api/bootstrap")
      .then((workspace) => { if (active) setData(workspace); })
      .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Workspace could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const processBatch = React.useCallback(async (batchId: string) => {
    for (let index = 0; index < 40; index += 1) {
      const result = await api<{ done: boolean; processed?: number; total?: number }>("/api/batches/process", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ batchId }) });
      if (result.processed && (result.processed % 5 === 0 || result.done)) toast.info(`Batch progress: ${result.processed} of ${result.total}`);
      if (result.done) { toast.success("Batch preparation complete. Manual review is ready."); break; }
    }
    await refresh();
  }, [refresh]);

  const navItems = navBase.map((item) => ({
    ...item,
    count: item.id === "changes" ? data.changes.length : item.id === "review" ? data.metrics.needsReview : item.id === "sites" ? data.sites.length : item.id === "batches" ? data.metrics.activeBatches : undefined,
  }));
  const activeLabel = [...navItems, { id: "settings" as const, label: "Settings", icon: Settings }].find((item) => item.id === view)?.label ?? "Overview";

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="p-4"><div className="flex items-center gap-3 overflow-hidden"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><FileDiff className="size-5" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">Change Log</p><p className="truncate text-xs text-sidebar-foreground/60">Editorial operations</p></div></div></SidebarHeader>
        <SidebarContent><SidebarGroup><SidebarGroupLabel>Workspace</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{navItems.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton tooltip={item.label} isActive={view === item.id} onClick={() => setView(item.id)}><item.icon /><span>{item.label}</span></SidebarMenuButton>{item.count ? <SidebarMenuBadge>{item.count}</SidebarMenuBadge> : null}</SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
        <SidebarFooter className="p-3"><SidebarMenu><SidebarMenuItem><SidebarMenuButton tooltip="Settings" isActive={view === "settings"} onClick={() => setView("settings")}><Settings /><span>Settings</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu><div className="mt-2 overflow-hidden rounded-xl border border-sidebar-border bg-white/5 p-3"><p className="truncate text-xs font-semibold text-white">{userName}</p><p className="mt-1 truncate text-[11px] text-sidebar-foreground/60">Private workspace</p></div></SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-7"><div className="flex items-center gap-3"><SidebarTrigger /><Separator orientation="vertical" className="h-5" /><div><p className="text-xs text-muted-foreground">Content Change Log</p><h1 className="font-semibold">{activeLabel}</h1></div></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="hidden gap-2 sm:flex" onClick={() => setView("changes")}><Search className="size-4" /> Find changes</Button><Button size="sm" className="gap-2" onClick={() => setView("audit")}><Sparkles className="size-4" /> New audit</Button></div></header>
        <main className="editorial-grid min-h-[calc(100vh-4rem)] p-4 md:p-7">
          <div className="mx-auto max-w-[1600px]">
            {loading ? <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Loading secure workspace…</p></div></div> : <>
              {view === "overview" && <Overview data={data} onNavigate={setView} refresh={refresh} />}
              {view === "audit" && <NewAudit sites={data.sites} onComplete={async () => { await refresh(); setView("review"); }} />}
              {view === "changes" && <ChangeLog data={data} refresh={refresh} />}
              {view === "review" && <ChangeLog data={data} reviewMode refresh={refresh} />}
              {view === "sites" && <SitesView data={data} refresh={refresh} processBatch={processBatch} />}
              {view === "batches" && <BatchesView data={data} processBatch={processBatch} refresh={refresh} />}
              {view === "settings" && <SettingsView data={data} />}
            </>}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

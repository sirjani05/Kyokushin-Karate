import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { Profile, TrialStatus } from "../lib/database.types";
import type { AppDatabase } from "../lib/data";
import { getSenseiLeads } from "../lib/data";
import { EmptyState, ErrorState, LoadingState } from "../components/StatusView";

const statuses: TrialStatus[] = ["requested", "contacted", "trial_scheduled", "enrolled", "cancelled"];
const labels: Record<TrialStatus, string> = {
  requested: "New request",
  contacted: "Contacted",
  trial_scheduled: "Trial scheduled",
  enrolled: "Enrolled",
  cancelled: "Cancelled",
};

export function Leads({ client, profile, online }: { client: AppDatabase; profile: Profile; online: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const leads = useQuery({
    queryKey: ["leads", profile.id],
    queryFn: () => getSenseiLeads(client, profile.id),
    enabled: profile.role === "sensei",
  });
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TrialStatus }) => {
      const { error } = await client.from("trial_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads", profile.id] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", profile.id] }),
      ]);
      toast.success("Lead status updated");
    },
    onError: (error) => toast.error(error.message || "Could not update the lead."),
  });
  const filtered = useMemo(
    () => (leads.data ?? []).filter((lead) =>
      [lead.student_name, lead.student_email, lead.student_phone, lead.message]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    ),
    [leads.data, search],
  );

  if (profile.role !== "sensei") {
    return <EmptyState title="Sensei workspace" description="Lead management is available to verified Sensei accounts." />;
  }
  if (leads.isPending) return <LoadingState label="Loading trial requests" />;
  if (leads.error) return <ErrorState message={leads.error.message} />;

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="eyebrow">SENSEI WORKSPACE</span><h1>Trial pipeline</h1><p>Follow every new student from first contact to enrollment.</p></div><div className="heading-counter"><strong>{leads.data.length}</strong><span>requests</span></div></section>
      <div className="directory-toolbar"><label className="search-box"><Search size={18} /><input aria-label="Search leads" onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search students or messages" value={search} /></label><span className="muted">{filtered.length} shown</span></div>
      {leads.data.length === 0 ? (
        <EmptyState title="No trial leads yet" description="Requests from students will appear here after they contact your published dojo." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching leads" description="Try another student name, email, or message." action={<button className="text-link" onClick={() => setSearch("")} type="button">Clear search</button>} />
      ) : (
        <div className="lead-board">
          {statuses.filter((status) => status !== "cancelled").map((status) => {
            const group = filtered.filter((lead) => lead.status === status);
            return (
              <section className="lead-column" key={status}>
                <div className="lead-column-heading"><span className={`status-dot status-dot-${status}`} /><h2>{labels[status]}</h2><span className="column-count">{group.length}</span></div>
                {group.length === 0 && <div className="column-empty">No requests here</div>}
                {group.map((lead) => (
                  <article className="lead-card" key={lead.id}>
                    <div className="lead-card-title"><span className="avatar-circle"><UserRound size={16} /></span><div><h3>{lead.student_name}</h3><time>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(lead.created_at))}</time></div></div>
                    {lead.message && <p className="lead-message">“{lead.message}”</p>}
                    <div className="lead-contact"><a href={`mailto:${lead.student_email}`}><Mail size={14} />{lead.student_email}</a>{lead.student_phone && <a href={`tel:${lead.student_phone}`}><Phone size={14} />{lead.student_phone}</a>}</div>
                    {lead.preferred_date && <p className="preferred-date">Preferred date · {lead.preferred_date}</p>}
                    <label className="field status-select"><span>Update status</span><select disabled={updateStatus.isPending || !online} onChange={(event) => {
                      const nextStatus = statuses.find((option) => option === event.currentTarget.value);
                      if (nextStatus) updateStatus.mutate({ id: lead.id, status: nextStatus });
                    }} value={lead.status}>{statuses.map((option) => <option key={option} value={option}>{labels[option]}</option>)}</select></label>
                  </article>
                ))}
              </section>
            );
          })}
          {filtered.some((lead) => lead.status === "cancelled") && <section className="cancelled-section"><h2>Closed requests</h2>{filtered.filter((lead) => lead.status === "cancelled").map((lead) => <div className="cancelled-row" key={lead.id}><strong>{lead.student_name}</strong><span>{lead.student_email}</span><label className="field status-select"><span className="sr-only">Update status for {lead.student_name}</span><select disabled={updateStatus.isPending || !online} onChange={(event) => {
            const nextStatus = statuses.find((option) => option === event.currentTarget.value);
            if (nextStatus) updateStatus.mutate({ id: lead.id, status: nextStatus });
          }} value={lead.status}>{statuses.map((option) => <option key={option} value={option}>{labels[option]}</option>)}</select></label></div>)}</section>}
        </div>
      )}
      {updateStatus.error && <p className="inline-error" role="alert">{updateStatus.error.message}</p>}
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "../lib/database.types";
import type { AppDatabase } from "../lib/data";
import { getBeltProgression, getSenseiBeltProgression, getSenseiLeads } from "../lib/data";
import { EmptyState, ErrorState, LoadingState } from "../components/StatusView";

export function Progression({ client, profile }: { client: AppDatabase; profile: Profile }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student_id: "", dojo_id: "", belt_name: "", promoted_on: new Date().toISOString().slice(0, 10), notes: "" });
  const isSensei = profile.role === "sensei";
  const progression = useQuery({
    queryKey: ["belt-progress", isSensei ? "sensei" : "student", profile.id],
    queryFn: () => isSensei ? getSenseiBeltProgression(client, profile.id) : getBeltProgression(client, profile.id),
  });
  const leads = useQuery({
    queryKey: ["leads", profile.id],
    queryFn: () => getSenseiLeads(client, profile.id),
    enabled: isSensei,
  });
  const addPromotion = useMutation({
    mutationFn: async () => {
      if (!form.student_id || !form.dojo_id || !form.belt_name.trim()) {
        throw new Error("Choose an enrolled student and enter the new belt.");
      }
      const { error } = await client.from("belt_progressions").insert({
        student_id: form.student_id,
        dojo_id: form.dojo_id,
        sensei_id: profile.id,
        belt_name: form.belt_name.trim(),
        promoted_on: form.promoted_on,
        notes: form.notes.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["belt-progress"] });
      setShowForm(false);
      setForm({ student_id: "", dojo_id: "", belt_name: "", promoted_on: new Date().toISOString().slice(0, 10), notes: "" });
      toast.success("Belt progression recorded");
    },
    onError: (error) => toast.error(error.message || "Could not save belt progression."),
  });

  if (progression.isPending || (isSensei && leads.isPending)) return <LoadingState label="Loading belt progression" />;
  if (progression.error || leads.error) return <ErrorState message={(progression.error ?? leads.error)?.message ?? "Could not load progression."} />;
  const rows = progression.data ?? [];
  const enrolled = (leads.data ?? []).filter((lead) => lead.status === "enrolled");
  const uniqueBelts = [...new Set(rows.map((item) => item.belt_name))];

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="eyebrow">{isSensei ? "SENSEI WORKSPACE" : "YOUR TRAINING"}</span><h1>Belt progression</h1><p>{isSensei ? "Recognize the dedication behind every promotion." : "Your progress is built one disciplined step at a time."}</p></div>{isSensei && <button className="button button-primary" disabled={enrolled.length === 0} onClick={() => setShowForm(true)} type="button"><Plus size={16} />Record promotion</button>}</section>
      {isSensei && enrolled.length === 0 && <div className="info-banner"><Sparkles size={18} /><span>Mark a trial request as <strong>Enrolled</strong> in the lead pipeline before recording a student’s progression.</span></div>}
      <section className="progress-summary">
        <div className="progress-mark"><Award size={28} /></div>
        <div><span className="eyebrow">{isSensei ? "RECORDED PROMOTIONS" : "YOUR JOURNEY"}</span><strong>{rows.length}</strong><small>{uniqueBelts.length} {uniqueBelts.length === 1 ? "belt level" : "belt levels"} recorded</small></div>
        {!isSensei && <div className="progress-message"><span>There is no finish line.</span><strong>Only the next step.</strong></div>}
      </section>
      {rows.length === 0 ? (
        <EmptyState title={isSensei ? "No progressions recorded yet" : "Your first promotion is ahead"} description={isSensei ? "Record an enrolled student's belt progression to create their private training history." : "Belt promotions recorded by your Sensei will appear here."} />
      ) : (
        <section className="timeline">
          {rows.map((item, index) => (
            <article className="timeline-item" key={item.id}>
              <span className={`timeline-node ${index === 0 ? "timeline-node-current" : ""}`}><CheckCircle2 size={16} /></span>
              <div className="timeline-card"><div><span className="eyebrow">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(`${item.promoted_on}T12:00:00`))}</span><h2>{item.belt_name}</h2>{item.notes && <p>{item.notes}</p>}</div><span className="belt-rank">{index === 0 ? "LATEST" : `STEP ${rows.length - index}`}</span></div>
            </article>
          ))}
        </section>
      )}
      {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><form className="modal-card" onSubmit={(event: FormEvent) => { event.preventDefault(); addPromotion.mutate(); }}><div className="modal-heading"><div><span className="eyebrow">RECOGNIZE PROGRESS</span><h2>Record promotion</h2></div><button aria-label="Close" className="icon-button" onClick={() => setShowForm(false)} type="button">×</button></div><label className="field"><span>Enrolled student</span><select onChange={(event) => {
        const lead = enrolled.find((item) => item.id === event.currentTarget.value);
        setForm({ ...form, student_id: lead?.student_id ?? "", dojo_id: lead?.dojo_id ?? "" });
      }} required value={form.student_id ? enrolled.find((item) => item.student_id === form.student_id)?.id ?? "" : ""}><option disabled value="">Select student</option>{enrolled.map((lead) => <option key={lead.id} value={lead.id}>{lead.student_name} · {lead.student_email}</option>)}</select></label><label className="field"><span>New belt rank</span><input maxLength={80} onChange={(event) => setForm({ ...form, belt_name: event.currentTarget.value })} placeholder="e.g. 8th Kyu — Yellow Belt" required value={form.belt_name} /></label><label className="field"><span>Promotion date</span><input onChange={(event) => setForm({ ...form, promoted_on: event.currentTarget.value })} required type="date" value={form.promoted_on} /></label><label className="field"><span>Note (optional)</span><textarea maxLength={1000} onChange={(event) => setForm({ ...form, notes: event.currentTarget.value })} rows={3} value={form.notes} /></label><button className="button button-primary modal-submit" disabled={addPromotion.isPending} type="submit">{addPromotion.isPending ? "Saving…" : "Save progression"} <Award size={16} /></button>{addPromotion.error && <p className="inline-error">{addPromotion.error.message}</p>}</form></div>}
    </div>
  );
}

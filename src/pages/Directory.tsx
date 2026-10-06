import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, Mail, MapPin, Search, Send, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "../lib/database.types";
import type { AppDatabase } from "../lib/data";
import { getDojoPricing, getDojoSchedules, getPublishedDojos } from "../lib/data";
import { EmptyState, ErrorState, LoadingState } from "../components/StatusView";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Directory({
  client,
  profile,
  email,
  online,
  onRequestSignIn,
}: {
  client: AppDatabase;
  profile: Profile | null;
  email: string;
  online: boolean;
  onRequestSignIn: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedDojo, setSelectedDojo] = useState<string | null>(null);
  const [requestingDojo, setRequestingDojo] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const dojos = useQuery({
    queryKey: ["dojos", "directory"],
    queryFn: () => getPublishedDojos(client),
  });
  const schedules = useQuery({
    queryKey: ["dojos", "schedules", selectedDojo],
    queryFn: () => getDojoSchedules(client, selectedDojo!),
    enabled: selectedDojo !== null,
  });
  const pricing = useQuery({
    queryKey: ["dojos", "pricing", selectedDojo],
    queryFn: () => getDojoPricing(client, selectedDojo!),
    enabled: selectedDojo !== null,
  });
  const requestTrial = useMutation({
    mutationFn: async (dojoId: string) => {
      if (!profile) throw new Error("Sign in to request a trial class.");
      const { error } = await client.from("trial_requests").insert({
        dojo_id: dojoId,
        student_id: profile.id,
        student_name: profile.display_name,
        student_email: email,
        student_phone: phone.trim(),
        preferred_date: preferredDate || null,
        message: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      if (profile) {
        await queryClient.invalidateQueries({ queryKey: ["trials", "student", profile.id] });
      }
      toast.success("Trial request sent");
      setRequestingDojo(null);
      setMessage("");
      setPhone("");
      setPreferredDate("");
    },
    onError: (error) => toast.error(error.message || "Could not send your request."),
  });
  const filteredDojos = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return dojos.data ?? [];
    return (dojos.data ?? []).filter((dojo) =>
      [dojo.name, dojo.city, dojo.region, dojo.postal_code, dojo.country, dojo.description]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [dojos.data, search]);

  if (dojos.isPending) return <LoadingState label="Finding published dojos" />;
  if (dojos.error) return <ErrorState message={dojos.error.message} />;

  return (
    <div className="page-stack">
      <section className="directory-heading">
        <div><span className="eyebrow">FIND YOUR DOJO</span><h1>Find your place.</h1><p>Train with a community that makes you stronger.</p></div>
        <div className="directory-count"><strong>{filteredDojos.length}</strong><span>dojos to explore</span></div>
      </section>
      <div className="directory-toolbar">
        <label className="search-box"><Search size={18} /><input aria-label="Search dojos" onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search by dojo, city, or postal code" value={search} /></label>
        <button className={`button button-secondary ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)} type="button"><SlidersHorizontal size={16} />Filters</button>
      </div>
      {filtersOpen && (
        <div className="filter-strip">
          <span>Search area:</span>
          <button className="filter-chip selected" onClick={() => setSearch("")} type="button">All locations</button>
          <span className="muted">Use the search field to narrow by city or postal code.</span>
        </div>
      )}
      {filteredDojos.length === 0 ? (
        <EmptyState title="No dojos match your search" description={search ? "Try a different city, postal code, or dojo name." : "Published dojo profiles will appear here."} action={search ? <button className="text-link" onClick={() => setSearch("")} type="button">Clear search</button> : undefined} />
      ) : (
        <div className="dojo-grid">
          {filteredDojos.map((dojo) => {
            const expanded = selectedDojo === dojo.id;
            const requestOpen = requestingDojo === dojo.id;
            return (
              <article className="dojo-card" key={dojo.id}>
                <div className="dojo-card-top">
                  <span className="dojo-emblem">OSU</span>
                  <span className="dojo-type">KYOKUSHIN DOJO</span>
                  <button aria-label={`${expanded ? "Hide" : "Show"} ${dojo.name} details`} className="icon-button" onClick={() => setSelectedDojo(expanded ? null : dojo.id)} type="button"><ArrowUpRight size={17} /></button>
                </div>
                <h2>{dojo.name}</h2>
                <p className="dojo-location"><MapPin size={15} />{[dojo.city, dojo.region, dojo.country].filter(Boolean).join(", ") || "Location not provided"}</p>
                <p className="dojo-description">{dojo.description || "A Kyokushin community welcoming dedicated students of all experience levels."}</p>
                <div className="dojo-card-footer">
                  <button className="text-link" onClick={() => setSelectedDojo(expanded ? null : dojo.id)} type="button">{expanded ? "Hide details" : "View dojo details"}</button>
                  {!profile || profile.role === "student" ? (
                    <button className="button button-primary button-small" disabled={!online} onClick={() => {
                      if (!profile) onRequestSignIn();
                      else setRequestingDojo(requestOpen ? null : dojo.id);
                    }} type="button">{profile ? "Free trial" : "Sign in to try"} <ArrowUpRight size={15} /></button>
                  ) : (
                    <span className="status-note">Public listing</span>
                  )}
                </div>
                {expanded && (
                  <div className="dojo-detail">
                    <div className="detail-grid">
                      <div><h3><CalendarDays size={15} />Training schedule</h3>
                        {schedules.isPending && <small>Loading schedule…</small>}
                        {schedules.error && <small className="detail-error">{schedules.error.message}</small>}
                        {schedules.data?.length === 0 && <small>Schedule not listed yet.</small>}
                        {schedules.data?.map((item) => <p className="detail-line" key={item.id}><strong>{dayNames[item.day_of_week]}</strong><span>{item.starts_at.slice(0, 5)} – {item.ends_at.slice(0, 5)}</span><small>{item.class_name}{item.age_group ? ` · ${item.age_group}` : ""}</small></p>)}
                      </div>
                      <div><h3>Membership</h3>
                        {pricing.isPending && <small>Loading pricing…</small>}
                        {pricing.error && <small className="detail-error">{pricing.error.message}</small>}
                        {pricing.data?.length === 0 && <small>Pricing not listed yet.</small>}
                        {pricing.data?.map((plan) => <p className="detail-line" key={plan.id}><strong>{plan.name}</strong><span>{new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency }).format(plan.monthly_price)} / mo</span><small>{plan.description}</small></p>)}
                      </div>
                    </div>
                    {dojo.phone && <a className="text-link" href={`tel:${dojo.phone}`}>{dojo.phone}</a>}
                    {dojo.public_email && <a className="text-link" href={`mailto:${dojo.public_email}`}>{dojo.public_email}</a>}
                  </div>
                )}
                {requestOpen && profile && (
                  <form className="trial-form" onSubmit={(event) => { event.preventDefault(); if (online) requestTrial.mutate(dojo.id); }}>
                    <h3>Request a free trial</h3>
                    <p>We’ll share your contact details with this dojo so the Sensei can follow up.</p>
                    <div className="form-row">
                      <label className="field"><span>Your name</span><input maxLength={100} value={profile.display_name} readOnly /></label>
                      <label className="field"><span>Phone (optional)</span><input autoComplete="tel" maxLength={40} onChange={(event) => setPhone(event.currentTarget.value)} type="tel" value={phone} /></label>
                    </div>
                    <label className="field"><span>Preferred date (optional)</span><input min={new Date().toISOString().slice(0, 10)} onChange={(event) => setPreferredDate(event.currentTarget.value)} type="date" value={preferredDate} /></label>
                    <label className="field"><span>Message (optional)</span><textarea maxLength={1000} onChange={(event) => setMessage(event.currentTarget.value)} placeholder="Tell the Sensei a little about your goals…" rows={3} value={message} /></label>
                    <div className="trial-form-footer"><span className="muted"><Mail size={14} /> {email}</span><button className="button button-primary button-small" disabled={requestTrial.isPending || !online} type="submit">{requestTrial.isPending ? "Sending…" : online ? "Send request" : "Offline"} <Send size={14} /></button></div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

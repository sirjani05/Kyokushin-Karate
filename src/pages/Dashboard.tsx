import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, CircleUserRound, MapPin, UsersRound } from "lucide-react";
import type { Profile } from "../lib/database.types";
import type { AppDatabase } from "../lib/data";
import { getSenseiDojos, getSenseiLeads, getStudentTrials } from "../lib/data";
import { EmptyState, ErrorState, LoadingState } from "../components/StatusView";

const statusLabels: Record<string, string> = {
  requested: "New",
  contacted: "Contacted",
  trial_scheduled: "Trial scheduled",
  enrolled: "Enrolled",
  cancelled: "Cancelled",
};

function formattedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function Dashboard({ client, profile }: { client: AppDatabase; profile: Profile }) {
  const dojos = useQuery({
    queryKey: ["dojos", "sensei", profile.id],
    queryFn: () => getSenseiDojos(client, profile.id),
    enabled: profile.role === "sensei",
  });
  const leads = useQuery({
    queryKey: ["leads", profile.id],
    queryFn: () => getSenseiLeads(client, profile.id),
    enabled: profile.role === "sensei",
  });
  const studentTrials = useQuery({
    queryKey: ["trials", "student", profile.id],
    queryFn: () => getStudentTrials(client, profile.id),
    enabled: profile.role === "student",
  });

  if (profile.role === "sensei") {
    if (dojos.isPending || leads.isPending) return <LoadingState label="Loading dojo activity" />;
    if (dojos.error || leads.error) {
      return <ErrorState message={(dojos.error ?? leads.error)?.message ?? "Could not load dojo activity."} />;
    }

    const newLeads = leads.data.filter((lead) => lead.status === "requested").length;
    const activeLeads = leads.data.filter((lead) => !["enrolled", "cancelled"].includes(lead.status)).length;

    return (
      <div className="page-stack">
        <section className="welcome-banner">
          <div>
            <span className="eyebrow">SENSEI DASHBOARD</span>
            <h1>Osu, {profile.display_name || "Sensei"}.</h1>
            <p>Your dojo community, at a glance.</p>
          </div>
          <Link className="button button-light" to="/dojo">Manage dojo <ArrowUpRight size={16} /></Link>
        </section>
        <div className="stat-grid">
          <article className="stat-card"><span className="stat-icon"><UsersRound size={18} /></span><span className="stat-label">Trial requests</span><strong>{leads.data.length}</strong><small>All time</small></article>
          <article className="stat-card"><span className="stat-icon stat-icon-gold"><CircleUserRound size={18} /></span><span className="stat-label">Needs a reply</span><strong>{newLeads}</strong><small>New requests</small></article>
          <article className="stat-card"><span className="stat-icon stat-icon-green"><CalendarDays size={18} /></span><span className="stat-label">In progress</span><strong>{activeLeads}</strong><small>Not yet enrolled or closed</small></article>
          <article className="stat-card"><span className="stat-icon"><MapPin size={18} /></span><span className="stat-label">Your dojos</span><strong>{dojos.data.length}</strong><small>{dojos.data.filter((dojo) => dojo.is_published).length} published</small></article>
        </div>
        <section className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">THE PIPELINE</span><h2>Recent trial requests</h2></div>
            <Link className="text-link" to="/leads">View all <ArrowUpRight size={15} /></Link>
          </div>
          {leads.data.length === 0 ? (
            <EmptyState title="No trial leads yet" description="New free-trial requests will appear here when students contact a published dojo." action={<Link className="text-link" to="/dojo">Review your dojo listing <ArrowUpRight size={15} /></Link>} />
          ) : (
            <div className="lead-list">
              {leads.data.slice(0, 5).map((lead) => (
                <Link className="lead-row" key={lead.id} to="/leads">
                  <span className="avatar-circle">{lead.student_name.slice(0, 1).toUpperCase()}</span>
                  <span className="lead-person"><strong>{lead.student_name}</strong><small>{lead.student_email}</small></span>
                  <span className={`status-pill status-${lead.status}`}>{statusLabels[lead.status]}</span>
                  <time>{formattedDate(lead.created_at)}</time>
                </Link>
              ))}
            </div>
          )}
        </section>
        {dojos.data.length === 0 && (
          <EmptyState
            title="Create your dojo profile"
            description="Add a schedule, pricing, and public details so students can find you and request a trial."
            action={<Link className="button button-primary button-small" to="/dojo">Set up your dojo</Link>}
          />
        )}
      </div>
    );
  }

  if (studentTrials.isPending) return <LoadingState label="Loading your training journey" />;
  if (studentTrials.error) return <ErrorState message={studentTrials.error.message} />;
  const nextTrial = studentTrials.data.find((trial) => !["cancelled", "enrolled"].includes(trial.status));

  return (
    <div className="page-stack">
      <section className="welcome-banner welcome-student">
        <div>
          <span className="eyebrow">YOUR DOJO JOURNEY</span>
          <h1>Osu, {profile.display_name || "Karateka"}.</h1>
          <p>Every day is another chance to become stronger.</p>
        </div>
        <Link className="button button-light" to="/directory">Find a dojo <ArrowUpRight size={16} /></Link>
      </section>
      <div className="stat-grid student-stat-grid">
        <article className="stat-card"><span className="stat-icon"><CalendarDays size={18} /></span><span className="stat-label">Trial requests</span><strong>{studentTrials.data.length}</strong><small>Made by you</small></article>
        <article className="stat-card"><span className="stat-icon stat-icon-gold"><MapPin size={18} /></span><span className="stat-label">Next step</span><strong className="stat-text">{nextTrial ? statusLabels[nextTrial.status] : "Explore"}</strong><small>{nextTrial ? `Requested ${formattedDate(nextTrial.created_at)}` : "Find your first dojo"}</small></article>
      </div>
      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">YOUR TRAINING</span><h2>Trial requests</h2></div><Link className="text-link" to="/directory">Discover dojos <ArrowUpRight size={15} /></Link></div>
        {studentTrials.data.length === 0 ? (
          <EmptyState title="Your journey starts here" description="Explore nearby dojos and request a free trial class to find the right fit." action={<Link className="button button-primary button-small" to="/directory">Explore dojos</Link>} />
        ) : (
          <div className="lead-list">
            {studentTrials.data.map((trial) => (
              <div className="lead-row" key={trial.id}>
                <span className="avatar-circle"><CalendarDays size={16} /></span>
                <span className="lead-person"><strong>Trial request</strong><small>{trial.message || "No message added"}</small></span>
                <span className={`status-pill status-${trial.status}`}>{statusLabels[trial.status]}</span>
                <time>{formattedDate(trial.created_at)}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

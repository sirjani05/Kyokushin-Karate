import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Clock3, DollarSign, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Dojo, DojoPricing, DojoSchedule, Profile } from "../lib/database.types";
import type { AppDatabase } from "../lib/data";
import { getDojoPricing, getDojoSchedules, getSenseiDojos } from "../lib/data";
import { EmptyState, ErrorState, LoadingState } from "../components/StatusView";

type DojoForm = Pick<Dojo, "name" | "description" | "address" | "city" | "region" | "postal_code" | "country" | "phone" | "public_email" | "website" | "is_published">;

const blankDojo: DojoForm = {
  name: "",
  description: "",
  address: "",
  city: "",
  region: "",
  postal_code: "",
  country: "",
  phone: "",
  public_email: "",
  website: "",
  is_published: false,
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function DojoSettings({ client, profile, online }: { client: AppDatabase; profile: Profile; online: boolean }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<DojoForm>(blankDojo);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ day_of_week: "1", starts_at: "18:00", ends_at: "19:30", class_name: "", age_group: "" });
  const [priceForm, setPriceForm] = useState({ name: "", description: "", monthly_price: "", currency: "USD" });
  const dojos = useQuery({
    queryKey: ["dojos", "sensei", profile.id],
    queryFn: () => getSenseiDojos(client, profile.id),
    enabled: profile.role === "sensei",
  });
  const dojo = dojos.data?.find((item) => item.id === selectedId) ?? dojos.data?.[0];
  const schedules = useQuery({
    queryKey: ["dojos", "schedules", dojo?.id],
    queryFn: () => getDojoSchedules(client, dojo!.id),
    enabled: Boolean(dojo?.id),
  });
  const pricing = useQuery({
    queryKey: ["dojos", "pricing", dojo?.id],
    queryFn: () => getDojoPricing(client, dojo!.id),
    enabled: Boolean(dojo?.id),
  });

  useEffect(() => {
    if (dojo) {
      setSelectedId(dojo.id);
      setForm({
        name: dojo.name,
        description: dojo.description,
        address: dojo.address,
        city: dojo.city,
        region: dojo.region,
        postal_code: dojo.postal_code,
        country: dojo.country,
        phone: dojo.phone,
        public_email: dojo.public_email,
        website: dojo.website,
        is_published: dojo.is_published,
      });
      setCoverPath(dojo.cover_path);
    } else if (dojos.isSuccess) {
      setSelectedId("");
      setForm(blankDojo);
      setCoverPath(null);
    }
  }, [dojo?.id, dojos.isSuccess]);

  const saveDojo = useMutation({
    mutationFn: async (values: DojoForm) => {
      const payload = { ...values, sensei_id: profile.id, cover_path: coverPath };
      if (dojo) {
        const { error } = await client.from("dojos").update(payload).eq("id", dojo.id);
        if (error) throw error;
      } else {
        const { data, error } = await client.from("dojos").insert(payload).select("*").single();
        if (error) throw error;
        return data;
      }
      return null;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["dojos", "sensei", profile.id] });
      await queryClient.invalidateQueries({ queryKey: ["dojos", "directory"] });
      if (created) setSelectedId(created.id);
      toast.success("Dojo profile saved");
    },
    onError: (error) => toast.error(error.message || "Could not save dojo profile."),
  });

  const addSchedule = useMutation({
    mutationFn: async () => {
      if (!dojo) throw new Error("Save your dojo profile before adding a schedule.");
      const { error } = await client.from("dojo_schedules").insert({
        dojo_id: dojo.id,
        day_of_week: Number(scheduleForm.day_of_week),
        starts_at: scheduleForm.starts_at,
        ends_at: scheduleForm.ends_at,
        class_name: scheduleForm.class_name.trim(),
        age_group: scheduleForm.age_group.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dojos", "schedules", dojo?.id] });
      setScheduleForm((current) => ({ ...current, class_name: "", age_group: "" }));
      toast.success("Class added to schedule");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from("dojo_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["dojos", "schedules", dojo?.id] }),
    onError: (error) => toast.error(error.message),
  });
  const addPricing = useMutation({
    mutationFn: async () => {
      if (!dojo) throw new Error("Save your dojo profile before adding pricing.");
      const { error } = await client.from("dojo_pricing").insert({
        dojo_id: dojo.id,
        name: priceForm.name.trim(),
        description: priceForm.description.trim(),
        monthly_price: Number(priceForm.monthly_price),
        currency: priceForm.currency,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dojos", "pricing", dojo?.id] });
      setPriceForm({ name: "", description: "", monthly_price: "", currency: "USD" });
      toast.success("Membership plan added");
    },
    onError: (error) => toast.error(error.message),
  });
  const deletePricing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from("dojo_pricing").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["dojos", "pricing", dojo?.id] }),
    onError: (error) => toast.error(error.message),
  });

  async function uploadCover(file: File) {
    const extension = imageTypes[file.type];
    if (!extension) {
      toast.error("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Choose an image smaller than 20 MB.");
      return;
    }
    const path = `sensei/${profile.id}/dojos/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("dojo-media").upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(error.message || "Could not upload the dojo image.");
      return;
    }
    setCoverPath(path);
    toast.success("Image uploaded. Save the dojo profile to publish the change.");
  }

  if (profile.role !== "sensei") return <EmptyState title="Sensei workspace" description="Dojo management is available to verified Sensei accounts." />;
  if (dojos.isPending) return <LoadingState label="Loading your dojo profiles" />;
  if (dojos.error) return <ErrorState message={dojos.error.message} />;

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (online) saveDojo.mutate(form);
  }

  const plans = pricing.data ?? [];
  const classSchedule = schedules.data ?? [];

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="eyebrow">SENSEI WORKSPACE</span><h1>Dojo profile</h1><p>Make it easy for future students to find and choose your dojo.</p></div>
        {dojos.data.length > 1 && <label className="field dojo-select"><span>Choose dojo</span><select onChange={(event) => setSelectedId(event.currentTarget.value)} value={dojo?.id ?? ""}>{dojos.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </section>
      <form className="panel form-panel" onSubmit={submitProfile}>
        <div className="section-heading"><div><span className="eyebrow">PUBLIC LISTING</span><h2>About your dojo</h2></div><span className={`listing-badge ${form.is_published ? "is-published" : ""}`}>{form.is_published ? "Published" : "Draft"}</span></div>
        <div className="cover-upload">
          <span className="cover-icon"><Camera size={22} /></span>
          <div><strong>{coverPath ? "Cover image uploaded" : "Add a dojo cover image"}</strong><small>JPEG, PNG, or WebP · up to 20 MB</small></div>
          <label className={`button button-secondary button-small${online ? "" : " disabled-label"}`}>Choose image<input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!online} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void uploadCover(file);
            event.currentTarget.value = "";
          }} type="file" /></label>
        </div>
        <div className="form-grid">
          <label className="field field-span-two"><span>Dojo name</span><input maxLength={120} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })} required value={form.name} /></label>
          <label className="field field-span-two"><span>About the dojo</span><textarea maxLength={3000} onChange={(event) => setForm({ ...form, description: event.currentTarget.value })} rows={4} value={form.description} /></label>
          <label className="field field-span-two"><span>Street address</span><input autoComplete="street-address" maxLength={200} onChange={(event) => setForm({ ...form, address: event.currentTarget.value })} value={form.address} /></label>
          <label className="field"><span>City</span><input autoComplete="address-level2" maxLength={100} onChange={(event) => setForm({ ...form, city: event.currentTarget.value })} value={form.city} /></label>
          <label className="field"><span>State / region</span><input autoComplete="address-level1" maxLength={100} onChange={(event) => setForm({ ...form, region: event.currentTarget.value })} value={form.region} /></label>
          <label className="field"><span>Postal code</span><input autoComplete="postal-code" maxLength={20} onChange={(event) => setForm({ ...form, postal_code: event.currentTarget.value })} value={form.postal_code} /></label>
          <label className="field"><span>Country</span><input autoComplete="country-name" maxLength={80} onChange={(event) => setForm({ ...form, country: event.currentTarget.value })} value={form.country} /></label>
          <label className="field"><span>Public phone</span><input autoComplete="tel" maxLength={40} onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })} type="tel" value={form.phone} /></label>
          <label className="field"><span>Public email</span><input autoComplete="email" maxLength={320} onChange={(event) => setForm({ ...form, public_email: event.currentTarget.value })} type="email" value={form.public_email} /></label>
          <label className="field field-span-two"><span>Website</span><input maxLength={300} onChange={(event) => setForm({ ...form, website: event.currentTarget.value })} placeholder="https://" type="url" value={form.website} /></label>
        </div>
        <div className="publish-row">
          <label className="switch-row"><input checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.currentTarget.checked })} type="checkbox" /><span><strong>Publish listing</strong><small>Make this dojo discoverable in the public directory.</small></span></label>
          <button className="button button-primary" disabled={saveDojo.isPending || !online} type="submit"><Save size={16} />{saveDojo.isPending ? "Saving…" : online ? "Save profile" : "Offline"}</button>
        </div>
        {saveDojo.error && <p className="inline-error" role="alert">{saveDojo.error.message}</p>}
      </form>

      <section className="panel form-panel">
        <div className="section-heading"><div><span className="eyebrow">WEEKLY TRAINING</span><h2>Class schedule</h2></div><Clock3 size={20} className="section-icon" /></div>
        {schedules.isPending && dojo && <LoadingState label="Loading your schedule" />}
        {schedules.error && <ErrorState message={schedules.error.message} />}
        {!schedules.isPending && classSchedule.length === 0 && <p className="muted form-hint">{dojo ? "No classes listed yet. Add your first training session below." : "Save the dojo profile before setting a schedule."}</p>}
        {classSchedule.map((item: DojoSchedule) => <div className="managed-row" key={item.id}><span className="day-tag">{dayNames[item.day_of_week].slice(0, 3)}</span><span><strong>{item.class_name}</strong><small>{item.starts_at.slice(0, 5)}–{item.ends_at.slice(0, 5)}{item.age_group ? ` · ${item.age_group}` : ""}</small></span><button aria-label={`Remove ${item.class_name}`} className="icon-button danger-icon" disabled={deleteSchedule.isPending || !online} onClick={() => deleteSchedule.mutate(item.id)} type="button"><Trash2 size={16} /></button></div>)}
        <form className="inline-add-form schedule-add" onSubmit={(event) => { event.preventDefault(); if (online) addSchedule.mutate(); }}>
          <label className="field"><span>Day</span><select onChange={(event) => setScheduleForm({ ...scheduleForm, day_of_week: event.currentTarget.value })} value={scheduleForm.day_of_week}>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
          <label className="field"><span>Start</span><input onChange={(event) => setScheduleForm({ ...scheduleForm, starts_at: event.currentTarget.value })} required type="time" value={scheduleForm.starts_at} /></label>
          <label className="field"><span>End</span><input onChange={(event) => setScheduleForm({ ...scheduleForm, ends_at: event.currentTarget.value })} required type="time" value={scheduleForm.ends_at} /></label>
          <label className="field"><span>Class name</span><input maxLength={100} onChange={(event) => setScheduleForm({ ...scheduleForm, class_name: event.currentTarget.value })} placeholder="Adults Kyokushin" required value={scheduleForm.class_name} /></label>
          <label className="field"><span>Age group</span><input maxLength={80} onChange={(event) => setScheduleForm({ ...scheduleForm, age_group: event.currentTarget.value })} placeholder="All levels" value={scheduleForm.age_group} /></label>
          <button aria-label="Add class" className="button button-secondary add-row-button" disabled={!dojo || addSchedule.isPending || !online} type="submit"><Plus size={17} /></button>
        </form>
      </section>

      <section className="panel form-panel">
        <div className="section-heading"><div><span className="eyebrow">MEMBERSHIP</span><h2>Pricing plans</h2></div><DollarSign size={20} className="section-icon" /></div>
        {pricing.isPending && dojo && <LoadingState label="Loading membership plans" />}
        {pricing.error && <ErrorState message={pricing.error.message} />}
        {!pricing.isPending && plans.length === 0 && <p className="muted form-hint">{dojo ? "No membership plans listed yet." : "Save the dojo profile before setting membership prices."}</p>}
        {plans.map((plan: DojoPricing) => <div className="managed-row" key={plan.id}><span className="price-tag">{new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency }).format(plan.monthly_price)}</span><span><strong>{plan.name}</strong><small>{plan.description || "Monthly membership"}</small></span><button aria-label={`Remove ${plan.name} plan`} className="icon-button danger-icon" disabled={deletePricing.isPending || !online} onClick={() => deletePricing.mutate(plan.id)} type="button"><Trash2 size={16} /></button></div>)}
        <form className="inline-add-form pricing-add" onSubmit={(event) => { event.preventDefault(); if (online) addPricing.mutate(); }}>
          <label className="field"><span>Plan name</span><input maxLength={80} onChange={(event) => setPriceForm({ ...priceForm, name: event.currentTarget.value })} placeholder="Monthly training" required value={priceForm.name} /></label>
          <label className="field"><span>Monthly price</span><input min="0" onChange={(event) => setPriceForm({ ...priceForm, monthly_price: event.currentTarget.value })} required step="0.01" type="number" value={priceForm.monthly_price} /></label>
          <label className="field"><span>Currency</span><select onChange={(event) => setPriceForm({ ...priceForm, currency: event.currentTarget.value })} value={priceForm.currency}>{["USD", "CAD", "EUR", "GBP", "AUD", "JPY"].map((currency) => <option key={currency}>{currency}</option>)}</select></label>
          <label className="field"><span>Description</span><input maxLength={300} onChange={(event) => setPriceForm({ ...priceForm, description: event.currentTarget.value })} placeholder="Includes unlimited classes" value={priceForm.description} /></label>
          <button aria-label="Add pricing plan" className="button button-secondary add-row-button" disabled={!dojo || addPricing.isPending || !online} type="submit"><Plus size={17} /></button>
        </form>
      </section>
      {saveDojo.isSuccess && <p className="form-saved"><Check size={15} /> Profile changes are saved to Supabase.</p>}
    </div>
  );
}

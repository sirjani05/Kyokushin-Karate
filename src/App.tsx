import { lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Compass,
  Flame,
  LayoutDashboard,
  LogOut,
  Settings2,
  UsersRound,
} from "lucide-react";
import { ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./components/AuthScreen";
import { ErrorState, LoadingState } from "./components/StatusView";
import type { Profile } from "./lib/database.types";
import type { AppDatabase } from "./lib/data";
import { getProfile } from "./lib/data";
import { supabase, supabaseConfigurationError } from "./lib/supabase";
import { useOnlineStatus } from "./lib/useOnlineStatus";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Directory = lazy(() => import("./pages/Directory").then((module) => ({ default: module.Directory })));
const DojoSettings = lazy(() => import("./pages/DojoSettings").then((module) => ({ default: module.DojoSettings })));
const Leads = lazy(() => import("./pages/Leads").then((module) => ({ default: module.Leads })));
const MediaLibrary = lazy(() => import("./pages/MediaLibrary").then((module) => ({ default: module.MediaLibrary })));
const Progression = lazy(() => import("./pages/Progression").then((module) => ({ default: module.Progression })));

function SetupScreen({ message }: { message: string }) {
  return (
    <main className="setup-layout">
      <section className="setup-card">
        <span className="brand-mark"><Flame size={21} fill="currentColor" /></span>
        <span className="eyebrow">OSU DOJO NETWORK</span>
        <h1>Connect your Supabase project.</h1>
        <p className="muted">{message}</p>
        <div className="setup-steps">
          <div><span>01</span><p>Create a Supabase project and copy its Project URL and publishable key.</p></div>
          <div><span>02</span><p>Copy <code>.env.example</code> to <code>.env</code> and add those values.</p></div>
          <div><span>03</span><p>Apply the SQL migration in <code>supabase/migrations</code>, then restart the app.</p></div>
        </div>
        <div className="security-note"><ShieldCheck size={18} /><span>The desktop app only uses the public Supabase key. Row-level security protects all records; never add a service-role key here.</span></div>
      </section>
    </main>
  );
}

function PublicDirectory({ client, online }: { client: AppDatabase; online: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="public-directory">
      <header className="public-header"><Link className="brand-lockup" to="/"><span className="brand-mark"><Flame size={18} fill="currentColor" /></span><span>OSU<span className="brand-dot">.</span></span></Link><Link className="button button-primary button-small" to="/">Sign in <ArrowRight size={15} /></Link></header>
      <div className="public-content"><Suspense fallback={<LoadingState label="Opening the dojo directory" />}><Directory client={client} profile={null} email="" online={online} onRequestSignIn={() => navigate("/")} /></Suspense></div>
    </div>
  );
}

function Navigation({ profile, onSignOut, online }: { profile: Profile; onSignOut: () => void; online: boolean }) {
  const sensei = profile.role === "sensei";
  const links = [
    { to: "/home", label: "Overview", icon: LayoutDashboard },
    { to: "/directory", label: "Explore dojos", icon: Compass },
    ...(sensei ? [{ to: "/leads", label: "Trial pipeline", icon: UsersRound }] : []),
    ...(sensei ? [{ to: "/dojo", label: "Manage dojo", icon: Settings2 }] : []),
    { to: "/media", label: sensei ? "Media library" : "Stories & videos", icon: BookOpen },
    { to: "/progress", label: "Belt progression", icon: Award },
  ];

  return (
    <aside className="sidebar">
      <Link className="brand-lockup" to="/home"><span className="brand-mark"><Flame size={19} fill="currentColor" /></span><span>OSU<span className="brand-dot">.</span></span></Link>
      <div className="sidebar-label">DOJO NETWORK</div>
      <nav aria-label="Main navigation" className="side-nav">
        {links.map(({ to, label, icon: Icon }) => <NavLink className={({ isActive }) => `side-nav-link${isActive ? " active" : ""}`} key={to} to={to}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{to === "/leads" && <span className="nav-indicator" />}</NavLink>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-tip"><span className="sidebar-tip-mark">OSU</span><div><strong>Small steps.</strong><span>Strong spirit.</span></div></div>
      <div className="sidebar-profile">
        <span className="avatar-circle avatar-sidebar">{profile.display_name.slice(0, 1).toUpperCase() || "K"}</span>
        <span className="profile-copy"><strong>{profile.display_name || "Karateka"}</strong><small>{sensei ? "Sensei account" : "Student account"}</small></span>
        <button aria-label="Sign out" className="icon-button sign-out-button" disabled={!online} onClick={onSignOut} title={online ? "Sign out" : "Reconnect before signing out"} type="button"><LogOut size={17} /></button>
      </div>
    </aside>
  );
}

function AuthenticatedApp({ client, session, onSignOut, online }: { client: AppDatabase; session: Session; onSignOut: () => void; online: boolean }) {
  const profile = useQuery({
    queryKey: ["profile", session.user.id],
    queryFn: () => getProfile(client, session.user.id),
    staleTime: 5 * 60 * 1000,
  });

  if (profile.isPending) return <LoadingState label="Opening your dojo workspace" />;
  if (profile.error) return <main className="auth-layout"><div className="auth-panel"><div className="auth-panel-inner"><ErrorState message={profile.error.message} /><button className="button button-secondary" onClick={onSignOut} type="button">Sign out</button></div></div></main>;
  if (!profile.data) return <ErrorState message="Your profile could not be found. Contact your dojo network administrator." />;

  const userProfile = profile.data;
  return (
    <div className="app-layout">
      <Navigation profile={userProfile} onSignOut={onSignOut} online={online} />
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb"><span>OSU NETWORK</span><span className="breadcrumb-separator">/</span><strong>{userProfile.role === "sensei" ? "SENSEI WORKSPACE" : "STUDENT SPACE"}</strong></div>
          <div className="topbar-actions"><span className={`connection-state${online ? "" : " connection-offline"}`}><span />{online ? "Connected" : "Offline · read only"}</span><span className="topbar-avatar">{userProfile.display_name.slice(0, 1).toUpperCase() || "K"}</span></div>
        </header>
        <main className="app-content">
          {!online && <div className="info-banner offline-banner"><Activity size={17} /><span>Offline. Browsing cached data in read-only mode; reconnect to make changes.</span></div>}
          <fieldset className="route-surface" disabled={!online}>
            <Suspense fallback={<LoadingState label="Opening workspace" />}>
              <Routes>
                <Route path="/home" element={<Dashboard client={client} profile={userProfile} />} />
                <Route path="/directory" element={<Directory client={client} profile={userProfile} email={session.user.email ?? ""} online={online} onRequestSignIn={() => undefined} />} />
                <Route path="/leads" element={userProfile.role === "sensei" ? <Leads client={client} profile={userProfile} online={online} /> : <Navigate replace to="/home" />} />
                <Route path="/dojo" element={userProfile.role === "sensei" ? <DojoSettings client={client} profile={userProfile} online={online} /> : <Navigate replace to="/home" />} />
                <Route path="/media" element={<MediaLibrary client={client} profile={userProfile} />} />
                <Route path="/progress" element={<Progression client={client} profile={userProfile} />} />
                <Route path="*" element={<Navigate replace to="/home" />} />
              </Routes>
            </Suspense>
          </fieldset>
        </main>
        <footer className="app-footer"><span><Activity size={14} />Your dojo network, in one place.</span><span>OSU · KYOKUSHIN</span></footer>
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  const online = useOnlineStatus();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthError(null);
      setLoadingSession(false);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      else setSession(data.session);
      setLoadingSession(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthError(error instanceof Error ? error.message : "Could not restore the saved sign-in session.");
      setLoadingSession(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!supabase || supabaseConfigurationError) {
    return <SetupScreen message={supabaseConfigurationError ?? "Supabase configuration is unavailable."} />;
  }

  const client: AppDatabase = supabase;
  const signIn = async (email: string, password: string) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign in.");
      return false;
    } finally {
      setAuthBusy(false);
    }
  };
  const signUp = async (name: string, email: string, password: string) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { error } = await client.auth.signUp({ email, password, options: { data: { display_name: name } } });
      if (error) throw error;
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not create your account.");
      return false;
    } finally {
      setAuthBusy(false);
    }
  };
  const resetPassword = async (email: string) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not request a password reset.");
      return false;
    } finally {
      setAuthBusy(false);
    }
  };
  const signOut = () => {
    void client.auth.signOut().then(({ error }) => {
      if (error) throw error;
    }).catch((error: unknown) => {
      setAuthError(error instanceof Error ? error.message : "Could not sign out.");
    });
  };

  if (loadingSession) return <LoadingState label="Checking your secure sign-in" />;
  if (session) return <AuthenticatedApp client={client} onSignOut={signOut} online={online} session={session} />;
  if (location.pathname === "/directory") return <PublicDirectory client={client} online={online} />;

  return <AuthScreen busy={authBusy} error={authError} online={online} onResetPassword={resetPassword} onSignIn={signIn} onSignUp={signUp} />;
}

export default App;

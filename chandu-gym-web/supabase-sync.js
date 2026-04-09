import { SUPABASE_CONFIG } from "./supabase-config.js";

const TABLE_NAME = "workout_states";

export function initSupabaseSync({
  getStateSnapshot,
  replaceState,
  sanitizeState,
  showToast,
}) {
  const listeners = new Set();
  const configured =
    Boolean(SUPABASE_CONFIG.url) &&
    Boolean(SUPABASE_CONFIG.anonKey) &&
    typeof window.supabase?.createClient === "function";

  let client = null;
  let session = null;
  let snapshot = {
    configured,
    session: null,
    status: configured ? "booting" : "not_configured",
    message: configured
      ? "Supabase is booting."
      : "Add your Supabase project URL and anon key to supabase-config.js to enable cloud sync.",
    lastSyncedAt: null,
  };

  function emit() {
    listeners.forEach((listener) => listener({ ...snapshot }));
  }

  function updateSnapshot(patch) {
    snapshot = { ...snapshot, ...patch, session };
    emit();
  }

  function compareStates(localState, remoteState) {
    const localUpdatedAt = localState.updatedAt || localState.createdAt || "";
    const remoteUpdatedAt = remoteState.updatedAt || remoteState.createdAt || "";

    if (remoteUpdatedAt > localUpdatedAt) {
      return "remote";
    }

    if (localUpdatedAt > remoteUpdatedAt) {
      return "local";
    }

    const localSessions = Array.isArray(localState.sessions) ? localState.sessions.length : 0;
    const remoteSessions = Array.isArray(remoteState.sessions) ? remoteState.sessions.length : 0;

    if (remoteSessions > localSessions) {
      return "remote";
    }

    if (localSessions > remoteSessions) {
      return "local";
    }

    return "equal";
  }

  async function pushState(reason = "manual") {
    if (!configured || !client || !session?.user) {
      return false;
    }

    updateSnapshot({
      status: "syncing",
      message: reason === "manual" ? "Syncing to Supabase." : "Syncing recent changes to Supabase.",
    });

    const appState = getStateSnapshot();
    const { error } = await client.from(TABLE_NAME).upsert(
      {
        user_id: session.user.id,
        app_state: appState,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      updateSnapshot({
        status: "error",
        message: `Sync failed: ${error.message}`,
      });
      return false;
    }

    updateSnapshot({
      status: "synced",
      message: "Cloud backup is current.",
      lastSyncedAt: new Date().toISOString(),
    });
    return true;
  }

  async function reconcileRemote(reason = "manual") {
    if (!configured || !client || !session?.user) {
      return false;
    }

    updateSnapshot({
      status: "syncing",
      message: reason === "auth" ? "Loading your cloud state." : "Comparing local and cloud state.",
    });

    const { data, error } = await client
      .from(TABLE_NAME)
      .select("app_state, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      updateSnapshot({
        status: "error",
        message: `Could not read cloud state: ${error.message}`,
      });
      return false;
    }

    const localState = getStateSnapshot();

    if (!data?.app_state) {
      const uploaded = await pushState("first_sync");
      if (uploaded) {
        showToast("Supabase is connected. Your local workout data is now backed up.");
      }
      return uploaded;
    }

    const remoteState = sanitizeState(data.app_state);
    const winner = compareStates(localState, remoteState);

    if (winner === "remote") {
      replaceState(remoteState);
      updateSnapshot({
        status: "synced",
        message: "Loaded the latest state from Supabase.",
        lastSyncedAt: data.updated_at || new Date().toISOString(),
      });
      showToast("Loaded your latest workout data from Supabase.");
      return true;
    }

    if (winner === "local") {
      return pushState("local_newer");
    }

    updateSnapshot({
      status: "synced",
      message: "Local and cloud state already match.",
      lastSyncedAt: data.updated_at || new Date().toISOString(),
    });
    return true;
  }

  async function sendMagicLink(email) {
    if (!configured || !client) {
      return { error: new Error("Supabase is not configured yet.") };
    }

    updateSnapshot({
      status: "sending_link",
      message: "Sending your magic link.",
    });

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: SUPABASE_CONFIG.redirectTo,
      },
    });

    if (error) {
      updateSnapshot({
        status: "error",
        message: `Magic link failed: ${error.message}`,
      });
      return { error };
    }

    updateSnapshot({
      status: "awaiting_link",
      message: "Magic link sent. Open it on any device where you want the workout data synced.",
    });
    return { error: null };
  }

  async function signOut() {
    if (!client) {
      return;
    }

    const { error } = await client.auth.signOut();
    if (error) {
      updateSnapshot({
        status: "error",
        message: `Sign-out failed: ${error.message}`,
      });
      return;
    }

    session = null;
    updateSnapshot({
      status: "signed_out",
      message: "Signed out. Local workout data still stays on this browser.",
    });
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener({ ...snapshot });
    return () => listeners.delete(listener);
  }

  if (configured) {
    client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

    client.auth.getSession().then(({ data, error }) => {
      if (error) {
        updateSnapshot({
          status: "error",
          message: `Auth session check failed: ${error.message}`,
        });
        return;
      }

      session = data.session ?? null;
      if (session?.user) {
        updateSnapshot({
          status: "signed_in",
          message: `Signed in as ${session.user.email || "your account"}.`,
        });
        reconcileRemote("auth");
      } else {
        updateSnapshot({
          status: "signed_out",
          message: "Supabase is configured. Sign in with a magic link to sync across devices.",
        });
      }
    });

    client.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession ?? null;
      if (session?.user) {
        updateSnapshot({
          status: "signed_in",
          message: `Signed in as ${session.user.email || "your account"}.`,
        });
        reconcileRemote("auth");
      } else {
        updateSnapshot({
          status: "signed_out",
          message: "Supabase is configured. Sign in with a magic link to sync across devices.",
        });
      }
    });
  }

  return {
    subscribe,
    sendMagicLink,
    signOut,
    pushState,
    reconcileRemote,
    isConfigured: () => configured,
    getSnapshot: () => ({ ...snapshot }),
  };
}

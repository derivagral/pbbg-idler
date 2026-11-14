import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  SKILLS,
  SKILL_INFO,
  TIERS,
  type Activity,
  type Character,
  type Skill,
  type Snapshot,
} from "@idler/contracts";
const StateViewer = lazy(() => import("./viewer/StateViewer"));
const colors: Record<Skill, string> = {
  woodcutting: "#adbf8d",
  mining: "#c8b695",
  fishing: "#89b5b7",
  foraging: "#b6a4c9",
};

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    woodcutting: (
      <>
        <path d="m12 3-6 8h3l-5 7h6v4h4v-4h6l-5-7h3z" />
      </>
    ),
    mining: (
      <>
        <path d="m4 8 6-4 8 1 3 6-6-2-3 3-4-2z" />
        <path d="m13 10-8 12" />
      </>
    ),
    fishing: (
      <>
        <path d="M3 12c6-8 12-8 16 0-4 8-10 8-16 0Zm16 0 4-4v8z" />
        <circle cx="8" cy="11" r="1" />
      </>
    ),
    foraging: (
      <>
        <path d="M6 19C2 8 8 2 20 3c1 12-5 18-14 16Z" />
        <path d="m5 21 11-12M9 16v-5m4 1h5" />
      </>
    ),
    combat: (
      <>
        <path d="m5 3 14 14m-3-14L3 16m15-1 4 4-3 3-4-4M2 18l4 4m12-19h3v3" />
      </>
    ),
    rest: (
      <>
        <path d="M19 15A8 8 0 0 1 9 4a8 8 0 1 0 10 11Z" />
      </>
    ),
    bag: (
      <>
        <path d="m9 3 2 4h3l2-4Zm2 4C0 18 4 22 12 22s12-4 2-15M5 17h14" />
      </>
    ),
    leaf: (
      <>
        <path d="M4 20 17 7M4 16C2 4 11 3 21 3c0 11-4 19-17 13Z" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    cube: (
      <>
        <path d="m12 2 9 5v10l-9 5-9-5V7zm0 10 9-5M3 7l9 5v10" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.leaf}
    </svg>
  );
}
function WorldArt() {
  const trees = [
    [50, 64, 1.3],
    [90, 43, 0.9],
    [130, 75, 1.2],
    [173, 43, 0.8],
    [223, 64, 1.1],
    [265, 40, 0.8],
    [307, 68, 0.7],
    [72, 109, 0.8],
    [117, 129, 1],
    [40, 157, 1.2],
    [85, 196, 0.9],
    [146, 222, 1.3],
    [196, 248, 0.9],
    [237, 219, 0.8],
    [294, 255, 1.2],
    [346, 232, 0.8],
    [393, 250, 1.1],
    [468, 218, 0.9],
    [513, 252, 1.2],
    [566, 229, 0.9],
    [608, 249, 1.3],
    [651, 215, 0.7],
    [683, 237, 1],
    [689, 77, 1.3],
    [642, 53, 1],
    [591, 78, 0.8],
    [542, 48, 1],
    [495, 67, 0.9],
    [450, 43, 1.2],
  ];
  return (
    <svg
      className="world-art"
      viewBox="0 0 740 300"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="A map of the Hearthwild: forest, mine, fishing stream and herb meadow"
    >
      <defs>
        <linearGradient id="land" x2="1" y2="1">
          <stop stopColor="#2d4438" />
          <stop offset="1" stopColor="#42533c" />
        </linearGradient>
        <linearGradient id="water" x2="1" y2="1">
          <stop stopColor="#638e8e" />
          <stop offset="1" stopColor="#355e63" />
        </linearGradient>
        <pattern
          id="grain"
          width="27"
          height="25"
          patternUnits="userSpaceOnUse"
        >
          <path d="m4 6 2 3m13 9 2-4" stroke="#bbc89d" opacity=".1" />
        </pattern>
      </defs>
      <path fill="url(#land)" d="M0 0h740v300H0z" />
      <path fill="url(#grain)" d="M0 0h740v300H0z" />
      <path
        fill="#1a302c"
        opacity=".5"
        d="m0 80 100-55 151 9 113 35 157-50 219 39V0H0ZM0 258l193-27 181 34 151-28 215 19v44H0Z"
      />
      <path
        d="M389-30c-41 59 8 91 21 119s-4 65 22 92 3 62-18 125"
        fill="none"
        stroke="#738b6a"
        strokeWidth="41"
        opacity=".35"
      />
      <path
        d="M389-30c-41 59 8 91 21 119s-4 65 22 92 3 62-18 125"
        fill="none"
        stroke="url(#water)"
        strokeWidth="30"
      />
      <g stroke="#aed0c6" opacity=".3" fill="none">
        <path d="m391 78 17 3m7 90 23 1m-18 85 14 1m-43-224 10 2m12 177 20 2" />
      </g>
      <path
        d="M-20 209c126-40 180-90 247-84s88 75 155 65 122-70 178-80 143 28 200 16"
        fill="none"
        stroke="#c3ac78"
        strokeWidth="12"
        opacity=".35"
        strokeDasharray="1 2"
      />
      <path
        d="m399 177 48-6 4 19-48 6Z"
        fill="#a18c61"
        stroke="#263a32"
        strokeWidth="3"
      />
      <path
        d="m410 176 3 17m7-18 3 17m7-18 3 17m7-18 3 17"
        stroke="#645b41"
        strokeWidth="2"
      />
      {trees.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(${s})`}>
          <ellipse cy="25" rx="17" ry="6" fill="#162e25" opacity=".45" />
          <path d="M-2 12h4v17h-4" fill="#847955" />
          <path
            d="m0-23-17 30h7l-12 14h44L10 7h7Z"
            fill={i % 3 === 0 ? "#223e31" : i % 3 === 1 ? "#36543b" : "#496346"}
          />
          <path d="M0-23v44h22L10 7h7Z" fill="#152f28" opacity=".26" />
        </g>
      ))}
      <g transform="translate(565,105)">
        <ellipse rx="42" ry="24" fill="#20322e" opacity=".6" />
        <path d="m-39 9 7-31 19-14L7-25 21-8 32 1 23 16h-55Z" fill="#7e8371" />
        <path
          d="m-13-36 4 27-23-13m23 13L7-25l14 17M-9-9 23 16"
          fill="none"
          stroke="#a5a58c"
          strokeWidth="2"
          opacity=".5"
        />
        <path d="M-12 14V0C-12-13 9-13 9 0v14" fill="#1a2a27" />
        <path
          d="m-18-1 6-14 18 1 9 13"
          stroke="#bea577"
          strokeWidth="3"
          fill="none"
        />
      </g>
      <g transform="translate(318,164)">
        <ellipse cy="24" rx="30" ry="8" fill="#223a2e" opacity=".5" />
        <path d="m-25 21 25-43 25 43Z" fill="#d1b67d" />
        <path d="m0-22 4 43h21Z" fill="#95875c" />
        <path d="m-9 21 9-24 9 24" fill="#3c4533" />
        <path
          d="m-29 21 29-47 29 47"
          stroke="#dbc38d"
          fill="none"
          strokeWidth="2"
        />
      </g>
      <g fill="#a7b47b">
        {[
          [512, 184],
          [533, 174],
          [552, 197],
          [568, 178],
          [502, 205],
          [589, 199],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x},${y})`}>
            <path
              d="M0 8V-4m0 5c-12-9-11 5 0 5M0 2C9-9 14 3 0 7"
              stroke="#9cbd84"
              fill="#819b67"
            />
            <circle cy="-5" r="3" fill="#c6b6c9" />
          </g>
        ))}
      </g>
      <g transform="translate(310,201)">
        <ellipse rx="7" ry="3" fill="#182d27" />
        <path d="M-2-14h4L5-2H-5Z" fill="#d9b984" />
        <circle cy="-18" r="4" fill="#e3c7a0" />
      </g>
      <g transform="translate(223,169)" fill="#8e7f67">
        <ellipse rx="9" ry="5" />
        <circle cx="8" cy="-2" r="4" />
        <path
          d="M-7 1q-15-15-18-2"
          fill="none"
          stroke="#9d8c76"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
function activityName(activity: Activity) {
  return activity.kind === "gather"
    ? SKILL_INFO[activity.skill].name
    : activity.kind === "combat"
      ? "Auto-combat"
      : "Resting";
}
class ViewerBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="viewer-message" role="status">
        The 3D viewer is unavailable. Your activity continues normally.
      </p>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [authMode, setAuthMode] = useState<"register" | "login">("register"),
    [viewer, setViewer] = useState(false),
    [notice, setNotice] = useState("");
  const requestId = useRef(0),
    busyRef = useRef(false),
    mounted = useRef(true);
  const accept = (next: Snapshot) => {
    setSnapshot(next);
    if (next.catchup.capped)
      setNotice(
        "Welcome back. Your last 24 hours of idle progress have been collected.",
      );
    else if (next.catchup.ticks > 5)
      setNotice(
        `Welcome back. ${next.catchup.ticks.toLocaleString()} idle ticks have been collected.`,
      );
  };
  useEffect(() => {
    mounted.current = true;
    let controller: AbortController | null = null;
    const poll = async () => {
      if (busyRef.current) return;
      const id = ++requestId.current;
      controller = new AbortController();
      try {
        const response = await fetch("/api/state", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!mounted.current || id !== requestId.current) return;
        if (response.status === 401) {
          setSnapshot(null);
          return;
        }
        const data = await response.json();
        if (!response.ok)
          throw Error(data.error || "Could not reach the world.");
        accept(data);
        setError("");
      } catch (e) {
        if (
          mounted.current &&
          id === requestId.current &&
          (e as Error).name !== "AbortError"
        )
          setError("Connection interrupted. Reconnecting to your world…");
      } finally {
        if (mounted.current) setLoading(false);
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 1000);
    return () => {
      mounted.current = false;
      controller?.abort();
      clearInterval(interval);
    };
  }, []);
  const mutate = async (path: string, body?: unknown) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const id = ++requestId.current;
    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "The request could not be completed.");
      if (id === requestId.current) {
        if (path.endsWith("logout")) {
          setSnapshot(null);
          setViewer(false);
          setNotice("");
          setAuthMode("login");
        } else accept(data);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const act = (activity: Activity) => void mutate("/api/activity", activity);
  const character = snapshot?.character;
  const totalItems =
    character?.inventory.reduce((sum, item) => sum + item.quantity, 0) || 0;
  if (loading)
    return (
      <main className="loading-screen">
        <Icon name="leaf" size={42} />
        <p>Finding your place in the wild…</p>
      </main>
    );
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Hearthwild home">
          <span className="brand-mark">
            <Icon name="leaf" size={25} />
          </span>
          <span>
            HEARTHWILD<small>A PERSISTENT LITTLE WORLD</small>
          </span>
        </a>
        <div className="header-right">
          <span className="world-status">
            <i /> World online <span className="muted">/ 2s ticks</span>
          </span>
          {snapshot && (
            <button
              className="text-button"
              onClick={() => void mutate("/api/auth/logout")}
              disabled={busy}
            >
              Log out <Icon name="arrow" size={14} />
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="global-message error" role="alert">
          {error}
        </div>
      )}
      {!snapshot ? (
        <main className="welcome">
          <section className="welcome-story">
            <p className="eyebrow">A QUIETER KIND OF ADVENTURE</p>
            <h1>
              Make a little
              <br />
              headway.
            </h1>
            <p className="welcome-copy">
              An old grove. A patient river. A world that keeps
              <br className="desktop-break" /> turning, even when you step away.
            </p>
            <div className="welcome-map">
              <WorldArt />
              <span className="map-coordinate">THE HEARTHWILD · 00, 00</span>
            </div>
            <div className="welcome-features">
              <span>
                <Icon name="woodcutting" size={18} /> Four gathering skills
              </span>
              <span>
                <Icon name="combat" size={18} /> Idle combat
              </span>
              <span>
                <Icon name="rest" size={18} /> Persistent progress
              </span>
            </div>
          </section>
          <section className="entry-panel">
            <span className="section-number">YOUR STORY STARTS HERE</span>
            <h2>A place by the fire.</h2>
            <p className="subtle">
              Create an account or return to your character.
            </p>
            <div
              className="auth-tabs"
              role="tablist"
              aria-label="Account access"
            >
              <button
                role="tab"
                aria-selected={authMode === "register"}
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                }}
              >
                Create account
              </button>
              <button
                role="tab"
                aria-selected={authMode === "login"}
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                }}
              >
                Log in
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void mutate(`/api/auth/${authMode}`, {
                  username: data.get("username"),
                  password: data.get("password"),
                });
              }}
            >
              <label>
                Username
                <input
                  name="username"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_]+"
                  placeholder="Your account name"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    authMode === "register"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                  minLength={8}
                  maxLength={128}
                  placeholder="At least 8 characters"
                />
              </label>
              <button className="primary-button" disabled={busy}>
                {busy
                  ? "Opening the gate…"
                  : authMode === "register"
                    ? "Create account & enter"
                    : "Log in"}
                <Icon name="arrow" size={18} />
              </button>
            </form>
            <p className="entry-note">
              <Icon name="leaf" size={16} /> Your progress lives here. Come and
              go as you like.
            </p>
          </section>
        </main>
      ) : !character ? (
        <main className="character-entry">
          <section className="entry-panel">
            <p className="eyebrow">WELCOME, {snapshot.account.username}</p>
            <h1>
              Who walks
              <br />
              the Hearthwild?
            </h1>
            <p className="subtle">
              One character. One quiet corner of the world.
              <br />
              Choose a name and settle in.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate("/api/character", {
                  name: new FormData(e.currentTarget).get("name"),
                });
              }}
            >
              <label>
                Character name
                <input
                  autoFocus
                  name="name"
                  required
                  minLength={2}
                  maxLength={24}
                  pattern="[A-Za-z0-9 '\-]+"
                  placeholder="A name for the trail"
                />
              </label>
              <button disabled={busy} className="primary-button">
                Enter the Hearthwild
                <Icon name="arrow" size={18} />
              </button>
            </form>
          </section>
          <div className="character-map">
            <WorldArt />
            <span className="map-coordinate">
              YOUR FIRST AND ONLY TILE · 00, 00
            </span>
          </div>
        </main>
      ) : (
        <main className="game-layout">
          <aside className="character-sidebar">
            <div className="character-badge">
              <Icon name="leaf" size={30} />
            </div>
            <p className="eyebrow">THE WANDERER</p>
            <h2>{character.name}</h2>
            <p className="account-name">@{snapshot.account.username}</p>
            <div className="sidebar-divider" />
            <p className="mini-label">CURRENT ACTIVITY</p>
            <div className="current-activity">
              <Icon
                name={
                  character.activity.kind === "gather"
                    ? character.activity.skill
                    : character.activity.kind === "combat"
                      ? "combat"
                      : "rest"
                }
              />
              <span>
                {activityName(character.activity)}
                <small>
                  {character.activity.kind === "idle"
                    ? "Taking a moment."
                    : "Working every 2 seconds"}
                </small>
              </span>
            </div>
            <div className="health-label">
              <span>Health</span>
              <strong>
                {character.hp} / {character.maxHp}
              </strong>
            </div>
            <progress
              aria-label="Character health"
              max={character.maxHp}
              value={character.hp}
            />
            <p className="health-note">Rest to recover 3 HP per tick.</p>
            <button
              className={`rest-button ${character.activity.kind === "idle" ? "selected" : ""}`}
              onClick={() => act({ kind: "idle" })}
              disabled={busy || character.activity.kind === "idle"}
            >
              <Icon name="rest" size={17} /> Rest
              {character.activity.kind === "idle" && (
                <span className="active-dot" />
              )}
            </button>
            <div className="sidebar-bottom">
              <div>
                <span>Ticks lived</span>
                <strong data-testid="tick-count">
                  {character.ticks.toLocaleString()}
                </strong>
              </div>
              <div>
                <span>Items gathered</span>
                <strong>{totalItems.toLocaleString()}</strong>
              </div>
              <p>
                <i /> Progress saved on the server.
                <br />
                Keeps going while you're away.
              </p>
            </div>
          </aside>
          <div className="main-column">
            <div className="world-title">
              <div>
                <p className="eyebrow">
                  REGION 01 <span className="title-dot">·</span> A PLACE TO
                  BEGIN
                </p>
                <h1>
                  The Hearthwild
                  <span className="title-leaf">
                    <Icon name="leaf" size={27} />
                  </span>
                </h1>
                <p>A small clearing. More than enough to start.</p>
              </div>
              <span className="coordinate-badge">⌖ 00, 00</span>
            </div>
            {notice && (
              <div className="catchup-notice" role="status">
                {notice}
                <button
                  aria-label="Dismiss progress summary"
                  onClick={() => setNotice("")}
                >
                  ×
                </button>
              </div>
            )}
            <section className="map-panel" aria-label="Hearthwild map">
              <WorldArt />
              <div className="map-topline">
                <span>
                  <i /> HEARTHWILD CLEARING
                </span>
                <span>ONE TILE · FOUR OPPORTUNITIES</span>
              </div>
              <button
                className={`map-node node-wood ${character.activity.kind === "gather" && character.activity.skill === "woodcutting" ? "node-active" : ""}`}
                aria-label="Select woodcutting on map"
                onClick={() => act({ kind: "gather", skill: "woodcutting" })}
                disabled={busy}
              >
                <Icon name="woodcutting" size={18} />
              </button>
              <button
                className="map-node node-mine"
                aria-label="Select mining on map"
                onClick={() => act({ kind: "gather", skill: "mining" })}
                disabled={busy}
              >
                <Icon name="mining" size={18} />
              </button>
              <button
                className="map-node node-fish"
                aria-label="Select fishing on map"
                onClick={() => act({ kind: "gather", skill: "fishing" })}
                disabled={busy}
              >
                <Icon name="fishing" size={18} />
              </button>
              <button
                className="map-node node-herb"
                aria-label="Select foraging on map"
                onClick={() => act({ kind: "gather", skill: "foraging" })}
                disabled={busy}
              >
                <Icon name="foraging" size={18} />
              </button>
              <span className="map-player">
                {character.name}
                <span>YOU ARE HERE</span>
              </span>
              <div className="map-caption">
                <span>Time moves. Your work continues.</span>
                <button
                  className="viewer-button"
                  aria-expanded={viewer}
                  onClick={() => setViewer((v) => !v)}
                >
                  <Icon name="cube" size={15} />
                  {viewer ? "Close 3D viewer" : "Open 3D viewer"}
                </button>
              </div>
            </section>
            {viewer && (
              <section
                className="viewer-panel"
                aria-label="Optional 3D state viewer"
              >
                <div className="viewer-heading">
                  <span className="mini-label">A WINDOW INTO THE WORLD</span>
                  <span>Read-only state viewer</span>
                </div>
                <ViewerBoundary>
                  <Suspense
                    fallback={
                      <p className="viewer-message">Opening the 3D viewer…</p>
                    }
                  >
                    <StateViewer character={character} />
                  </Suspense>
                </ViewerBoundary>
              </section>
            )}
            <section className="gathering-section">
              <div className="section-heading">
                <h2>Put down roots.</h2>
                <span>CHOOSE AN ACTIVITY</span>
              </div>
              <div className="skill-grid">
                {SKILLS.map((skill, index) => {
                  const active =
                    character.activity.kind === "gather" &&
                    character.activity.skill === skill;
                  return (
                    <article
                      className={`skill-card ${active ? "is-active" : ""}`}
                      key={skill}
                      style={
                        {
                          "--skill-color": colors[skill],
                        } as React.CSSProperties
                      }
                    >
                      <div className="skill-card-top">
                        <span className="skill-icon">
                          <Icon name={skill} size={25} />
                        </span>
                        <span className="skill-number">0{index + 1}</span>
                      </div>
                      <h3>{SKILL_INFO[skill].name}</h3>
                      <p>{SKILL_INFO[skill].description}</p>
                      <div className="skill-stat">
                        <span>
                          {character.skills[skill].actions.toLocaleString()}{" "}
                          actions
                        </span>
                        <strong>
                          {character.skills[skill].items.toLocaleString()}
                          <small> items</small>
                        </strong>
                      </div>
                      <button
                        aria-label={`Gather ${SKILL_INFO[skill].resource}`}
                        className="skill-button"
                        disabled={busy || active}
                        onClick={() => act({ kind: "gather", skill })}
                      >
                        {active ? (
                          <>
                            <span className="active-dot" /> Gathering{" "}
                            {SKILL_INFO[skill].resource.toLowerCase()}
                          </>
                        ) : (
                          <>
                            Gather {SKILL_INFO[skill].resource}
                            <Icon name="arrow" size={16} />
                          </>
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
              <p className="gathering-footnote">
                One activity at a time. Each tick rolls a reward tier; rarer
                finds yield fewer items.
              </p>
            </section>
            <section
              className={`combat-panel ${character.activity.kind === "combat" ? "combat-active" : ""}`}
              aria-labelledby="combat-heading"
            >
              <div className="combat-icon">
                <Icon name="combat" size={28} />
              </div>
              <div className="combat-description">
                <p className="mini-label">AT THE EDGE OF THE CLEARING</p>
                <h2 id="combat-heading">A little trouble in the brush.</h2>
                <p>Bramble rat · 1v1 auto-combat · 6 attack / 3 retaliation</p>
                <div className="enemy-health">
                  <span>{character.combat.enemyName}</span>
                  <progress
                    aria-label="Bramble rat health"
                    max={character.combat.enemyMaxHp}
                    value={character.combat.enemyHp}
                  />
                  <span>
                    {character.combat.enemyHp}/{character.combat.enemyMaxHp} HP
                  </span>
                </div>
              </div>
              <div className="combat-controls">
                <span>
                  <strong>{character.combat.wins}</strong> wins{" "}
                  <span className="title-dot">·</span>{" "}
                  <strong>{character.combat.defeats}</strong> defeats
                </span>
                <button
                  onClick={() => act({ kind: "combat" })}
                  disabled={busy || character.activity.kind === "combat"}
                >
                  {character.activity.kind === "combat" ? (
                    <>
                      <span className="active-dot" /> Fighting
                    </>
                  ) : (
                    "Fight Bramble rat"
                  )}
                  {character.activity.kind !== "combat" && (
                    <Icon name="arrow" size={16} />
                  )}
                </button>
              </div>
            </section>
            <footer className="world-footer">
              <span>THE HEARTHWILD · VERTICAL SLICE 01</span>
              <span>Gather. Fight. Rest. Return.</span>
            </footer>
          </div>
          <aside className="journal-sidebar">
            <section
              className="inventory-panel"
              aria-labelledby="inventory-heading"
            >
              <div className="section-heading">
                <h2 id="inventory-heading">
                  <Icon name="bag" size={19} /> Inventory
                </h2>
                <span>{totalItems.toLocaleString()} ITEMS</span>
              </div>
              <p className="inventory-intro">
                Small finds, steadily collected.
              </p>
              <div className="tier-legend">
                <span>RESOURCE</span>
                <div>
                  {TIERS.map((tier) => (
                    <span
                      key={tier.tier}
                      title={`${tier.label}: ${tier.weight}% chance, ${tier.quantity} items`}
                      className={`tier tier-${tier.tier}`}
                    >
                      {tier.tier}
                    </span>
                  ))}
                </div>
              </div>
              {SKILLS.map((skill) => (
                <div className="inventory-row" key={skill}>
                  <span
                    className="inventory-resource"
                    style={{ color: colors[skill] }}
                  >
                    <Icon name={skill} size={17} />
                    {SKILL_INFO[skill].resource}
                  </span>
                  <div>
                    {TIERS.map((tier) => {
                      const quantity =
                        character.inventory.find(
                          (stack) =>
                            stack.skill === skill && stack.tier === tier.tier,
                        )?.quantity || 0;
                      return (
                        <span
                          className={`inventory-quantity ${quantity ? "has-items" : ""}`}
                          key={tier.tier}
                          aria-label={`${SKILL_INFO[skill].resource} tier ${tier.tier}: ${quantity}`}
                          title={`${tier.label} ${SKILL_INFO[skill].resource}`}
                        >
                          {quantity ? quantity.toLocaleString() : "—"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              <details className="reward-details">
                <summary>
                  How reward tiers work <span>+</span>
                </summary>
                <div>
                  {TIERS.map((tier) => (
                    <p key={tier.tier}>
                      <span className={`tier tier-${tier.tier}`}>
                        T{tier.tier} {tier.label}
                      </span>
                      <span>
                        {tier.weight}% · {tier.quantity} items
                      </span>
                    </p>
                  ))}
                </div>
              </details>
            </section>
            <section
              className="journal-panel"
              aria-labelledby="journal-heading"
            >
              <div className="section-heading">
                <h2 id="journal-heading">Field notes</h2>
                <span>LIVE JOURNAL</span>
              </div>
              <p className="inventory-intro">The little things add up.</p>
              <ol className="event-list">
                {[...character.events].reverse().map((event) => (
                  <li key={event.id}>
                    <span className={`event-dot event-${event.kind}`} />
                    <div>
                      <p>{event.text}</p>
                      <time dateTime={new Date(event.at).toISOString()}>
                        {new Date(event.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
              {!character.events.length && (
                <p className="empty-journal">
                  A fresh page.
                  <br />
                  Choose an activity to begin your story.
                </p>
              )}
            </section>
            <p className="offline-note">
              <Icon name="rest" size={17} />
              <span>
                Step away anytime.
                <br />
                Up to 24 hours of idle progress waits for you.
              </span>
            </p>
          </aside>
        </main>
      )}
    </div>
  );
}

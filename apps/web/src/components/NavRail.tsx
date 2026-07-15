import { useRouter } from "../lib/router";
import { useSession } from "../lib/session";

export function NavRail() {
  const { path, navigate } = useRouter();
  const { jobId } = useSession();

  // Extract job ID from current route as fallback when session has none
  const forgeMatch = path.match(/^\/forge\/([^/]+)/);
  const studioMatch = path.match(/^\/studio\/([^/]+)/);
  const activeJobId = jobId ?? forgeMatch?.[1] ?? studioMatch?.[1];

  const links = [
    { to: "/", code: "LIB", label: "Library" },
    { to: "/create", code: "NEW", label: "Create" },
    {
      to: activeJobId ? `/forge/${activeJobId}` : null,
      code: "RUN",
      label: "Forge",
      needsJob: true,
    },
    {
      to: activeJobId ? `/studio/${activeJobId}` : null,
      code: "MIX",
      label: "Studio",
      needsJob: true,
    },
  ];

  return (
    <nav class="nav-rail">
      <div class="nav-logo">
        <div class="nav-logo-bg">
          <div class="nav-logo-icon" />
        </div>
      </div>
      <div class="nav-items">
        {links.map((link) => {
          const disabled = link.needsJob && !activeJobId;
          const active = link.to
            ? link.to === "/"
              ? path === "/"
              : path === link.to
            : link.code === "RUN"
              ? path.startsWith("/forge/")
              : link.code === "MIX"
                ? path.startsWith("/studio/")
                : false;
          return (
            <button
              key={link.code}
              class={`nav-btn${active ? " active" : ""}`}
              title={link.label}
              disabled={disabled}
              style={
                disabled ? { opacity: 0.35, cursor: "not-allowed" } : undefined
              }
              onClick={() => {
                if (!disabled && link.to) navigate(link.to);
              }}
            >
              <span class="nav-btn-code">{link.code}</span>
              <span class="nav-btn-label">{link.label}</span>
            </button>
          );
        })}
      </div>
      <div class="nav-brand">
        <span class="nav-brand-dot" />
        <span>TRACK FORGE</span>
      </div>
    </nav>
  );
}

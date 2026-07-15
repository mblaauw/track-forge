import { useRouter } from "../lib/router";
import { useSession } from "../lib/session";

export function NavRail() {
  const { path, navigate } = useRouter();
  const { jobId } = useSession();

  const links = [
    { to: "/", code: "LIB", label: "Library" },
    { to: "/create", code: "NEW", label: "Create" },
    {
      to: jobId ? `/forge/${jobId}` : null,
      code: "RUN",
      label: "Forge",
      needsJob: true,
    },
    {
      to: jobId ? `/studio/${jobId}` : null,
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
          const disabled = link.needsJob && !jobId;
          const active = link.to
            ? link.to === "/"
              ? path === "/"
              : path.startsWith(link.to)
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

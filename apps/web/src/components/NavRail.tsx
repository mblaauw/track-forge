import { useRouter, Link } from "../lib/router";

export function NavRail() {
  const { path } = useRouter();

  const links = [
    { to: "/", code: "LIB", label: "Library", title: "Library" },
    { to: "/create", code: "NEW", label: "Create", title: "Create" },
    { to: "/forge", code: "RUN", label: "Forge", title: "Forge" },
    { to: "/studio", code: "MIX", label: "Studio", title: "Studio" },
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
          const active = link.to === "/" ? path === "/" : path.startsWith(link.to);
          return (
            <Link to={link.to}>
              <button class={`nav-btn${active ? " active" : ""}`} title={link.title}>
                <span class="nav-btn-code">{link.code}</span>
                <span class="nav-btn-label">{link.label}</span>
              </button>
            </Link>
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

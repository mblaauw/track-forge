import { useRouter, Link } from "../lib/router";

export function NavRail() {
  const { path } = useRouter();

  const links = [
    { to: "/", icon: "ph-books", label: "LIB" },
    { to: "/create", icon: "ph-plus-circle", label: "NEW" },
    { to: "/forge", icon: "ph-lightning", label: "RUN" },
    { to: "/studio", icon: "ph-knife", label: "MIX" },
  ];

  return (
    <nav class="nav-rail">
      <div class="nav-items">
        {links.map((link) => {
          const active = link.to === "/" ? path === "/" : path.startsWith(link.to);
          return (
            <Link to={link.to}>
              <button class={`nav-btn${active ? " active" : ""}`}>
                <i class={link.icon} />
                <span>{link.label}</span>
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

import { Route } from "../lib/router";
import { NavRail } from "./NavRail";
import { TransportBar } from "./TransportBar";
import { Library } from "../pages/Library";
import { CreateSession } from "../pages/CreateSession";
import { Forge } from "../pages/Forge";
import { Studio } from "../pages/Studio";

export function AppShell() {
  return (
    <>
      <NavRail />
      <TransportBar />
      <main class="viewport">
        <Route path="/" component={({ params }) => <Library />} />
        <Route path="/create" component={({ params }) => <CreateSession />} />
        <Route
          path="/forge/:id"
          component={({ params }) => <Forge id={params.id ?? ""} />}
        />
        <Route
          path="/studio/:id"
          component={({ params }) => <Studio id={params.id ?? ""} />}
        />
      </main>
    </>
  );
}

import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";
import App from "./app/App.tsx";
import { i18n } from "./i18n/i18n.ts";
import Dress from "./pages/Dress.tsx";
import Dresses from "./pages/Dresses.tsx";
import Favorites from "./pages/Favorites.tsx";
import Home from "./pages/Home.tsx";
import NotFound from "./pages/NotFound.tsx";
import Shop from "./pages/Shop.tsx";
import "./index.css";

document.documentElement.lang = i18n.lang();

render(
  () => (
    <Router root={App}>
      <Route path="/" component={Home} />
      <Route path="/dresses" component={Dresses} />
      <Route path="/dresses/:id" component={Dress} />
      <Route path="/shops/:slug" component={Shop} />
      <Route path="/favorites" component={Favorites} />
      {/* admin routes: Task 10 */}
      <Route path="*404" component={NotFound} />
    </Router>
  ),
  document.getElementById("root")!,
);

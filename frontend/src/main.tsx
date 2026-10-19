import { Navigate, Route, Router } from "@solidjs/router";
import { lazy } from "solid-js";
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

// Admin pages load on demand so brides never download them.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.tsx"));
const Login = lazy(() => import("./pages/admin/Login.tsx"));
const AdminShops = lazy(() => import("./pages/admin/Shops.tsx"));
const ShopEdit = lazy(() => import("./pages/admin/ShopEdit.tsx"));
const AdminDresses = lazy(() => import("./pages/admin/Dresses.tsx"));
const DressEdit = lazy(() => import("./pages/admin/DressEdit.tsx"));

document.documentElement.lang = i18n.lang();

render(
  () => (
    <Router root={App} scrollRestoration>
      <Route path="/" component={Home} />
      <Route path="/dresses" component={Dresses} />
      <Route path="/dresses/:id" component={Dress} />
      <Route path="/shops/:slug" component={Shop} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/admin/login" component={Login} />
      <Route path="/admin" component={AdminLayout}>
        <Route path="/" component={() => <Navigate href="/admin/shops" />} />
        <Route path="/shops" component={AdminShops} />
        <Route path="/shops/new" component={ShopEdit} />
        <Route path="/shops/:id" component={ShopEdit} />
        <Route path="/dresses" component={AdminDresses} />
        <Route path="/dresses/new" component={DressEdit} />
        <Route path="/dresses/:id" component={DressEdit} />
      </Route>
      <Route path="*404" component={NotFound} />
    </Router>
  ),
  document.getElementById("root")!,
);

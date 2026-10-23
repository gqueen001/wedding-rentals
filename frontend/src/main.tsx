import { Navigate, Route, Router } from "@solidjs/router";
import { lazy } from "solid-js";
import { render } from "solid-js/web";
import App from "./app/App.tsx";
import { i18n } from "./i18n/i18n.ts";
import { trackTraversals } from "./lib/history.ts";
import Dress from "./pages/Dress.tsx";
import Dresses from "./pages/Dresses.tsx";
import Favorites from "./pages/Favorites.tsx";
import Categories from "./pages/Categories.tsx";
import Category from "./pages/Category.tsx";
import Home from "./pages/Home.tsx";
import Item from "./pages/Item.tsx";
import More from "./pages/More.tsx";
import Search from "./pages/Search.tsx";
import NotFound from "./pages/NotFound.tsx";
import Shop from "./pages/Shop.tsx";
import "./index.css";

// Admin and "My shop" pages load on demand so brides never download them.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.tsx"));
const Login = lazy(() => import("./pages/admin/Login.tsx"));
const AdminShops = lazy(() => import("./pages/admin/Shops.tsx"));
const ShopEdit = lazy(() => import("./pages/admin/ShopEdit.tsx"));
const AdminListings = lazy(() => import("./pages/admin/Listings.tsx"));
const NewListing = lazy(() => import("./pages/admin/NewListing.tsx"));
const ItemEdit = lazy(() => import("./pages/admin/ItemEdit.tsx"));
const DressEdit = lazy(() => import("./pages/admin/DressEdit.tsx"));
const ShopLayout = lazy(() => import("./pages/shop/ShopLayout.tsx"));
const ShopLogin = lazy(() => import("./pages/shop/ShopLogin.tsx"));
const ShopSignup = lazy(() => import("./pages/shop/ShopSignup.tsx"));
const MyShop = lazy(() => import("./pages/shop/MyShop.tsx"));
const ShopProfile = lazy(() => import("./pages/shop/ShopProfile.tsx"));

trackTraversals();
document.documentElement.lang = i18n.lang();

render(
  () => (
    <Router root={App} scrollRestoration>
      <Route path="/" component={Home} />
      <Route path="/dresses" component={Dresses} />
      <Route path="/dresses/:id" component={Dress} />
      <Route path="/categories" component={Categories} />
      <Route path="/c/:slug" component={Category} />
      <Route path="/items/:id" component={Item} />
      <Route path="/search" component={Search} />
      <Route path="/shops/:slug" component={Shop} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/more" component={More} />
      <Route path="/admin/login" component={Login} />
      <Route path="/admin" component={AdminLayout}>
        <Route path="/" component={() => <Navigate href="/admin/shops" />} />
        <Route path="/shops" component={AdminShops} />
        <Route path="/shops/new" component={ShopEdit} />
        <Route path="/shops/:id" component={ShopEdit} />
        <Route path="/listings" component={AdminListings} />
        <Route path="/listings/new" component={NewListing} />
        <Route path="/dresses" component={() => <Navigate href="/admin/listings?category=dresses" />} />
        <Route path="/dresses/new" component={DressEdit} />
        <Route path="/dresses/:id" component={DressEdit} />
        <Route path="/items/new" component={ItemEdit} />
        <Route path="/items/:id" component={ItemEdit} />
      </Route>
      <Route path="/shop/signup" component={ShopSignup} />
      <Route path="/shop/login" component={ShopLogin} />
      <Route path="/shop" component={ShopLayout}>
        <Route path="/" component={MyShop} />
        <Route path="/profile" component={ShopProfile} />
        <Route path="/listings/new" component={NewListing} />
        <Route path="/dresses/new" component={DressEdit} />
        <Route path="/dresses/:id" component={DressEdit} />
        <Route path="/items/new" component={ItemEdit} />
        <Route path="/items/:id" component={ItemEdit} />
      </Route>
      <Route path="*404" component={NotFound} />
    </Router>
  ),
  document.getElementById("root")!,
);

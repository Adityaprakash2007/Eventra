import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/components/NotificationCenter";
import RequireAdmin from "@/components/RequireAdmin";
import IntroScreen from "@/components/IntroScreen";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Events from "./pages/Events.tsx";
import EventDetails from "./pages/EventDetails.tsx";
import Register from "./pages/Register.tsx";
import Payment from "./pages/Payment.tsx";
import RazorpayCheckout from "./pages/RazorpayCheckout.tsx";
import Admin from "./pages/Admin.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import MyTickets from "./pages/MyTickets.tsx";
import Scanner from "./pages/Scanner.tsx";
import Organizer from "./pages/Organizer.tsx";
import Profile from "./pages/Profile.tsx";
import Notifications from "./pages/Notifications.tsx";

/**
 * Static-file builds (e.g. preview.html opened directly or on a dumb static host)
 * can't handle history-API paths, so use hash routing there. The dev server and
 * normal deployments get clean BrowserRouter URLs.
 */
const isStaticFileBuild =
  typeof window !== "undefined" &&
  (window.location.protocol === "file:" || window.location.pathname.endsWith(".html"));
const Router = isStaticFileBuild ? HashRouter : BrowserRouter;

const queryClient = new QueryClient();

/** AnimatePresence needs direct route children to track exits. */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetails />} />
        <Route path="/register" element={<Register />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/razorpay-checkout" element={<RazorpayCheckout />} />
        <Route path="/tickets" element={<MyTickets />} />
        <Route path="/tickets/:id" element={<MyTickets />} />
        <Route
          path="/scanner"
          element={
            <RequireAdmin>
              <Scanner />
            </RequireAdmin>
          }
        />
        <Route
          path="/organizer"
          element={
            <RequireAdmin>
              <Organizer />
            </RequireAdmin>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="eventra-theme">
      <AuthProvider>
        <NotificationProvider>
          <TooltipProvider>
            <IntroScreen>
              <Toaster />
              <Sonner />
              <Router>
                <AnimatedRoutes />
              </Router>
            </IntroScreen>
          </TooltipProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

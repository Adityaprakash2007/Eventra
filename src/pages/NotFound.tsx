import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
        <Ticket className="h-7 w-7" />
      </div>
      <h1 className="mt-6 bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-6xl font-black text-transparent">
        404
      </h1>
      <p className="mt-2 text-xl font-semibold">Page not found</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Button asChild className="mt-6 transition-all hover:shadow-glow-sm">
        <Link to="/">Return to Dashboard</Link>
      </Button>
    </div>
  );
};

export default NotFound;

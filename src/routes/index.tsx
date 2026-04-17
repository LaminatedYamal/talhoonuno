import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/auth/AuthProvider";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" /> : <Navigate to="/auth" />;
}

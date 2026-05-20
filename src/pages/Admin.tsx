import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { SubmissionsTable } from '@/components/admin/SubmissionsTable';
import { AdminUsersPanel } from '@/components/admin/AdminUsersPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function Admin() {
  const { user, isAdmin, loading, signOut } = useAuth();

  useEffect(() => {
    document.title = 'Admin · Wizard Submissions | Wizart';
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Forbidden</h1>
          <p className="text-muted-foreground text-sm">
            Your account ({user.email}) does not have admin privileges. Ask an administrator
            to grant you the <code>admin</code> role.
          </p>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Wizard submissions</h1>
            <p className="text-sm text-muted-foreground">All form submissions from the Jesolo vacation wizard.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden md:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>
        <Tabs defaultValue="submissions" className="w-full">
          <TabsList>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="admins">Admin users</TabsTrigger>
          </TabsList>
          <TabsContent value="submissions" className="mt-4">
            <SubmissionsTable />
          </TabsContent>
          <TabsContent value="admins" className="mt-4">
            <AdminUsersPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

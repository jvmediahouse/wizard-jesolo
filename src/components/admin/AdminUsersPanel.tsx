import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type UserRow = {
  user_id: string;
  email: string | null;
  created_at: string;
  is_admin: boolean;
};

export function AdminUsersPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('manage-admins', {
      body: { action: 'list' },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || 'Failed to load users');
      return;
    }
    setUsers(data?.users ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (action: 'grant' | 'revoke' | 'delete', row: UserRow) => {
    if (action === 'revoke' && !confirm(`Revoke admin from ${row.email}?`)) return;
    if (action === 'delete' && !confirm(`Delete ${row.email}? This cannot be undone.`)) return;
    setBusyId(row.user_id);
    const { data, error } = await supabase.functions.invoke('manage-admins', {
      body: { action, user_id: row.user_id },
    });
    setBusyId(null);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || 'Failed');
      return;
    }
    toast.success(
      action === 'grant' ? 'Admin granted' : action === 'revoke' ? 'Admin revoked' : 'User deleted',
    );
    load();
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Signed up</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const isSelf = u.user_id === user?.id;
            const busy = busyId === u.user_id;
            return (
              <TableRow key={u.user_id}>
                <TableCell>
                  {u.email ?? <span className="text-muted-foreground">(no email)</span>}
                  {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {u.is_admin ? (
                    <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                      Admin
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">User</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {u.is_admin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || isSelf}
                        onClick={() => run('revoke', u)}
                      >
                        <ShieldOff className="h-4 w-4" /> Revoke
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => run('grant', u)}
                      >
                        <ShieldCheck className="h-4 w-4" /> Grant admin
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy || isSelf}
                      onClick={() => run('delete', u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                No users yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
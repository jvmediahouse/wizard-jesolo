import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export interface WizardSubmission {
  id: string;
  created_at: string;
  name: string | null;
  surname: string | null;
  email: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  age_range: string | null;
  path: string | null;
  travel_group: string | null;
  interests: string[] | null;
  beach_preference: string | null;
  sports: string[] | null;
  event_types: string[] | null;
  selected_date: string | null;
  end_date: string | null;
  privacy_consent: boolean | null;
  newsletter: boolean | null;
  has_pet: boolean | null;
  generated_plan: unknown | null;
}

function toCsv(rows: WizardSubmission[]): string {
  if (!rows.length) return '';
  const headers = [
    'created_at', 'path', 'name', 'surname', 'email', 'city', 'province', 'country',
    'age_range', 'travel_group', 'interests', 'beach_preference', 'sports',
    'event_types', 'selected_date', 'end_date', 'privacy_consent', 'newsletter',
  ];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? v.join('|') : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => escape((r as any)[h])).join(','));
  }
  return lines.join('\n');
}

export function SubmissionsTable() {
  const [rows, setRows] = useState<WizardSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pathFilter, setPathFilter] = useState<string>('all');
  const [downloadingAll, setDownloadingAll] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('wizard_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) {
      toast.error('Failed to load: ' + error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as WizardSubmission[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (pathFilter !== 'all' && r.path !== pathFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.email, r.name, r.surname, r.city].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, pathFilter]);

  const downloadAllCsv = async () => {
    setDownloadingAll(true);
    try {
      const pageSize = 1000;
      let from = 0;
      const all: WizardSubmission[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('wizard_submissions')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data ?? []) as WizardSubmission[];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      const csv = toCsv(all);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wizard-submissions-all-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${all.length} submissions`);
    } catch (e: any) {
      toast.error('Download failed: ' + (e?.message ?? 'unknown error'));
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search by email, name, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={pathFilter} onValueChange={setPathFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All paths</SelectItem>
            <SelectItem value="events">Events</SelectItem>
            <SelectItem value="plan">Plan</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button onClick={downloadAllCsv} disabled={downloadingAll}>
          {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download all (CSV)
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Interests</TableHead>
              <TableHead>Beach</TableHead>
              <TableHead>Sports</TableHead>
              <TableHead>Event types</TableHead>
              <TableHead>Newsletter</TableHead>
              <TableHead>Pet</TableHead>
              <TableHead>Trip dates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No submissions found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{[r.name, r.surname].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell className="text-xs">{r.email || '—'}</TableCell>
                  <TableCell>{r.travel_group || '—'}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">
                    {r.interests?.join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-xs">{r.beach_preference || '—'}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{r.sports?.join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{r.event_types?.join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs">{r.newsletter ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-xs">{r.has_pet === null ? '—' : r.has_pet ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.selected_date || '—'}
                    {r.end_date && r.end_date !== r.selected_date && ` → ${r.end_date}`}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

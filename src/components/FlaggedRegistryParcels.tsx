import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from '@/lib/appToast';
import { AlertTriangle } from 'lucide-react';

type Row = {
  id: string;
  title: string;
  location?: string | { address?: string };
  redFlag?: { code?: string; message?: string } | null;
};

export function FlaggedRegistryParcels() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getParcels();
      const list = res.parcels ?? [];
      const flagged = list.filter(
        (p: { registryClearance?: string }) => p.registryClearance === 'flagged'
      ) as Row[];
      setRows(flagged);
    } catch {
      toast.error('Could not load flagged parcels');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearFlag = async (id: string) => {
    setClearing(id);
    try {
      await api.clearParcelRedFlag(id);
      toast.success('Parcel restored to clear — automated settlement may resume when other checks pass.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to clear flag');
    } finally {
      setClearing(null);
    }
  };

  if (loading || rows.length === 0) return null;

  return (
    <Card className="border-destructive/35 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Red-flagged parcels ({rows.length})
        </CardTitle>
        <CardDescription>
          Ownership or registry anomalies paused automated settlement. Investigate, then clear when appropriate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-foreground">{p.title}</p>
              <p className="text-xs font-mono text-muted-foreground">{p.id}</p>
              <Badge variant="outline" className="text-xs">
                {p.redFlag?.code ?? 'REGISTRY_FLAG'}
              </Badge>
              {p.redFlag?.message ? (
                <p className="text-sm text-muted-foreground">{p.redFlag.message}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={clearing === p.id}
              onClick={() => void clearFlag(p.id)}
            >
              {clearing === p.id ? 'Clearing…' : 'Clear registry flag'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

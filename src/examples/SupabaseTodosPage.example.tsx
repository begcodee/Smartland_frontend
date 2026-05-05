/**
 * Example adapted from Supabase Next.js `page.tsx` docs — **React client** version.
 *
 * Requires a `todos` table in Supabase. Import from routes only after you create the table
 * and want this demo; this file is not wired into the app router by default.
 */
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Todo = { id: number | string; name?: string };

export function SupabaseTodosPageExample() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: qErr } = await supabase.from('todos').select();
        if (qErr) throw qErr;
        if (!cancelled) setTodos((data as Todo[]) ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load todos');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  return (
    <ul className="list-disc pl-5">
      {todos?.map((todo) => (
        <li key={String(todo.id)}>{todo.name ?? String(todo.id)}</li>
      ))}
    </ul>
  );
}

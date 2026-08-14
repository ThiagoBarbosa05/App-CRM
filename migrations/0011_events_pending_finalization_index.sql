CREATE INDEX IF NOT EXISTS events_pending_finalization_event_date_idx
  ON events (event_date)
  WHERE status IN ('planejado', 'ativo');

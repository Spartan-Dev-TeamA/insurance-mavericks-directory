-- ============================================================
-- Insurance Mavericks — message notification Database Webhook
-- Run after 0006_fix_upsert_my_profile_ambiguous_column.sql.
-- ============================================================

-- DEPLOY.md section 5 describes creating this as a Dashboard "Database
-- Webhook" (Database > Webhooks > Create a new hook). A live probe found
-- that step was never completed: real message inserts produced zero
-- automatic notification email, even though the target function
-- (netlify/functions/message-email-hook.js) works correctly when invoked
-- directly. First attempt at this migration used
-- supabase_functions.http_request(), the older Webhooks mechanism, which
-- does not exist on this project (confirmed live: "schema
-- supabase_functions does not exist"). This project uses the current
-- pg_net-based mechanism instead — the same one Supabase's Dashboard
-- "Create a new hook" flow generates under the hood.
--
-- IMPORTANT: replace <MESSAGE_WEBHOOK_SECRET> below with the exact value
-- of the MESSAGE_WEBHOOK_SECRET Netlify environment variable before
-- running this migration. The header value is stored in the trigger
-- function body (pg_proc catalog) — this is the same place Supabase's own
-- Dashboard-created Database Webhooks store it, not a new exposure.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_message_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://insurance-mavericks.com/.netlify/functions/message-email-hook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-message-webhook-secret', '<MESSAGE_WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object(
      'type', 'INSERT', 'schema', 'public', 'table', 'messages',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists message_notification_webhook on public.messages;
create trigger message_notification_webhook
  after insert on public.messages
  for each row execute function public.notify_message_webhook();

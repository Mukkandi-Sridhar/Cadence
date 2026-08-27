import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bzdvcilxujwqpxwmcxnr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZHZjaWx4dWp3cXB4d21jeG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTk1NjksImV4cCI6MjEwMzM3NTU2OX0.hlbhElXLLMvFQYWYa69YfwmZsdkUPadfl-aW6UlYeqM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// lib/supabaseClient.js

// "Data API -> URL"
// "API Keys -> anon public"

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://baabvaptszlxnaqmsdid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhYWJ2YXB0c3pseG5hcW1zZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODQ5MzEsImV4cCI6MjA4NTk2MDkzMX0.-wHM8pjXgI4RO4lNyZrAKj8PR_c7CBJpWs1u-Lj89Eo'
);

export default supabase;

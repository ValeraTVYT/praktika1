
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://fzfeojdeibdtswdpmirh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6ZmVvamRlaWJkdHN3ZHBtaXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MzQ5MzksImV4cCI6MjA3NjMxMDkzOX0.HH-pQPM28ss1Z9cdtTANBdaBTR3oLTdw9zfYQjLH-UM';

const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };
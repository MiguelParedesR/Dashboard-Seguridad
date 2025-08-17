// Inicialización de Supabase
const SUPABASE_URL = "https://iogbjnvgkgchicepnzjq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZ2JqbnZna2djaGljZXBuempxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzODY2NzksImV4cCI6MjA3MDk2MjY3OX0.wUJULfOQf8BBjW7o88i45dQ8qZGBwX2TI0iqZ5walkc";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

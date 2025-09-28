// Configuración global del proyecto (aseguramos que quede en window)
window.CONFIG = {
  projectName: "Dashboard Seguridad TPP",
  version: "1.0.0",

  // Supabase DESTINO (este proyecto Dashboard)
  SUPABASE_URL: "https://iogbjnvgkgchicepnzjq.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZ2JqbnZna2djaGljZXBuempxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzODY2NzksImV4cCI6MjA3MDk2MjY3OX0.wUJULfOQf8BBjW7o88i45dQ8qZGBwX2TI0iqZ5walkc",
};
// NOTA: en producción, considera cargar estas variables desde un endpoint seguro
// o usar variables de entorno en un proceso de build para no exponerlas directamente en el código cliente.
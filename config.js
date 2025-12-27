// Configuración global del proyecto (aseguramos que quede en window)
window.CONFIG = {
  projectName: "Dashboard Seguridad TPP",
  version: "1.0.0",

// Supabase DESTINO (este proyecto Dashboard)
  SUPABASE_URL: "https://gimwlrxdfakqtqsvxmxv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpbXdscnhkZmFrcXRxc3Z4bXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NzE3MzksImV4cCI6MjA3MTU0NzczOX0.J4XGNI9Iy_TEQTWShsMmgMerIWgmizMIL2dB-B1fDoc",
};
// NOTA: en producción, considera cargar estas variables desde un endpoint seguro
// o usar variables de entorno en un proceso de build para no exponerlas directamente en el código cliente.

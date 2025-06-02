// Замените на ваш реальный URL и ключ
const supabaseUrl = 'https://cccadfyyrwwoeklwndeo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjY2FkZnl5cnd3b2VrbHduZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0NDI3MjYsImV4cCI6MjA2NDAxODcyNn0.Cr1mLGiMUEc3ie202Ep8pzoOaA5MJRCt3mAQME4LPNs;

// Создаем клиент Supabase
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Экспортируем для использования в других модулях
export { supabase };
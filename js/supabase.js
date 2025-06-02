// Замените на ваш реальный URL и ключ
const supabaseUrl = 'https://cccadfyyrwwoeklwndeo.supabase.co';
const supabaseKey = 'ваш_ключ';

// Создаем клиент Supabase
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Экспортируем для использования в других модулях
export { supabase };
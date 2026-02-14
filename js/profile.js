import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', async function() {
    // Проверка аутентификации
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Загружаем данные пользователя из БД
    await loadUserProfile(user.id);
    setupEventListeners();
});

async function loadUserProfile(userId) {
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Обновляем UI
        document.getElementById('userName').textContent = userData.name;
        document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase();
        document.getElementById('profileDisplayName').textContent = userData.name;
        document.getElementById('profileUsername').textContent = userData.username;
        document.getElementById('profileEmail').textContent = userData.email;

        // Форматируем дату
        const createdAt = new Date(userData.created_at).toLocaleDateString('ru-RU', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        document.getElementById('profileCreatedAt').textContent = createdAt;

        // Сохраняем данные для модального окна
        window.currentUserData = userData;

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        alert('Не удалось загрузить данные профиля');
    }
}

function setupEventListeners() {
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut();
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    // На главную
    document.getElementById('backToMainBtn').addEventListener('click', function() {
        window.location.href = 'main.html';
    });

    // Кнопка редактирования имени
    document.getElementById('editNameBtn').addEventListener('click', function() {
        document.getElementById('editNameInput').value = window.currentUserData.name;
        document.getElementById('editNameModal').style.display = 'block';
    });

    // Сохранение имени
    document.getElementById('saveNameBtn').addEventListener('click', saveNameChanges);

    // Кнопка смены пароля
    document.getElementById('changePasswordBtn').addEventListener('click', async function() {
        const newPassword = prompt('Введите новый пароль (минимум 6 символов):');
        if (newPassword && newPassword.length >= 6) {
            try {
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) throw error;
                alert('Пароль успешно изменен!');
            } catch (error) {
                console.error('Ошибка смены пароля:', error);
                alert('Ошибка при смене пароля: ' + error.message);
            }
        } else if (newPassword) {
            alert('Пароль должен быть не менее 6 символов');
        }
    });

    // Закрытие модальных окон
    document.querySelectorAll('.modal .close, .modal .secondary').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

async function saveNameChanges() {
    const newName = document.getElementById('editNameInput').value.trim();
    if (!newName) {
        alert('Имя не может быть пустым');
        return;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('users')
            .update({ name: newName })
            .eq('id', user.id);

        if (error) throw error;

        // Обновляем данные на странице
        await loadUserProfile(user.id);
        document.getElementById('editNameModal').style.display = 'none';
        alert('Имя успешно обновлено');
    } catch (error) {
        console.error('Ошибка сохранения имени:', error);
        alert('Не удалось сохранить имя');
    }
}
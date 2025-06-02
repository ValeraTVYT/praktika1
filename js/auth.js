import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', function() {
    // Табы остаются без изменений
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Логин
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const loginIdentifier = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            // Проверяем, является ли ввод email'ом
            const isEmail = loginIdentifier.includes('@');

            const { data, error } = await supabase.auth.signInWithPassword({
                [isEmail ? 'email' : 'username']: loginIdentifier,
                password
            });

            if (error) {
                alert(error.message);
                return;
            }

            // Получаем полные данные пользователя из таблицы users
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (userError) {
                alert(userError.message);
                return;
            }

            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            window.location.href = 'main.html';
        });
    }

    // Регистрация
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const username = document.getElementById('regUsername').value;
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            
            if (password !== confirmPassword) {
                alert('Пароли не совпадают');
                return;
            }
            
            if (password.length < 6) {
                alert('Пароль должен содержать не менее 6 символов');
                return;
            }

            // Регистрация в Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                        username
                    }
                }
            });

            if (authError) {
                alert(authError.message);
                return;
            }

            // Создание записи в таблице users
            const { data: userData, error: userError } = await supabase
                .from('users')
                .insert([
                    { 
                        id: authData.user.id,
                        name,
                        email,
                        username 
                    }
                ])
                .select();

            if (userError) {
                alert(userError.message);
                return;
            }

            alert('Регистрация успешна! Проверьте вашу почту для подтверждения.');
            registerForm.reset();
            // Переключаем на вкладку входа
            document.querySelector('[data-tab="login"]').click();
        });
    }

    // Сброс пароля
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('resetEmail').value;
            
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://your-site.com/reset-password.html'
            });
            
            if (error) {
                alert(error.message);
                return;
            }
            
            alert('На ваш email отправлена ссылка для сброса пароля');
            resetForm.reset();
        });
    }
});
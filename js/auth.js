import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', function() {
    // Табы
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
            
            const email = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                // Получаем полные данные пользователя
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (userError) throw userError;

                sessionStorage.setItem('currentUser', JSON.stringify(userData));
                window.location.href = 'main.html';
            } catch (error) {
                alert(error.message);
                console.error(error);
            }
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

            try {
                // 1. Регистрация в Supabase Auth
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

                if (authError) throw authError;

                // 2. Создание записи в таблице users
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

                if (userError) throw userError;

                // 3. Автоматический вход после регистрации
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (loginError) throw loginError;

                // Сохраняем данные пользователя и перенаправляем
                sessionStorage.setItem('currentUser', JSON.stringify(userData[0]));
                window.location.href = 'main.html';
                
            } catch (error) {
                alert(error.message);
                console.error(error);
            }
        });
    }

    // Сброс пароля
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('resetEmail').value;
            
            try {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset-password.html'
                });
                
                if (error) throw error;
                
                alert('На ваш email отправлена ссылка для сброса пароля');
                resetForm.reset();
            } catch (error) {
                alert(error.message);
                console.error(error);
            }
        });
    }
});
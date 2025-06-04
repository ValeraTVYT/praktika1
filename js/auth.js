import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', function() {
    // Табы
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Функция для переключения табов
    function switchTab(tabId) {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Логин
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const loginIdentifier = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            try {
                // Определяем, это email или логин
                const isEmail = loginIdentifier.includes('@');

                let authData;
                
                if (isEmail) {
                    // Стандартный вход по email
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: loginIdentifier,
                        password
                    });
                    if (error) throw error;
                    authData = data;
                } else {
                    // Поиск пользователя по логину
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('email')
                        .eq('username', loginIdentifier)
                        .single();

                    if (userError || !userData) {
                        throw new Error('Пользователь с таким логином не найден');
                    }

                    // Вход по найденному email
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: userData.email,
                        password
                    });
                    if (error) throw error;
                    authData = data;
                }

                // Получаем полные данные пользователя
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', authData.user.id)
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
                // Проверка на существующий email или логин
                const { data: existingUser, error: checkError } = await supabase
                    .from('users')
                    .select('*')
                    .or(`email.eq.${email},username.eq.${username}`)
                    .maybeSingle();

                if (existingUser) {
                    if (existingUser.email === email) {
                        throw new Error('Пользователь с таким email уже существует');
                    } else {
                        throw new Error('Пользователь с таким логином уже существует');
                    }
                }

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

                // Переключаем на вкладку входа
                switchTab('login');
                
                // Очищаем форму регистрации
                registerForm.reset();
                
                // Показываем сообщение о подтверждении email
                alert('Регистрация прошла успешно! Пожалуйста, проверьте вашу почту для подтверждения email.');
                
            } catch (error) {
                // Обрабатываем ошибку подтверждения email
                if (error.message.includes('signup requires email verification')) {
                    // Переключаем на вкладку входа
                    switchTab('login');
                    
                    // Очищаем форму регистрации
                    registerForm.reset();
                    
                    // Показываем сообщение на русском
                    alert('Регистрация прошла успешно! Пожалуйста, проверьте вашу почту для подтверждения email.');
                } else {
                    alert(error.message);
                }
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
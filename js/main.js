import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', async function () {
    try {
        // Инициализация приложения
        await initApp();
        
        // Загрузка данных
        await loadData();
        
        // Настройка обработчиков событий
        setupEventListeners();
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        alert('Произошла ошибка при загрузке приложения');
        window.location.href = 'index.html';
    }
});

// Инициализация приложения
async function initApp() {
    // Проверка аутентификации
    const { user, userData } = await checkAuth();
    if (!user || !userData) {
        window.location.href = 'index.html';
        return;
    }

    // Обновление UI
    updateUserUI(userData);
}

// Проверка аутентификации
async function checkAuth() {
    try {
        // 1. Проверка текущей сессии Supabase
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (user) {
            // Получаем данные пользователя из таблицы users
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (userError) throw userError;
            
            // Сохраняем данные пользователя в sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            return { user, userData };
        }

        // 2. Если в Supabase нет сессии, проверяем sessionStorage
        const sessionUser = sessionStorage.getItem('currentUser');
        if (sessionUser) {
            const userData = JSON.parse(sessionUser);
            
            // Пытаемся обновить сессию
            const { data, error } = await supabase.auth.refreshSession();
            if (data?.user) {
                return { user: data.user, userData };
            }
        }

        return { user: null, userData: null };
    } catch (error) {
        console.error('Ошибка проверки аутентификации:', error);
        return { user: null, userData: null };
    }
}

// Обновление UI пользователя
function updateUserUI(userData) {
    document.getElementById('userName').textContent = userData.name;
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase();
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Выход из системы
    document.getElementById('logoutBtn').addEventListener('click', async function () {
        try {
            await supabase.auth.signOut();
            sessionStorage.clear();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Ошибка при выходе:', error);
            alert('Не удалось выйти из системы');
        }
    });

    // Добавление новой доски
    document.getElementById('addBoardBtn').addEventListener('click', addNewBoard);
}

// Загрузка данных
async function loadData() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        await loadBoards(user.id);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        throw error;
    }
}

// Получение текущего пользователя
async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Загрузка досок
async function loadBoards(userId) {
    try {
        const boardsContainer = document.getElementById('boardsContainer');
        boardsContainer.innerHTML = '<p>Загрузка досок...</p>';

        // Получаем доски пользователя и расшаренные доски
        const [userBoards, sharedBoards] = await Promise.all([
            getUserBoards(userId),
            getSharedBoards(userId)
        ]);

        const allBoards = [
            ...userBoards,
            ...sharedBoards.map(item => ({ ...item.boards, isShared: true }))
        ];

        if (allBoards.length === 0) {
            boardsContainer.innerHTML = '<p>У вас пока нет досок. Создайте первую!</p>';
            return;
        }

        // Дополняем информацией о владельцах и количестве карточек
        const enrichedBoards = await enrichBoardsData(allBoards);

        // Отображаем доски
        renderBoards(enrichedBoards);
    } catch (error) {
        console.error('Ошибка загрузки досок:', error);
        document.getElementById('boardsContainer').innerHTML = 
            '<p>Произошла ошибка при загрузке досок</p>';
        throw error;
    }
}

// Получение досок пользователя
async function getUserBoards(userId) {
    const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('owner_id', userId);

    if (error) throw error;
    return data || [];
}

// Получение расшаренных досок
async function getSharedBoards(userId) {
    const { data, error } = await supabase
        .from('shared_boards')
        .select('boards(*)')
        .eq('user_id', userId);

    if (error) throw error;
    return data || [];
}

// Обогащение данных о досках
async function enrichBoardsData(boards) {
    try {
        // Добавляем информацию о владельцах
        const boardsWithOwners = await Promise.all(
            boards.map(async board => {
                if (board.isShared) {
                    const { data: owner } = await supabase
                        .from('users')
                        .select('name')
                        .eq('id', board.owner_id)
                        .single();
                    return { ...board, ownerName: owner?.name || 'Неизвестно' };
                }
                return board;
            })
        );

        // Добавляем количество карточек
        const boardsWithCardCount = await Promise.all(
            boardsWithOwners.map(async board => {
                const { count } = await supabase
                    .from('cards')
                    .select('*', { count: 'exact', head: true })
                    .eq('board_id', board.id);
                return { ...board, cardCount: count || 0 };
            })
        );

        return boardsWithCardCount;
    } catch (error) {
        console.error('Ошибка обогащения данных:', error);
        return boards.map(board => ({ ...board, cardCount: 0 }));
    }
}

// Отображение досок
function renderBoards(boards) {
    const boardsContainer = document.getElementById('boardsContainer');
    boardsContainer.innerHTML = '';

    boards.forEach(board => {
        const boardElement = createBoardElement(board);
        boardsContainer.appendChild(boardElement);
    });
}

// Создание элемента доски
function createBoardElement(board) {
    const boardElement = document.createElement('div');
    boardElement.className = 'board-item';
    boardElement.style.backgroundColor = board.color;
    
    boardElement.innerHTML = `
        <h3>${board.name}</h3>
        ${board.isShared ? `<p><small>Владелец: ${board.ownerName}</small></p>` : ''}
        <p>Карточек: ${board.cardCount}</p>
        <div class="board-actions">
            ${!board.isShared ? `<button class="share-board btn" data-id="${board.id}" title="Поделиться"><i class="fas fa-share-alt"></i></button>` : ''}
            ${!board.isShared ? `<button class="edit-board btn" data-id="${board.id}" title="Редактировать"><i class="fas fa-edit"></i></button>` : ''}
            ${!board.isShared ? `<button class="delete-board btn danger" data-id="${board.id}" title="Удалить"><i class="fas fa-trash"></i></button>` : ''}
        </div>
    `;

    // Обработчик клика по доске
    boardElement.addEventListener('click', function (e) {
        if (!e.target.closest('.board-actions')) {
            sessionStorage.setItem('currentBoard', JSON.stringify(board));
            window.location.href = 'board.html';
        }
    });

    // Обработчики действий с доской
    if (!board.isShared) {
        setupBoardActions(boardElement, board.id);
    }

    return boardElement;
}

// Настройка обработчиков действий с доской
function setupBoardActions(boardElement, boardId) {
    const shareBtn = boardElement.querySelector('.share-board');
    const editBtn = boardElement.querySelector('.edit-board');
    const deleteBtn = boardElement.querySelector('.delete-board');

    shareBtn?.addEventListener('click', function (e) {
        e.stopPropagation();
        openShareModal(boardId);
    });

    editBtn?.addEventListener('click', function (e) {
        e.stopPropagation();
        editBoard(boardId);
    });

    deleteBtn?.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteBoard(boardId);
    });
}

// Добавление новой доски
async function addNewBoard() {
    try {
        const boardName = document.getElementById('newBoardName').value.trim();
        const boardColor = document.getElementById('newBoardColor').value;

        if (!boardName) {
            alert('Введите название доски');
            return;
        }

        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        const { data, error } = await supabase
            .from('boards')
            .insert([{ 
                name: boardName, 
                color: boardColor, 
                owner_id: user.id 
            }])
            .select();

        if (error) throw error;

        // Перезагружаем список досок
        await loadBoards(user.id);
        document.getElementById('newBoardName').value = '';
    } catch (error) {
        console.error('Ошибка добавления доски:', error);
        alert('Не удалось добавить доску');
    }
}

async function openShareModal(boardId) {
    const modal = document.getElementById('shareModal');
    const closeBtn = modal.querySelector('.close');
    const shareBtn = document.getElementById('shareBtn');

    modal.style.display = 'block';

    closeBtn.onclick = () => (modal.style.display = 'none');
    window.onclick = event => {
        if (event.target === modal) modal.style.display = 'none';
    };

    shareBtn.onclick = async function () {
        const userToShare = document.getElementById('shareUser').value.trim();

        if (!userToShare) {
            alert('Введите логин или email пользователя');
            return;
        }

        try {
            const { data: userToShareWith, error: userError } = await supabase
                .from('users')
                .select('*')
                .or(`email.eq.${userToShare},username.eq.${userToShare}`)
                .neq('id', (await getCurrentUser()).id)
                .single();

            if (userError || !userToShareWith) {
                alert('Пользователь не найден или вы пытаетесь поделиться с самим собой');
                return;
            }

            const { error } = await supabase
                .from('shared_boards')
                .insert([{ board_id: boardId, user_id: userToShareWith.id }]);

            if (error) {
                if (error.code === '23505') {
                    alert('Вы уже поделились этой доской с данным пользователем');
                } else {
                    throw error;
                }
                return;
            }

            alert(`Доска успешно расшарена с пользователем ${userToShareWith.name}`);
            modal.style.display = 'none';
            document.getElementById('shareUser').value = '';
        } catch (error) {
            console.error('Ошибка расшаривания доски:', error);
            alert('Не удалось поделиться доской');
        }
    };
}

// Редактирование доски
async function editBoard(boardId) {
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Редактировать доску</h3>
            <div class="form-group">
                <label for="editBoardName">Название:</label>
                <input type="text" id="editBoardName" required>
            </div>
            <div class="form-group">
                <label for="editBoardColor">Цвет:</label>
                <input type="color" id="editBoardColor" value="#ffffff">
            </div>
            <button id="saveBoardChangesBtn" class="btn">Сохранить</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    try {
        // Получаем текущие данные доски
        const { data: board, error: boardError } = await supabase
            .from('boards')
            .select('*')
            .eq('id', boardId)
            .single();

        if (boardError || !board) {
            throw new Error('Доска не найдена');
        }

        // Заполняем форму
        const editBoardName = document.getElementById('editBoardName');
        const editBoardColor = document.getElementById('editBoardColor');
        editBoardName.value = board.name;
        editBoardColor.value = board.color || '#ffffff';
        modal.style.display = 'block';

        // Функция закрытия
        const closeModal = () => {
            modal.style.display = 'none';
            modal.remove();
        };

        // Обработчики закрытия
        modal.querySelector('.close').onclick = closeModal;
        window.onclick = (e) => e.target === modal && closeModal();

        // Обработчик сохранения
        document.getElementById('saveBoardChangesBtn').onclick = async function() {
            const newName = editBoardName.value.trim();
            const newColor = editBoardColor.value;
            
            if (!newName) {
                alert('Введите название доски');
                return;
            }
            
            try {
                const { error } = await supabase
                    .from('boards')
                    .update({ name: newName, color: newColor })
                    .eq('id', boardId);
                
                if (error) throw error;
                
                const user = await getCurrentUser();
                await loadBoards(user.id);
                closeModal();
            } catch (error) {
                console.error('Ошибка обновления доски:', error);
                alert('Не удалось обновить доску: ' + error.message);
            }
        };
    } catch (error) {
        console.error('Ошибка редактирования доски:', error);
        alert('Не удалось загрузить данные доски: ' + error.message);
        modal.remove();
    }
}

// Удаление доски
async function deleteBoard(boardId) {
    try {
        if (!confirm('Вы уверены, что хотите удалить эту доску? Все карточки и заметки будут удалены.')) {
            return;
        }

        const { error } = await supabase
            .from('boards')
            .delete()
            .eq('id', boardId);

        if (error) throw error;

        const user = await getCurrentUser();
        await loadBoards(user.id);
    } catch (error) {
        console.error('Ошибка удаления доски:', error);
        alert('Не удалось удалить доску');
    }
}
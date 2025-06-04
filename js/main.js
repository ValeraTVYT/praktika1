import { supabase } from './supabase.js'

let currentEditBoardId = null;

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

async function initApp() {
    const { user, userData } = await checkAuth();
    if (!user || !userData) {
        window.location.href = 'index.html';
        return;
    }
    updateUserUI(userData);
}

async function checkAuth() {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (user) {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (userError) throw userError;
            
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            return { user, userData };
        }

        const sessionUser = sessionStorage.getItem('currentUser');
        if (sessionUser) {
            const userData = JSON.parse(sessionUser);
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

function updateUserUI(userData) {
    document.getElementById('userName').textContent = userData.name;
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase();
}

function setupEventListeners() {
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

    document.getElementById('addBoardBtn').addEventListener('click', addNewBoard);

    // Модальные окна
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

    document.getElementById('saveBoardBtn').addEventListener('click', saveBoardChanges);
    document.getElementById('shareBtn').addEventListener('click', shareBoard);
}

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

async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

async function loadBoards(userId) {
    try {
        const boardsContainer = document.getElementById('boardsContainer');
        boardsContainer.innerHTML = '<p>Загрузка досок...</p>';

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

        const enrichedBoards = await enrichBoardsData(allBoards);
        renderBoards(enrichedBoards);
    } catch (error) {
        console.error('Ошибка загрузки досок:', error);
        document.getElementById('boardsContainer').innerHTML = 
            '<p>Произошла ошибка при загрузке досок</p>';
        throw error;
    }
}

async function getUserBoards(userId) {
    const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('owner_id', userId);

    if (error) throw error;
    return data || [];
}

async function getSharedBoards(userId) {
    const { data, error } = await supabase
        .from('shared_boards')
        .select('boards(*)')
        .eq('user_id', userId);

    if (error) throw error;
    return data || [];
}

async function enrichBoardsData(boards) {
    try {
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

function renderBoards(boards) {
    const boardsContainer = document.getElementById('boardsContainer');
    boardsContainer.innerHTML = '';

    boards.forEach(board => {
        const boardElement = createBoardElement(board);
        boardsContainer.appendChild(boardElement);
    });
}

function createBoardElement(board) {
    const boardElement = document.createElement('div');
    boardElement.className = 'board-item';
    boardElement.style.backgroundColor = board.color || '#ffffff';
    
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

    boardElement.addEventListener('click', function (e) {
        if (!e.target.closest('.board-actions')) {
            sessionStorage.setItem('currentBoard', JSON.stringify(board));
            window.location.href = 'board.html';
        }
    });

    if (!board.isShared) {
        setupBoardActions(boardElement, board.id);
    }

    return boardElement;
}

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
        openEditBoardModal(boardId);
    });

    deleteBtn?.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteBoard(boardId);
    });
}

async function openEditBoardModal(boardId) {
    currentEditBoardId = boardId;
    
    const { data: board, error } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .single();

    if (error) {
        alert('Ошибка загрузки данных доски');
        return;
    }

    document.getElementById('editBoardName').value = board.name;
    document.getElementById('editBoardColor').value = board.color || '#ffffff';
    document.getElementById('editBoardModal').style.display = 'block';
}

async function saveBoardChanges() {
    const newName = document.getElementById('editBoardName').value.trim();
    const newColor = document.getElementById('editBoardColor').value;
    
    if (!newName) {
        alert('Введите название доски');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('boards')
            .update({ name: newName, color: newColor })
            .eq('id', currentEditBoardId)
            .select();

        if (error) throw error;

        // Обновляем sessionStorage если это текущая доска
        const currentBoard = JSON.parse(sessionStorage.getItem('currentBoard'));
        if (currentBoard && currentBoard.id === currentEditBoardId) {
            sessionStorage.setItem('currentBoard', JSON.stringify(data[0]));
        }

        const user = await getCurrentUser();
        await loadBoards(user.id);
        document.getElementById('editBoardModal').style.display = 'none';
    } catch (error) {
        console.error('Ошибка сохранения доски:', error);
        alert('Не удалось сохранить изменения');
    }
}

async function addNewBoard() {
    const boardName = document.getElementById('newBoardName').value.trim();
    const boardColor = document.getElementById('newBoardColor').value;

    if (!boardName) {
        alert('Введите название доски');
        return;
    }

    try {
        const user = await getCurrentUser();
        const { data, error } = await supabase
            .from('boards')
            .insert([{ 
                name: boardName, 
                color: boardColor, 
                owner_id: user.id 
            }])
            .select();

        if (error) throw error;

        await loadBoards(user.id);
        document.getElementById('newBoardName').value = '';
    } catch (error) {
        console.error('Ошибка добавления доски:', error);
        alert('Не удалось добавить доску');
    }
}

async function deleteBoard(boardId) {
    if (!confirm('Вы уверены, что хотите удалить эту доску? Все карточки и заметки будут удалены.')) {
        return;
    }

    try {
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

async function openShareModal(boardId) {
    document.getElementById('shareModal').style.display = 'block';
    document.getElementById('shareUser').value = '';
    currentEditBoardId = boardId;
}

async function shareBoard() {
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
            .insert([{ board_id: currentEditBoardId, user_id: userToShareWith.id }]);

        if (error) {
            if (error.code === '23505') {
                alert('Вы уже поделились этой доской с данным пользователем');
            } else {
                throw error;
            }
            return;
        }

        alert(`Доска успешно расшарена с пользователем ${userToShareWith.name}`);
        document.getElementById('shareModal').style.display = 'none';
    } catch (error) {
        console.error('Ошибка расшаривания доски:', error);
        alert('Не удалось поделиться доской');
    }
}
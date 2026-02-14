import { supabase } from './supabase.js'

let currentBoard = null;
let currentEditCardId = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Проверка аутентификации
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    currentBoard = JSON.parse(sessionStorage.getItem('currentBoard'));
    if (!currentBoard) {
        window.location.href = 'main.html';
        return;
    }

    // Получаем данные пользователя
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    // Проверяем, является ли пользователь владельцем доски
    const isOwner = currentBoard.owner_id === user.id;

    document.getElementById('userName').textContent = userData.name;
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase();
    document.getElementById('boardTitle').textContent = currentBoard.name;
    document.getElementById('boardTitle').style.color = currentBoard.color || '#333';

    // Скрываем кнопки управления доской, если пользователь не владелец
    document.getElementById('editBoardBtn').style.display = isOwner ? 'block' : 'none';
    document.getElementById('deleteBoardBtn').style.display = isOwner ? 'block' : 'none';

    // Обработчики событий
    setupEventListeners();
    await loadCards();
});

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut();
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    // НОВЫЙ ОБРАБОТЧИК для кнопки профиля
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', function() {
            window.location.href = 'profile.html';
        });
    }

    document.getElementById('backToMainBtn').addEventListener('click', function() {
        sessionStorage.removeItem('currentBoard');
        sessionStorage.removeItem('currentCard');
        window.location.href = 'main.html';
    });

    document.getElementById('editBoardBtn').addEventListener('click', editBoard);
    document.getElementById('deleteBoardBtn').addEventListener('click', deleteBoard);

    document.getElementById('addCardBtn').addEventListener('click', addNewCard);

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
    document.getElementById('saveCardBtn').addEventListener('click', saveCardChanges);
}

async function loadCards() {
    const cardsContainer = document.getElementById('cardsContainer');
    cardsContainer.innerHTML = '<p>Загрузка карточек...</p>';
    
    try {
        const { data: cards, error } = await supabase
            .from('cards')
            .select('*, notes(*)')
            .eq('board_id', currentBoard.id);

        if (error) throw error;

        if (cards && cards.length > 0) {
            cardsContainer.innerHTML = '';
            cards.forEach(card => {
                const cardElement = createCardElement(card);
                cardsContainer.appendChild(cardElement);
            });
        } else {
            cardsContainer.innerHTML = '<p>В этой доске пока нет карточек</p>';
        }
    } catch (error) {
        console.error('Ошибка загрузки карточек:', error);
        cardsContainer.innerHTML = '<p>Ошибка загрузки карточек</p>';
    }
}

function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card-item';
    cardElement.style.backgroundColor = card.color || '#ffffff';
    
    const isOwner = card.owner_id === currentBoard.owner_id;
    
    cardElement.innerHTML = `
        <h3>${card.name}</h3>
        <p>Заметок: ${card.notes.length}</p>
        <div class="card-actions">
            ${isOwner ? `<button class="edit-card btn" data-id="${card.id}" title="Редактировать"><i class="fas fa-edit"></i></button>` : ''}
            ${isOwner ? `<button class="delete-card btn danger" data-id="${card.id}" title="Удалить"><i class="fas fa-trash"></i></button>` : ''}
        </div>
    `;
    
    cardElement.addEventListener('click', function(e) {
        if (!e.target.closest('.card-actions')) {
            sessionStorage.setItem('currentCard', JSON.stringify(card));
            window.location.href = 'card.html';
        }
    });

    if (isOwner) {
        cardElement.querySelector('.edit-card').addEventListener('click', function(e) {
            e.stopPropagation();
            openEditCardModal(card);
        });
        
        cardElement.querySelector('.delete-card').addEventListener('click', function(e) {
            e.stopPropagation();
            deleteCard(card.id);
        });
    }
    
    return cardElement;
}

function editBoard() {
    document.getElementById('editBoardName').value = currentBoard.name;
    document.getElementById('editBoardColor').value = currentBoard.color || '#ffffff';
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
            .eq('id', currentBoard.id)
            .select();

        if (error) throw error;

        currentBoard = data[0];
        sessionStorage.setItem('currentBoard', JSON.stringify(currentBoard));
        document.getElementById('boardTitle').textContent = currentBoard.name;
        document.getElementById('boardTitle').style.color = currentBoard.color || '#333';
        document.getElementById('editBoardModal').style.display = 'none';
    } catch (error) {
        console.error('Ошибка сохранения доски:', error);
        alert('Не удалось сохранить изменения');
    }
}

function openEditCardModal(card) {
    currentEditCardId = card.id;
    document.getElementById('editCardName').value = card.name;
    document.getElementById('editCardColor').value = card.color || '#ffffff';
    document.getElementById('editCardModal').style.display = 'block';
}

async function saveCardChanges() {
    const newName = document.getElementById('editCardName').value.trim();
    const newColor = document.getElementById('editCardColor').value;
    
    if (!newName) {
        alert('Введите название карточки');
        return;
    }

    try {
        const { error } = await supabase
            .from('cards')
            .update({ name: newName, color: newColor })
            .eq('id', currentEditCardId);

        if (error) throw error;

        await loadCards();
        document.getElementById('editCardModal').style.display = 'none';
    } catch (error) {
        console.error('Ошибка сохранения карточки:', error);
        alert('Не удалось сохранить изменения');
    }
}

async function addNewCard() {
    const cardName = document.getElementById('newCardName').value.trim();
    const cardColor = document.getElementById('newCardColor').value;
    
    if (!cardName) {
        alert('Введите название карточки');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('cards')
            .insert([{ 
                name: cardName,
                color: cardColor,
                board_id: currentBoard.id,
                owner_id: currentBoard.owner_id
            }])
            .select();

        if (error) throw error;

        await loadCards();
        document.getElementById('newCardName').value = '';
    } catch (error) {
        console.error('Ошибка добавления карточки:', error);
        alert('Не удалось добавить карточку');
    }
}

async function deleteBoard() {
    if (!confirm('Вы уверены, что хотите удалить эту доску? Все карточки и заметки будут удалены.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('boards')
            .delete()
            .eq('id', currentBoard.id);

        if (error) throw error;

        sessionStorage.removeItem('currentBoard');
        window.location.href = 'main.html';
    } catch (error) {
        console.error('Ошибка удаления доски:', error);
        alert('Не удалось удалить доску');
    }
}

async function deleteCard(cardId) {
    if (!confirm('Вы уверены, что хотите удалить эту карточку? Все заметки будут удалены.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', cardId);

        if (error) throw error;

        await loadCards();
    } catch (error) {
        console.error('Ошибка удаления карточки:', error);
        alert('Не удалось удалить карточку');
    }
}
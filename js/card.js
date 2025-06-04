import { supabase } from './supabase.js'

let currentCard = null;
let currentEditNoteId = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Проверка аутентификации
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    currentCard = JSON.parse(sessionStorage.getItem('currentCard'));
    if (!currentCard) {
        window.location.href = 'main.html';
        return;
    }

    // Получаем данные пользователя
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    // Проверяем, является ли пользователь владельцем карточки
    const isOwner = currentCard.owner_id === user.id;

    document.getElementById('userName').textContent = userData.name;
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase();
    document.getElementById('cardTitle').textContent = currentCard.name;
    document.getElementById('cardTitle').style.color = currentCard.color || '#333';

    // Скрываем кнопки управления карточкой, если пользователь не владелец
    document.getElementById('editCardBtn').style.display = isOwner ? 'block' : 'none';
    document.getElementById('deleteCardBtn').style.display = isOwner ? 'block' : 'none';

    // Обработчики событий
    setupEventListeners();
    await loadNotes();
});

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut();
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    document.getElementById('backToBoardBtn').addEventListener('click', function() {
        sessionStorage.removeItem('currentCard');
        window.location.href = 'board.html';
    });

    document.getElementById('editCardBtn').addEventListener('click', editCard);
    document.getElementById('deleteCardBtn').addEventListener('click', deleteCard);

    document.getElementById('addNoteBtn').addEventListener('click', addNewNote);

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

    document.getElementById('saveNoteBtn').addEventListener('click', saveNoteChanges);
}

async function loadNotes() {
    const notesContainer = document.getElementById('notesContainer');
    notesContainer.innerHTML = '<p>Загрузка заметок...</p>';
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: notes, error } = await supabase
            .from('notes')
            .select('*')
            .eq('card_id', currentCard.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Получаем информацию о пользователях
        const userIds = [...new Set(notes.map(note => note.user_id))];
        let users = {};
        
        if (userIds.length > 0) {
            const { data: usersData } = await supabase
                .from('users')
                .select('id, name')
                .in('id', userIds);

            usersData.forEach(u => users[u.id] = u.name);
        }

        // Проверяем доступ к доске
        const hasBoardAccess = await checkBoardAccess(currentCard.board_id, user.id);
        
        // Отображаем заметки
        notesContainer.innerHTML = '';
        
        if (notes && notes.length > 0) {
            notes.forEach(note => {
                const noteElement = createNoteElement(note, users, user.id, hasBoardAccess);
                notesContainer.appendChild(noteElement);
            });
        } else {
            notesContainer.innerHTML = '<p>В этой карточке пока нет заметок</p>';
        }
    } catch (error) {
        console.error('Ошибка загрузки заметок:', error);
        notesContainer.innerHTML = '<p>Ошибка загрузки заметок</p>';
    }
}

function createNoteElement(note, users, currentUserId, hasBoardAccess) {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    noteElement.style.backgroundColor = note.color || '#ffffff';
    
    const canEditNote = note.user_id === currentUserId || hasBoardAccess;
    
    noteElement.innerHTML = `
        <p>${note.text}</p>
        <small>Автор: ${users[note.user_id] || 'Неизвестно'}</small>
        ${note.updated_by ? `<small>Изменено: ${users[note.updated_by] || 'Неизвестно'}</small>` : ''}
        <small>${new Date(note.updated_at || note.created_at).toLocaleString()}</small>
        <div class="note-actions">
            ${canEditNote ? `<button class="edit-note btn" data-id="${note.id}"><i class="fas fa-edit"></i></button>` : ''}
            ${canEditNote ? `<button class="delete-note btn danger" data-id="${note.id}"><i class="fas fa-trash"></i></button>` : ''}
        </div>
    `;
    
    if (canEditNote) {
        noteElement.querySelector('.edit-note').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditNoteModal(note);
        });
        
        noteElement.querySelector('.delete-note').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNote(note.id);
        });
    }
    
    return noteElement;
}

function openEditNoteModal(note) {
    currentEditNoteId = note.id;
    document.getElementById('editNoteText').value = note.text;
    document.getElementById('editNoteColor').value = note.color || '#ffffff';
    document.getElementById('editNoteModal').style.display = 'block';
}

async function saveNoteChanges() {
    const newText = document.getElementById('editNoteText').value.trim();
    const newColor = document.getElementById('editNoteColor').value;
    
    if (!newText) {
        alert('Введите текст заметки');
        return;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('notes')
            .update({ 
                text: newText,
                color: newColor,
                updated_at: new Date().toISOString(),
                updated_by: user.id
            })
            .eq('id', currentEditNoteId);

        if (error) throw error;

        await loadNotes();
        document.getElementById('editNoteModal').style.display = 'none';
    } catch (error) {
        console.error('Ошибка сохранения заметки:', error);
        alert('Не удалось сохранить изменения');
    }
}

async function addNewNote() {
    const noteText = document.getElementById('newNoteText').value.trim();
    const noteColor = document.getElementById('newNoteColor').value;
    
    if (!noteText) {
        alert('Введите текст заметки');
        return;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('notes')
            .insert([{ 
                text: noteText,
                color: noteColor,
                card_id: currentCard.id,
                user_id: user.id
            }])
            .select();

        if (error) throw error;

        // Обновляем текущую карточку в sessionStorage
        const { data: updatedCard } = await supabase
            .from('cards')
            .select('*, notes(*)')
            .eq('id', currentCard.id)
            .single();

        sessionStorage.setItem('currentCard', JSON.stringify(updatedCard));
        await loadNotes();
        document.getElementById('newNoteText').value = '';
    } catch (error) {
        console.error('Ошибка добавления заметки:', error);
        alert('Не удалось добавить заметку');
    }
}

function editCard() {
    document.getElementById('editCardName').value = currentCard.name;
    document.getElementById('editCardColor').value = currentCard.color || '#ffffff';
    document.getElementById('editCardModal').style.display = 'block';
}

async function deleteCard() {
    if (!confirm('Вы уверены, что хотите удалить эту карточку? Все заметки будут удалены.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', currentCard.id);

        if (error) throw error;

        sessionStorage.removeItem('currentCard');
        window.location.href = 'board.html';
    } catch (error) {
        console.error('Ошибка удаления карточки:', error);
        alert('Не удалось удалить карточку');
    }
}

async function deleteNote(noteId) {
    if (!confirm('Вы уверены, что хотите удалить эту заметку?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', noteId);

        if (error) throw error;

        // Обновляем текущую карточку в sessionStorage
        const { data: updatedCard } = await supabase
            .from('cards')
            .select('*, notes(*)')
            .eq('id', currentCard.id)
            .single();

        sessionStorage.setItem('currentCard', JSON.stringify(updatedCard));
        await loadNotes();
    } catch (error) {
        console.error('Ошибка удаления заметки:', error);
        alert('Не удалось удалить заметку');
    }
}

async function checkBoardAccess(boardId, userId) {
    try {
        // Проверяем, является ли пользователь владельцем доски
        const { data: board } = await supabase
            .from('boards')
            .select('owner_id')
            .eq('id', boardId)
            .single();

        if (board && board.owner_id === userId) {
            return true;
        }

        // Проверяем доступ через shared_boards
        const { data: shared } = await supabase
            .from('shared_boards')
            .select('*')
            .eq('board_id', boardId)
            .eq('user_id', userId)
            .single();

        return shared !== null;
    } catch (error) {
        console.error('Ошибка проверки доступа:', error);
        return false;
    }
}
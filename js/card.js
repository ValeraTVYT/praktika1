import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', async function() {
    // Проверка аутентификации
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        window.location.href = 'index.html'
        return
    }

    const currentCard = JSON.parse(sessionStorage.getItem('currentCard'))
    if (!currentCard) {
        window.location.href = 'main.html'
        return
    }

    // Получаем данные пользователя
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    // Проверяем, является ли пользователь владельцем карточки
    const isOwner = currentCard.owner_id === user.id

    // Проверяем, есть ли доступ к доске через shared_boards
    const { data: sharedBoard } = await supabase
        .from('shared_boards')
        .select('*')
        .eq('board_id', currentCard.board_id)
        .eq('user_id', user.id)
        .single()

    const hasBoardAccess = isOwner || sharedBoard !== null

    document.getElementById('userName').textContent = userData.name
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase()
    document.getElementById('cardTitle').textContent = currentCard.name
    document.getElementById('cardTitle').style.color = currentCard.color

    // Скрываем кнопки управления карточкой, если пользователь не владелец
    document.getElementById('editCardBtn').style.display = isOwner ? 'block' : 'none'
    document.getElementById('deleteCardBtn').style.display = isOwner ? 'block' : 'none'

    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut()
        sessionStorage.clear()
        window.location.href = 'index.html'
    })

    document.getElementById('backToBoardBtn').addEventListener('click', function() {
        sessionStorage.removeItem('currentCard')
        window.location.href = 'board.html'
    })

    if (isOwner) {
        document.getElementById('editCardBtn').addEventListener('click', editCard)
        document.getElementById('deleteCardBtn').addEventListener('click', deleteCard)
    }

    loadNotes()

    document.getElementById('addNoteBtn').addEventListener('click', async function() {
        if (!hasBoardAccess) {
            alert('У вас нет прав для добавления заметок в эту карточку')
            return
        }

        const noteText = document.getElementById('newNoteText').value.trim()
        const noteColor = document.getElementById('newNoteColor').value
        
        if (!noteText) {
            alert('Введите текст заметки')
            return
        }

        const { data, error } = await supabase
            .from('notes')
            .insert([
                { 
                    text: noteText,
                    color: noteColor,
                    card_id: currentCard.id,
                    user_id: user.id
                }
            ])
            .select()

        if (error) {
            alert(error.message)
            return
        }

        // Обновляем текущую карточку в sessionStorage
        const { data: updatedCard } = await supabase
            .from('cards')
            .select('*, notes(*)')
            .eq('id', currentCard.id)
            .single()

        sessionStorage.setItem('currentCard', JSON.stringify(updatedCard))
        loadNotes()
        document.getElementById('newNoteText').value = ''
    })

    async function loadNotes() {
        const notesContainer = document.getElementById('notesContainer');
        notesContainer.innerHTML = '<p>Загрузка заметок...</p>';
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                notesContainer.innerHTML = '<p>Необходимо авторизоваться</p>';
                return;
            }

            const currentCard = JSON.parse(sessionStorage.getItem('currentCard'));
            if (!currentCard) {
                notesContainer.innerHTML = '<p>Карточка не найдена</p>';
                return;
            }

            // Проверяем доступ к доске
            const hasBoardAccess = await checkBoardAccess(currentCard.id, user.id);

            // Получаем заметки с информацией о пользователях
            const { data: notes, error } = await supabase
                .from('notes')
                .select(`
                    *,
                    user:user_id(name),
                    updated_by_user:updated_by(name)
                `)
                .eq('card_id', currentCard.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            notesContainer.innerHTML = '';

            if (notes && notes.length > 0) {
                notes.forEach(note => {
                    const noteElement = document.createElement('div');
                    noteElement.className = 'note-item';
                    noteElement.style.backgroundColor = note.color || '#ffffff';
                    
                    const canEditNote = note.user_id === user.id || hasBoardAccess;
                    
                    noteElement.innerHTML = `
                        <p>${note.text}</p>
                        <small>Автор: ${note.user?.name || 'Неизвестно'}</small>
                        ${note.updated_by ? `<small>Изменено: ${note.updated_by_user?.name || 'Неизвестно'}</small>` : ''}
                        <small>Дата: ${new Date(note.updated_at || note.created_at).toLocaleString()}</small>
                        <div class="note-actions">
                            ${canEditNote ? `<button class="edit-note btn" data-id="${note.id}"><i class="fas fa-edit"></i> Редактировать</button>` : ''}
                            ${canEditNote ? `<button class="delete-note btn danger" data-id="${note.id}"><i class="fas fa-trash"></i> Удалить</button>` : ''}
                        </div>
                    `;
                    
                    if (canEditNote) {
                        noteElement.querySelector('.edit-note')?.addEventListener('click', () => editNote(note.id));
                        noteElement.querySelector('.delete-note')?.addEventListener('click', () => deleteNote(note.id));
                    }
                    
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

    async function editCard() {
        const newName = prompt('Введите новое название карточки:', currentCard.name)
        if (newName === null || newName.trim() === '') return

        const newColor = document.getElementById('newNoteColor').value

        const { data, error } = await supabase
            .from('cards')
            .update({ name: newName.trim(), color: newColor })
            .eq('id', currentCard.id)
            .select()

        if (error) {
            alert(error.message)
            return
        }

        sessionStorage.setItem('currentCard', JSON.stringify({ ...currentCard, ...data[0] }))
        document.getElementById('cardTitle').textContent = data[0].name
        document.getElementById('cardTitle').style.color = '#333'
    }

    async function deleteCard() {
        if (!confirm('Вы уверены, что хотите удалить эту карточку? Все заметки будут удалены.')) {
            return
        }

        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', currentCard.id)

        if (error) {
            alert(error.message)
            return
        }

        sessionStorage.removeItem('currentCard')
        window.location.href = 'board.html'
    }

    async function editNote(noteId) {
        try {
            // Проверяем аутентификацию
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Необходимо авторизоваться');
                return;
            }

            // Получаем текущую заметку
            const { data: note, error: noteError } = await supabase
                .from('notes')
                .select('*, user:user_id(name)')
                .eq('id', noteId)
                .single();

            if (noteError || !note) {
                alert('Заметка не найдена');
                return;
            }

            // Проверяем права доступа
            const hasBoardAccess = await checkBoardAccess(note.card_id, user.id);
            const canEdit = note.user_id === user.id || hasBoardAccess;

            if (!canEdit) {
                alert('У вас нет прав для редактирования этой заметки');
                return;
            }

            // Запрос на редактирование
            const newText = prompt('Редактировать заметку:', note.text);
            if (newText === null || newText.trim() === '') return;

            const newColor = document.getElementById('newNoteColor').value;

            const { error } = await supabase
                .from('notes')
                .update({ 
                    text: newText.trim(),
                    color: newColor,
                    updated_at: new Date().toISOString(),
                    updated_by: user.id
                })
                .eq('id', noteId);

            if (error) throw error;

            // Обновляем данные
            loadNotes();
        } catch (error) {
            console.error('Ошибка редактирования заметки:', error);
            alert('Не удалось обновить заметку: ' + error.message);
        }
    }

    async function checkBoardAccess(cardId, userId) {
        try {
            // Получаем board_id из карточки
            const { data: card, error: cardError } = await supabase
                .from('cards')
                .select('board_id')
                .eq('id', cardId)
                .single();

            if (cardError || !card) return false;

            // Проверяем, является ли пользователь владельцем доски
            const { data: board, error: boardError } = await supabase
                .from('boards')
                .select('owner_id')
                .eq('id', card.board_id)
                .single();

            if (boardError || !board) return false;
            if (board.owner_id === userId) return true;

            // Проверяем доступ через shared_boards
            const { data: shared, error: sharedError } = await supabase
                .from('shared_boards')
                .select('*')
                .eq('board_id', card.board_id)
                .eq('user_id', userId)
                .single();

            return !!shared && !sharedError;
        } catch (error) {
            console.error('Ошибка проверки доступа:', error);
            return false;
        }
    }

    async function deleteNote(noteId) {
        if (!confirm('Вы уверены, что хотите удалить эту заметку?')) {
            return
        }

        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', noteId)

        if (error) {
            alert(error.message)
            return
        }

        // Обновляем текущую карточку в sessionStorage
        const { data: updatedCard } = await supabase
            .from('cards')
            .select('*, notes(*)')
            .eq('id', currentCard.id)
            .single()

        sessionStorage.setItem('currentCard', JSON.stringify(updatedCard))
        loadNotes()
    }
})
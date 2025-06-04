import { supabase } from './supabase.js'

let currentEditNoteId = null;

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

    // Проверяем доступ к доске
    const hasBoardAccess = await checkBoardAccess(currentCard.board_id, user.id)

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

    // Обработчики модальных окон
    document.querySelectorAll('.modal .close, .modal .secondary').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none'
            })
        })
    })

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none'
        }
    })

    document.getElementById('saveNoteBtn').addEventListener('click', async function() {
        const newText = document.getElementById('editNoteText').value.trim()
        const newColor = document.getElementById('editNoteColor').value
        
        if (!newText) {
            alert('Введите текст заметки')
            return
        }

        const { error } = await supabase
            .from('notes')
            .update({ 
                text: newText,
                color: newColor,
                updated_at: new Date().toISOString(),
                updated_by: user.id
            })
            .eq('id', currentEditNoteId)

        if (error) {
            alert(error.message)
            return
        }

        loadNotes()
        document.getElementById('editNoteModal').style.display = 'none'
    })
})

async function loadNotes() {
    const notesContainer = document.getElementById('notesContainer')
    notesContainer.innerHTML = '<p>Загрузка заметок...</p>'
    
    try {
        // Получаем текущую карточку
        const currentCard = JSON.parse(sessionStorage.getItem('currentCard'))
        if (!currentCard) {
            notesContainer.innerHTML = '<p>Карточка не найдена</p>'
            return
        }

        // Получаем заметки
        const { data: notes, error: notesError } = await supabase
            .from('notes')
            .select('*')
            .eq('card_id', currentCard.id)
            .order('created_at', { ascending: false })

        if (notesError) throw notesError

        // Получаем информацию о пользователях
        const userIds = [...new Set(notes.map(note => note.user_id))]
        let users = {}
        
        if (userIds.length > 0) {
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id, name')
                .in('id', userIds)

            if (!usersError) {
                usersData.forEach(u => users[u.id] = u.name)
            }
        }

        // Проверяем доступ к доске
        const { data: { user } } = await supabase.auth.getUser()
        const hasBoardAccess = await checkBoardAccess(currentCard.board_id, user.id)
        
        // Отображаем заметки
        notesContainer.innerHTML = ''
        
        if (notes && notes.length > 0) {
            notes.forEach(note => {
                const noteElement = document.createElement('div')
                noteElement.className = 'note-item'
                noteElement.style.backgroundColor = note.color || '#ffffff'
                
                const canEditNote = note.user_id === user.id || hasBoardAccess
                
                noteElement.innerHTML = `
                    <p>${note.text}</p>
                    <small>Автор: ${users[note.user_id] || 'Неизвестно'}</small>
                    ${note.updated_by ? `<small>Изменено: ${users[note.updated_by] || 'Неизвестно'}</small>` : ''}
                    <small>${new Date(note.updated_at || note.created_at).toLocaleString()}</small>
                    <div class="note-actions">
                        ${canEditNote ? `<button class="edit-note btn" data-id="${note.id}"><i class="fas fa-edit"></i></button>` : ''}
                        ${canEditNote ? `<button class="delete-note btn danger" data-id="${note.id}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `
                
                if (canEditNote) {
                    noteElement.querySelector('.edit-note')?.addEventListener('click', (e) => {
                        e.stopPropagation()
                        editNote(note.id, note.text, note.color)
                    })
                    noteElement.querySelector('.delete-note')?.addEventListener('click', (e) => {
                        e.stopPropagation()
                        deleteNote(note.id)
                    })
                }
                
                notesContainer.appendChild(noteElement)
            })
        } else {
            notesContainer.innerHTML = '<p>В этой карточке пока нет заметок</p>'
        }
    } catch (error) {
        console.error('Ошибка загрузки заметок:', error)
        notesContainer.innerHTML = '<p>Ошибка загрузки заметок. Попробуйте обновить страницу.</p>'
    }
}

function editCard() {
    const currentCard = JSON.parse(sessionStorage.getItem('currentCard'))
    document.getElementById('editCardName').value = currentCard.name
    document.getElementById('editCardColor').value = currentCard.color
    document.getElementById('editCardModal').style.display = 'block'
}

async function editNote(noteId, noteText, noteColor) {
    currentEditNoteId = noteId
    document.getElementById('editNoteText').value = noteText
    document.getElementById('editNoteColor').value = noteColor || '#ffffff'
    document.getElementById('editNoteModal').style.display = 'block'
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

async function checkBoardAccess(boardId, userId) {
    try {
        // Проверяем, является ли пользователь владельцем доски
        const { data: board, error: boardError } = await supabase
            .from('boards')
            .select('owner_id')
            .eq('id', boardId)
            .single()

        if (!boardError && board && board.owner_id === userId) {
            return true
        }

        // Проверяем доступ через shared_boards
        const { data: shared, error: sharedError } = await supabase
            .from('shared_boards')
            .select('*')
            .eq('board_id', boardId)
            .eq('user_id', userId)
            .single()

        return !sharedError && shared !== null
    } catch (error) {
        console.error('Ошибка проверки доступа:', error)
        return false
    }
}
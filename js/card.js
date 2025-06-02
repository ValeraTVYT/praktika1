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

    // Проверяем права доступа к карточке
    const { data: boardAccess, error: accessError } = await supabase
        .from('boards')
        .select('owner_id')
        .eq('id', currentCard.board_id)
        .single()

    if (accessError || !boardAccess) {
        alert('Ошибка доступа к карточке')
        window.location.href = 'main.html'
        return
    }

    const isOwner = boardAccess.owner_id === user.id

    // Получаем данные пользователя
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    document.getElementById('userName').textContent = userData.name
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase()
    document.getElementById('cardTitle').textContent = currentCard.name
    document.getElementById('cardTitle').style.color = currentCard.color

    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut()
        sessionStorage.removeItem('currentUser')
        sessionStorage.removeItem('currentBoard')
        sessionStorage.removeItem('currentCard')
        window.location.href = 'index.html'
    })

    document.getElementById('backToBoardBtn').addEventListener('click', function() {
        sessionStorage.removeItem('currentCard')
        window.location.href = 'board.html'
    })

    // Показываем кнопки редактирования только для владельца
    document.getElementById('editCardBtn').style.display = isOwner ? 'block' : 'none'
    document.getElementById('deleteCardBtn').style.display = isOwner ? 'block' : 'none'

    if (isOwner) {
        document.getElementById('editCardBtn').addEventListener('click', editCard)
        document.getElementById('deleteCardBtn').addEventListener('click', deleteCard)
    }

    loadNotes()

    document.getElementById('addNoteBtn').addEventListener('click', async function() {
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
                    card_id: currentCard.id
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
        const notesContainer = document.getElementById('notesContainer')
        notesContainer.innerHTML = ''
        
        const { data: notes, error } = await supabase
            .from('notes')
            .select('*')
            .eq('card_id', currentCard.id)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error(error)
            return
        }

        if (notes && notes.length > 0) {
            notes.forEach(note => {
                const noteElement = document.createElement('div')
                noteElement.className = 'note-item'
                noteElement.style.backgroundColor = note.color
                noteElement.innerHTML = `
                    <p>${note.text}</p>
                    <small>Обновлено: ${new Date(note.updated_at).toLocaleString()}</small>
                    <div class="note-actions">
                        <button class="edit-note btn" data-id="${note.id}"><i class="fas fa-edit"></i> Редактировать</button>
                        <button class="delete-note btn danger" data-id="${note.id}"><i class="fas fa-trash"></i> Удалить</button>
                    </div>
                `
                
                notesContainer.appendChild(noteElement)

                const editBtn = noteElement.querySelector('.edit-note')
                const deleteBtn = noteElement.querySelector('.delete-note')
                
                editBtn.addEventListener('click', function() {
                    editNote(note.id)
                })
                
                deleteBtn.addEventListener('click', function() {
                    deleteNote(note.id)
                })
            })
        } else {
            notesContainer.innerHTML = '<p>В этой карточке пока нет заметок. Создайте первую!</p>'
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
        document.getElementById('cardTitle').style.color = data[0].color
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
        const note = currentCard.notes.find(n => n.id === noteId)
        if (!note) return

        const newText = prompt('Редактировать заметку:', note.text)
        if (newText === null || newText.trim() === '') return

        const newColor = document.getElementById('newNoteColor').value

        const { error } = await supabase
            .from('notes')
            .update({ 
                text: newText.trim(),
                color: newColor,
                updated_at: new Date().toISOString()
            })
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
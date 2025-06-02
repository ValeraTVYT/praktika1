import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', async function() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        window.location.href = 'index.html'
        return
    }

    const currentBoard = JSON.parse(sessionStorage.getItem('currentBoard'))
    if (!currentBoard) {
        window.location.href = 'main.html'
        return
    }

    const isOwner = currentBoard.owner_id === user.id

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    document.getElementById('userName').textContent = userData.name
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase()
    document.getElementById('boardTitle').textContent = currentBoard.name
    document.getElementById('boardTitle').style.color = currentBoard.color

    // Скрываем кнопки редактирования/удаления если не владелец
    if (!isOwner) {
        document.getElementById('editBoardBtn').style.display = 'none'
        document.getElementById('deleteBoardBtn').style.display = 'none'
    }

    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut()
        sessionStorage.removeItem('currentUser')
        sessionStorage.removeItem('currentBoard')
        sessionStorage.removeItem('currentCard')
        window.location.href = 'index.html'
    })

    document.getElementById('backToMainBtn').addEventListener('click', function() {
        sessionStorage.removeItem('currentBoard')
        sessionStorage.removeItem('currentCard')
        window.location.href = 'main.html'
    })

    document.getElementById('editBoardBtn').addEventListener('click', editBoard)
    document.getElementById('deleteBoardBtn').addEventListener('click', deleteBoard)

    loadCards()

    document.getElementById('addCardBtn').addEventListener('click', async function() {
        if (!isOwner) {
            alert('Только владелец может добавлять карточки')
            return
        }

        const cardName = document.getElementById('newCardName').value.trim()
        const cardColor = document.getElementById('newCardColor').value
        
        if (!cardName) {
            alert('Введите название карточки')
            return
        }

        const { data, error } = await supabase
            .from('cards')
            .insert([
                { 
                    name: cardName,
                    color: cardColor,
                    board_id: currentBoard.id
                }
            ])
            .select()

        if (error) {
            alert(error.message)
            return
        }

        loadCards()
        document.getElementById('newCardName').value = ''
    })

    async function loadCards() {
        const cardsContainer = document.getElementById('cardsContainer')
        cardsContainer.innerHTML = ''
        
        const { data: cards, error } = await supabase
            .from('cards')
            .select('*, notes(count)')
            .eq('board_id', currentBoard.id)

        if (error) {
            console.error(error)
            return
        }

        if (cards && cards.length > 0) {
            cards.forEach(card => {
                const cardElement = document.createElement('div')
                cardElement.className = 'card-item'
                cardElement.style.backgroundColor = card.color
                cardElement.innerHTML = `
                    <h3>${card.name}</h3>
                    <p>Заметок: ${card.notes ? card.notes[0].count : 0}</p>
                    <div class="card-actions">
                        ${isOwner ? `<button class="edit-card btn" data-id="${card.id}" title="Редактировать"><i class="fas fa-edit"></i></button>` : ''}
                        ${isOwner ? `<button class="delete-card btn danger" data-id="${card.id}" title="Удалить"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `
                
                cardElement.addEventListener('click', function(e) {
                    if (!e.target.closest('.card-actions')) {
                        sessionStorage.setItem('currentCard', JSON.stringify(card))
                        window.location.href = 'card.html'
                    }
                })

                if (isOwner) {
                    const editBtn = cardElement.querySelector('.edit-card')
                    const deleteBtn = cardElement.querySelector('.delete-card')
                    
                    editBtn.addEventListener('click', function(e) {
                        e.stopPropagation()
                        editCard(card.id)
                    })
                    
                    deleteBtn.addEventListener('click', function(e) {
                        e.stopPropagation()
                        deleteCard(card.id)
                    })
                }
                
                cardsContainer.appendChild(cardElement)
            })
        } else {
            cardsContainer.innerHTML = '<p>В этой доске пока нет карточек. Создайте первую!</p>'
        }
    }

    async function editBoard() {
        const newName = prompt('Введите новое название доски:', currentBoard.name)
        if (newName === null || newName.trim() === '') return

        const newColor = document.getElementById('newCardColor').value

        const { data, error } = await supabase
            .from('boards')
            .update({ name: newName.trim(), color: newColor })
            .eq('id', currentBoard.id)
            .select()

        if (error) {
            alert(error.message)
            return
        }

        sessionStorage.setItem('currentBoard', JSON.stringify(data[0]))
        document.getElementById('boardTitle').textContent = data[0].name
        document.getElementById('boardTitle').style.color = '#333'
    }

    async function deleteBoard() {
        if (!confirm('Вы уверены, что хотите удалить эту доску? Все карточки и заметки будут удалены.')) {
            return
        }

        const { error } = await supabase
            .from('boards')
            .delete()
            .eq('id', currentBoard.id)

        if (error) {
            alert(error.message)
            return
        }

        sessionStorage.removeItem('currentBoard')
        window.location.href = 'main.html'
    }

    async function editCard(cardId) {
        const newName = prompt('Введите новое название карточки:')
        if (newName === null || newName.trim() === '') return

        const newColor = document.getElementById('newCardColor').value

        const { error } = await supabase
            .from('cards')
            .update({ name: newName.trim(), color: newColor })
            .eq('id', cardId)

        if (error) {
            alert(error.message)
            return
        }

        loadCards()
    }

    async function deleteCard(cardId) {
        if (!confirm('Вы уверены, что хотите удалить эту карточку? Все заметки будут удалены.')) {
            return
        }

        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', cardId)

        if (error) {
            alert(error.message)
            return
        }

        loadCards()
    }
})
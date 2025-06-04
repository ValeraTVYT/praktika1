import { supabase } from './supabase.js'

let currentEditCardId = null;
let currentEditBoardId = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Проверка аутентификации
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

    // Получаем данные пользователя
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    // Проверяем, является ли пользователь владельцем доски
    const isOwner = currentBoard.owner_id === user.id

    document.getElementById('userName').textContent = userData.name
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase()
    document.getElementById('boardTitle').textContent = currentBoard.name
    document.getElementById('boardTitle').style.color = currentBoard.color

    // Скрываем кнопки управления доской, если пользователь не владелец
    document.getElementById('editBoardBtn').style.display = isOwner ? 'block' : 'none'
    document.getElementById('deleteBoardBtn').style.display = isOwner ? 'block' : 'none'

    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut()
        sessionStorage.clear()
        window.location.href = 'index.html'
    })

    document.getElementById('backToMainBtn').addEventListener('click', function() {
        sessionStorage.removeItem('currentBoard')
        sessionStorage.removeItem('currentCard')
        window.location.href = 'main.html'
    })

    if (isOwner) {
        document.getElementById('editBoardBtn').addEventListener('click', editBoard)
        document.getElementById('deleteBoardBtn').addEventListener('click', deleteBoard)
    }

    loadCards()

    document.getElementById('addCardBtn').addEventListener('click', async function() {
        if (!isOwner) {
            alert('Только владелец может создавать карточки')
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
                    board_id: currentBoard.id,
                    owner_id: currentBoard.owner_id
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
})

async function loadCards() {
    const cardsContainer = document.getElementById('cardsContainer')
    cardsContainer.innerHTML = ''
    
    const { data: cards, error } = await supabase
        .from('cards')
        .select('*, notes(*)')
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
            
            const canEditCard = card.owner_id === user.id
            
            cardElement.innerHTML = `
                <h3>${card.name}</h3>
                <p>Заметок: ${card.notes.length}</p>
                <div class="card-actions">
                    ${canEditCard ? `<button class="edit-card btn" data-id="${card.id}" title="Редактировать"><i class="fas fa-edit"></i></button>` : ''}
                    ${canEditCard ? `<button class="delete-card btn danger" data-id="${card.id}" title="Удалить"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `
            
            cardElement.addEventListener('click', function(e) {
                if (!e.target.closest('.card-actions')) {
                    sessionStorage.setItem('currentCard', JSON.stringify(card))
                    window.location.href = 'card.html'
                }
            })

            if (canEditCard) {
                const editBtn = cardElement.querySelector('.edit-card')
                const deleteBtn = cardElement.querySelector('.delete-card')
                
                editBtn.addEventListener('click', function(e) {
                    e.stopPropagation()
                    editCard(card.id, card.name, card.color)
                })
                
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation()
                    deleteCard(card.id)
                })
            }
            
            cardsContainer.appendChild(cardElement)
        })
    } else {
        cardsContainer.innerHTML = '<p>В этой доске пока нет карточек</p>'
    }
}

function editBoard() {
    currentEditBoardId = currentBoard.id
    document.getElementById('editBoardName').value = currentBoard.name
    document.getElementById('editBoardColor').value = currentBoard.color
    document.getElementById('editBoardModal').style.display = 'block'
}

document.getElementById('saveBoardBtn').addEventListener('click', async function() {
    const newName = document.getElementById('editBoardName').value.trim()
    const newColor = document.getElementById('editBoardColor').value
    
    if (!newName) {
        alert('Введите название доски')
        return
    }

    const { data, error } = await supabase
        .from('boards')
        .update({ name: newName, color: newColor })
        .eq('id', currentEditBoardId)
        .select()

    if (error) {
        alert(error.message)
        return
    }

    sessionStorage.setItem('currentBoard', JSON.stringify(data[0]))
    document.getElementById('boardTitle').textContent = data[0].name
    document.getElementById('boardTitle').style.color = data[0].color
    document.getElementById('editBoardModal').style.display = 'none'
})

function editCard(cardId, cardName, cardColor) {
    currentEditCardId = cardId
    document.getElementById('editCardName').value = cardName
    document.getElementById('editCardColor').value = cardColor
    document.getElementById('editCardModal').style.display = 'block'
}

document.getElementById('saveCardBtn').addEventListener('click', async function() {
    const newName = document.getElementById('editCardName').value.trim()
    const newColor = document.getElementById('editCardColor').value
    
    if (!newName) {
        alert('Введите название карточки')
        return
    }

    const { error } = await supabase
        .from('cards')
        .update({ name: newName, color: newColor })
        .eq('id', currentEditCardId)

    if (error) {
        alert(error.message)
        return
    }

    loadCards()
    document.getElementById('editCardModal').style.display = 'none'
})

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
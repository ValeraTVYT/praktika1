import { supabase } from './supabase.js'

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
            cardsContainer.innerHTML = '<p>В этой доске пока нет карточек</p>'
        }
    }

    async function editBoard() {
        const modal = document.getElementById('editBoardModal');
        const editBoardName = document.getElementById('editBoardName');
        const editBoardColor = document.getElementById('editBoardColor');
        const saveBtn = document.getElementById('saveBoardChangesBtn');
        
        // Заполняем текущими значениями
        editBoardName.value = currentBoard.name;
        editBoardColor.value = currentBoard.color || '#ffffff';
        
        // Показываем модальное окно
        modal.style.display = 'block';
        
        // Обработчик закрытия
        const closeModal = () => {
            modal.style.display = 'none';
            window.onclick = null;
            document.querySelector('.close').onclick = null;
            saveBtn.onclick = null;
        };
        
        // Закрытие по клику на крестик
        modal.querySelector('.close').onclick = closeModal;
        
        // Закрытие по клику вне окна
        window.onclick = function(event) {
            if (event.target === modal) {
                closeModal();
            }
        };
        
        // Обработчик сохранения
        saveBtn.onclick = async function() {
            const newName = editBoardName.value.trim();
            const newColor = editBoardColor.value;
            
            if (!newName) {
                alert('Введите название доски');
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('boards')
                    .update({ 
                        name: newName,
                        color: newColor,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentBoard.id)
                    .select();
                
                if (error) throw error;
                
                // Обновляем данные доски
                const updatedBoard = data[0];
                sessionStorage.setItem('currentBoard', JSON.stringify(updatedBoard));
                document.getElementById('boardTitle').textContent = updatedBoard.name;
                document.getElementById('boardTitle').style.color = updatedBoard.color || '#333';
                
                closeModal();
            } catch (error) {
                console.error('Ошибка обновления доски:', error);
                alert('Не удалось обновить доску: ' + error.message);
            }
        };
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
        const modal = document.getElementById('editCardModal')
        const editCardName = document.getElementById('editCardName')
        const editCardColor = document.getElementById('editCardColor')
        const saveBtn = document.getElementById('saveCardChangesBtn')
        
        // Получаем текущие данные карточки
        const { data: card, error: cardError } = await supabase
            .from('cards')
            .select('*')
            .eq('id', cardId)
            .single()
        
        if (cardError) {
            alert('Ошибка загрузки карточки')
            return
        }
        
        // Заполняем форму
        editCardName.value = card.name
        editCardColor.value = card.color || '#ffffff'
        modal.style.display = 'block'
        
        // Функция закрытия
        const closeModal = () => {
            modal.style.display = 'none'
            window.onclick = null
            document.querySelector('.close').onclick = null
            saveBtn.onclick = null
        }
        
        // Обработчики закрытия
        document.querySelector('.close').onclick = closeModal
        window.onclick = (e) => e.target === modal && closeModal()
        
        // Обработчик сохранения
        saveBtn.onclick = async function() {
            const newName = editCardName.value.trim()
            const newColor = editCardColor.value
            
            if (!newName) {
                alert('Введите название карточки')
                return
            }
            
            try {
                const { error } = await supabase
                    .from('cards')
                    .update({ 
                        name: newName,
                        color: newColor,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', cardId)
                
                if (error) throw error
                
                loadCards()
                closeModal()
            } catch (error) {
                console.error('Ошибка обновления карточки:', error)
                alert('Не удалось обновить карточку: ' + error.message)
            }
        }
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
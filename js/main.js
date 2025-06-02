// Обновленный main.js
import { supabase } from './supabase.js'

document.addEventListener('DOMContentLoaded', async function() {
    // Проверка аутентификации
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        window.location.href = 'index.html'
        return
    }

    // Получаем данные пользователя из таблицы users
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    if (userError) {
        console.error(userError)
        return
    }

    document.getElementById('userName').textContent = userData.name
    document.getElementById('userAvatar').textContent = userData.name.charAt(0).toUpperCase()

    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut()
        sessionStorage.removeItem('currentUser')
        sessionStorage.removeItem('currentBoard')
        sessionStorage.removeItem('currentCard')
        window.location.href = 'index.html'
    })

    loadBoards()

    document.getElementById('addBoardBtn').addEventListener('click', async function() {
        const boardName = document.getElementById('newBoardName').value.trim()
        const boardColor = document.getElementById('newBoardColor').value
        
        if (!boardName) {
            alert('Введите название доски')
            return
        }

        const { data, error } = await supabase
            .from('boards')
            .insert([
                { 
                    name: boardName,
                    color: boardColor,
                    owner_id: user.id
                }
            ])
            .select()

        if (error) {
            alert(error.message)
            return
        }

        loadBoards()
        document.getElementById('newBoardName').value = ''
    })

   async function loadBoards() {
        const boardsContainer = document.getElementById('boardsContainer')
        boardsContainer.innerHTML = ''
        
        // Получаем доски пользователя с количеством карточек
        const { data: userBoards, error: userBoardsError } = await supabase
            .from('boards')
            .select(`
                *,
                cards(count)
            `)
            .eq('owner_id', user.id)

        if (userBoardsError) {
            console.error(userBoardsError)
            return
        }

        // Получаем общие доски с количеством карточек
        const { data: sharedBoards, error: sharedBoardsError } = await supabase
            .from('shared_boards')
            .select(`
                boards(
                    *,
                    cards(count)
                )
            `)
            .eq('user_id', user.id)

        if (sharedBoardsError) {
            console.error(sharedBoardsError)
            return
        }

        // Формируем массив всех досок
        const allBoards = [
            ...(userBoards || []).map(b => ({ 
                ...b, 
                isShared: false,
                cards_count: b.cards[0]?.count || 0
            })),
            ...(sharedBoards || []).map(item => ({ 
                ...item.boards, 
                isShared: true,
                cards_count: item.boards.cards[0]?.count || 0
            }))
        ]

        if (allBoards.length > 0) {
            // Для общих досок получаем информацию о владельце
            const sharedWithOwner = await Promise.all(
                allBoards
                    .filter(b => b.isShared)
                    .map(async board => {
                        const { data: owner } = await supabase
                            .from('users')
                            .select('name')
                            .eq('id', board.owner_id)
                            .single()
                        return { ...board, ownerName: owner?.name || 'Неизвестный' }
                    })
            )

            const userBoardsWithOwner = allBoards
                .filter(b => !b.isShared)
                .map(board => ({ ...board, ownerName: userData.name }))

            const boardsToDisplay = [...userBoardsWithOwner, ...sharedWithOwner]

            boardsToDisplay.forEach(board => {
                const boardElement = document.createElement('div')
                boardElement.className = 'board-item'
                boardElement.style.backgroundColor = board.color
                boardElement.innerHTML = `
                    <h3>${board.name}</h3>
                    ${board.isShared ? `<p><small>Владелец: ${board.ownerName}</small></p>` : ''}
                    <p>Карточек: ${board.cards_count}</p>
                    <div class="board-actions">
                        ${!board.isShared ? `<button class="share-board btn" data-id="${board.id}" title="Поделиться"><i class="fas fa-share-alt"></i></button>` : ''}
                        ${!board.isShared ? `<button class="edit-board btn" data-id="${board.id}" title="Редактировать"><i class="fas fa-edit"></i></button>` : ''}
                        ${!board.isShared ? `<button class="delete-board btn danger" data-id="${board.id}" title="Удалить"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `
                
                boardElement.addEventListener('click', function(e) {
                    if (!e.target.closest('.board-actions')) {
                        sessionStorage.setItem('currentBoard', JSON.stringify(board))
                        window.location.href = 'board.html'
                    }
                })
                
                if (!board.isShared) {
                    const shareBtn = boardElement.querySelector('.share-board')
                    const editBtn = boardElement.querySelector('.edit-board')
                    const deleteBtn = boardElement.querySelector('.delete-board')
                    
                    shareBtn?.addEventListener('click', function(e) {
                        e.stopPropagation()
                        openShareModal(board.id)
                    })
                    
                    editBtn?.addEventListener('click', function(e) {
                        e.stopPropagation()
                        editBoard(board.id)
                    })
                    
                    deleteBtn?.addEventListener('click', function(e) {
                        e.stopPropagation()
                        deleteBoard(board.id)
                    })
                }
                
                boardsContainer.appendChild(boardElement)
            })
        } else {
            boardsContainer.innerHTML = '<p>У вас пока нет досок. Создайте первую!</p>'
        }
    }

    // Обработчик создания доски
    document.getElementById('addBoardBtn').addEventListener('click', async function() {
        const boardName = document.getElementById('newBoardName').value.trim()
        const boardColor = document.getElementById('newBoardColor').value
        
        if (!boardName) {
            alert('Введите название доски')
            return
        }

        const { data, error } = await supabase
            .from('boards')
            .insert([
                { 
                    name: boardName,
                    color: boardColor,
                    owner_id: user.id
                }
            ])
            .select()

        if (error) {
            alert(error.message)
            return
        }

        // После создания доски добавляем ее в список с нулевым количеством карточек
        const newBoard = {
            ...data[0],
            isShared: false,
            cards_count: 0,
            ownerName: userData.name
        }

        // Обновляем интерфейс без перезагрузки всех досок
        const boardsContainer = document.getElementById('boardsContainer')
        if (boardsContainer.innerHTML.includes('пока нет досок')) {
            boardsContainer.innerHTML = ''
        }

        const boardElement = document.createElement('div')
        boardElement.className = 'board-item'
        boardElement.style.backgroundColor = newBoard.color
        boardElement.innerHTML = `
            <h3>${newBoard.name}</h3>
            <p>Карточек: ${newBoard.cards_count}</p>
            <div class="board-actions">
                <button class="share-board btn" data-id="${newBoard.id}" title="Поделиться"><i class="fas fa-share-alt"></i></button>
                <button class="edit-board btn" data-id="${newBoard.id}" title="Редактировать"><i class="fas fa-edit"></i></button>
                <button class="delete-board btn danger" data-id="${newBoard.id}" title="Удалить"><i class="fas fa-trash"></i></button>
            </div>
        `
        
        boardElement.addEventListener('click', function(e) {
            if (!e.target.closest('.board-actions')) {
                sessionStorage.setItem('currentBoard', JSON.stringify(newBoard))
                window.location.href = 'board.html'
            }
        })
        
        const shareBtn = boardElement.querySelector('.share-board')
        const editBtn = boardElement.querySelector('.edit-board')
        const deleteBtn = boardElement.querySelector('.delete-board')
        
        shareBtn.addEventListener('click', function(e) {
            e.stopPropagation()
            openShareModal(newBoard.id)
        })
        
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation()
            editBoard(newBoard.id)
        })
        
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation()
            deleteBoard(newBoard.id)
        })
        
        boardsContainer.prepend(boardElement)
        document.getElementById('newBoardName').value = ''
    })

    async function openShareModal(boardId) {
        // Реализация модального окна для шаринга
        const modal = document.getElementById('shareModal')
        const closeBtn = modal.querySelector('.close')
        const shareBtn = document.getElementById('shareBtn')
        
        modal.style.display = 'block'
        
        closeBtn.onclick = function() {
            modal.style.display = 'none'
        }
        
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none'
            }
        }
        
        shareBtn.onclick = async function() {
            const userToShare = document.getElementById('shareUser').value.trim()
            
            if (!userToShare) {
                alert('Введите логин или email пользователя')
                return
            }
            
            // Находим пользователя по email или username
            const { data: userToShareWith, error: userError } = await supabase
                .from('users')
                .select('*')
                .or(`email.eq.${userToShare},username.eq.${userToShare}`)
                .neq('id', user.id)
                .single()

            if (userError || !userToShareWith) {
                alert('Пользователь не найден или вы пытаетесь поделиться с самим собой')
                return
            }

            // Добавляем запись в shared_boards
            const { error } = await supabase
                .from('shared_boards')
                .insert([
                    { 
                        board_id: boardId,
                        user_id: userToShareWith.id
                    }
                ])

            if (error) {
                if (error.code === '23505') {
                    alert('Вы уже поделились этой доской с данным пользователем')
                } else {
                    alert(error.message)
                }
                return
            }

            alert(`Доска успешно расшарена с пользователем ${userToShareWith.name}`)
            modal.style.display = 'none'
            document.getElementById('shareUser').value = ''
        }
    }

    async function editBoard(boardId) {
        const newName = prompt('Введите новое название доски:')
        if (!newName) return

        const newColor = document.getElementById('newBoardColor').value

        const { error } = await supabase
            .from('boards')
            .update({ name: newName, color: newColor })
            .eq('id', boardId)

        if (error) {
            alert(error.message)
            return
        }

        loadBoards()
    }

    async function deleteBoard(boardId) {
        if (!confirm('Вы уверены, что хотите удалить эту доску? Все карточки и заметки будут удалены.')) {
            return
        }

        const { error } = await supabase
            .from('boards')
            .delete()
            .eq('id', boardId)

        if (error) {
            alert(error.message)
            return
        }

        loadBoards()
    }
})
function deleteUser(userId) {
    if (confirm('Вы действительно хотите удалить этого пользователя?')) {
        fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    fetchUsers(); // Обновляем список после удаления
                } else {
                    alert(data.message || 'Ошибка при удалении пользователя.');
                }
            })
            .catch(error => {
                console.error('Ошибка при удалении пользователя:', error);
                alert('Ошибка при удалении пользователя');
            });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('logoutButton').addEventListener('click', function () {
        fetch('/logout', { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    window.location.href = '/index.html';
                }
            })
            .catch(error => console.error('Ошибка при выходе:', error));
    });

    setupNavigation();
});

function setupNavigation() {
    fetch('/api/user-data', { method: 'GET', credentials: 'include' })
        .then(response => response.json())
        .then(userData => {
            if (['admin', 'teacher'].includes(userData.role)) {
                addNavLink('createCourse', 'Создать курс');
            }
            if (userData.role === 'admin') {
                addNavLink('admin', 'Администрирование');
            }
            showTab('profile'); // По умолчанию показываем профиль
        })
        .catch(error => console.error('Error loading user data:', error));
}

function addNavLink(id, text) {
    const navPanel = document.querySelector('.nav-panel');
    const link = document.createElement('a');
    link.href = "#";
    link.className = "nav-link";
    link.textContent = text;
    link.onclick = () => showTab(id);
    navPanel.appendChild(link);
}

function showTab(tabName) {
    const contentArea = document.getElementById('contentArea');
    const sessionInfo = document.getElementById('sessionInfo');
    contentArea.innerHTML = ''; // Очистка содержимого перед добавлением нового
    switch (tabName) {
        case 'profile':
            fetchUserData();
            break;
        case 'courses':
            contentArea.innerHTML = '<h1>Мои курсы</h1> <div id="contentArea"></div>';
            fetchCourses();
            break;
        case 'createCourse':
            contentArea.innerHTML = '<h1>Создание курса</h1>';
            setupCourseCreationForm(contentArea);
            break;
        case 'admin':
            contentArea.innerHTML = `<h1>Администрирование пользователей</h1>
            <table id="usersTable">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Имя</th>
                        <th>Логин</th>
                        <th>Роль</th>
    <th>Действия</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>`;
            setTimeout(fetchUsers, 0); // Устраняет проблемы с отсутствием элемента
            break;
        case 'connection':
            contentArea.innerHTML = '<h1>Подключение</h1>';
            setupConnectionCards(contentArea);
            break;
    }
}



function setupCourseCreationForm(contentArea) {
    contentArea.innerHTML = `
<h2>Создание нового курса</h2>
<form id="createCourseForm">
    <label for="courseName">Название курса:</label>
    <input type="text" id="courseName" name="courseName" required><br><br>

    <div id="tasksContainer">
        <div>
            <label for="task0">Задание 1:</label><br>
            <textarea id=Ё"task0" name="tasks[]" class="task-input"></textarea><br><br>
        </div>
    </div>
    <button type="button" onclick="addTask()">Добавить задание</button><br><br>
    <button type="submit">Создать курс</button>
</form>
`;

    document.getElementById('createCourseForm').onsubmit = function (event) {
        event.preventDefault(); // Предотвращение стандартной отправки формы
        submitCourse();
    };

    let taskCount = 1; // Счётчик для управления количеством заданий

    window.addTask = function () {
        if (taskCount < 10) {
            const taskContainer = document.getElementById('tasksContainer');
            const newTaskId = `task${taskCount}`;
            const taskHTML = `
        <div>
            <label for="${newTaskId}">Задание ${taskCount + 1}:</label><br>
            <textarea id="${newTaskId}" name="tasks[]" class="task-input"></textarea><br><br>
        </div>
    `;
            taskContainer.insertAdjacentHTML('beforeend', taskHTML);
            taskCount++;
        } else {
            alert('Максимальное количество заданий в курсе — 10.');
        }
    };
}


function submitCourse() {
    const courseName = document.getElementById('courseName').value;
    const taskInputs = document.querySelectorAll('.task-input');
    const tasks = Array.from(taskInputs).map(input => input.value).filter(task => task.trim() !== '');

    // Структурирование данных курса для отправки на сервер
    const courseData = {
        courseName: courseName,
        tasks: tasks
    };

    // Отправка данных на сервер через API
    fetch('/api/create-course', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(courseData)
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Курс успешно создан:', data);
                alert('Курс успешно создан!');
                document.getElementById('createCourseForm').reset(); // Очистка формы после создания курса
            } else {
                alert('Ошибка при создании курса: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка при создании курса:', error);
            alert('Ошибка при создании курса');
        });
}
function fetchUsers() {
    fetch('/api/users')
        .then(response => response.json())
        .then(users => {
            const tbody = document.getElementById('usersTable').querySelector('tbody');
            tbody.innerHTML = '';
            users.forEach(user => {
                const row = `<tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.login}</td>
            <td>
                <select onchange="roleChanged(this, ${user.id})">
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
                    <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>teacher</option>
                    <option value="student" ${user.role === 'student' ? 'selected' : ''}>student</option>
                </select>
            </td>
             <td>
<button class="button" onclick="deleteUser(${user.id})">Удалить</button>
</td>
        </tr>`;
                tbody.innerHTML += row;
            });
        })
        .catch(error => console.error('Error:', error));
}

function roleChanged(selectElement, userId) {
    const newRole = selectElement.value;
    fetch('/change-role', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, newRole })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Роль успешно изменена');
            } else {
                alert(data.message);
                // В случае ошибки, можно вернуть предыдущее значение с помощью сохраненного состояния
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ошибка при изменении роли');
        });
}

function saveRoleChange(userId) {
    const selectElement = document.querySelector(`select[data-userid="${userId}"]`);
    const newRole = selectElement.value;
    fetch('/change-role', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, newRole })
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ошибка при сохранении роли');
        });
}

let globalUserData = null;

function fetchUserData() {
    fetch('/api/user-data', { method: 'GET', credentials: 'include' })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else if (response.status === 401) {
                alert('Session expired. Please log in again.');
                window.location.href = '/auth.html'; // Redirect to login page on session expire
            } else {
                throw new Error('Failed to fetch data');
            }
        })
        .then(userData => {
            console.log('Data received:', userData);
            globalUserData = userData;
            displayUserData(userData);
        })
        .catch(error => {
            console.error('Error:', error);
        });
}
function setupConnectionCards(contentArea) {
    const container = document.createElement('div');
    container.className = 'connection-cards-container';
    //container.style.display = 'flex';
    container.style.justifyContent = 'space-around';
    container.style.flexWrap = 'wrap';
    const userLogin = globalUserData.login;
    // Добавление карточки для подключения
    const card = document.createElement('div');
    card.className = 'connection-card';
    card.innerHTML = `
<div id="sessionCount">Загрузка сессий...</div>
<p>Ip адрес для подключения - 192.168.31.100</p>
<p>Пользователь ${userLogin}</p>
<button id="connectButton" onclick="openApplication()">Подключиться</button>
`;
    container.appendChild(card);

    contentArea.appendChild(container);

    fetchTermideskSessions(); // Вызов функции для получения сессий
}


function fetchTermideskSessions() {
    fetch('/api/termidesk-sessions')
        .then(response => response.json())
        .then(data => {
            const sessionCount = document.getElementById('sessionCount');
            const connectButton = document.getElementById('connectButton');
            const activeSessions = data.activeSessions;
            sessionCount.innerHTML = `<p>Активные сессии: 1/4</p>`;


            if (activeSessions >= 4) {
                connectButton.disabled = true;
                connectButton.innerText = 'Подключение недоступно';
                connectButton.style.backgroundColor = '#d3d3d3'; // Светло-серый цвет
                connectButton.style.cursor = 'not-allowed';
            } else {
                connectButton.disabled = false;
                connectButton.innerText = 'Подключиться';
                connectButton.style.backgroundColor = ''; // Возвращаем цвет по умолчанию
                connectButton.style.cursor = 'pointer';
            }
        })
        .catch(error => {
            console.error('Ошибка при получении данных о сессиях:', error);
            const sessionCount = document.getElementById('sessionCount');
            sessionCount.innerHTML = 'Ошибка при загрузке данных о сессиях';
        });
}

function openApplication() {
    window.open('https://192.168.31.100/login/', '_blank');
}

function fetchCourses() {
    fetch('/api/my-courses', { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch courses');
            }
            return response.json();
        })
        .then(courses => {
            const contentArea = document.getElementById('contentArea');
            contentArea.innerHTML = '<h1>Мои курсы</h1>';
            const coursesContainer = document.createElement('div');
            coursesContainer.className = 'courses-container';

            courses.forEach(course => {
                const courseCard = document.createElement('div');
                courseCard.className = 'course-card';
                courseCard.innerHTML = `
            <h3>${course.course_name}</h3>
            <p>${course.description || "Описание отсутствует"}</p>
            <button onclick="showCourseDetails(${course.course_id})">Подробнее</button>
        `;
                // Проверяем, администратор ли пользователь
                if (globalUserData.role === 'admin') {
                    courseCard.innerHTML += `<button onclick="deleteCourse(${course.course_id})">Удалить</button>`;
                }

                coursesContainer.appendChild(courseCard);
            });

            contentArea.appendChild(coursesContainer);
        })
        .catch(error => {
            console.error('Error fetching courses:', error);
            contentArea.innerHTML = '<p>Ошибка при загрузке курсов.</p>';
        });
}

function deleteCourse(courseId) {
    if (confirm('Вы действительно хотите удалить этот курс?')) {
        fetch(`/api/courses/${courseId}`, {
            method: 'DELETE',
            credentials: 'include'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to delete the course');
                }
                return response.json();
            })
            .then(data => {
                alert(data.message); // Сообщение об успешном удалении
                fetchCourses(); // Перезагрузить список курсов после удаления
            })
            .catch(error => {
                console.error('Error deleting course:', error);
                alert('Ошибка при удалении курса: ' + error.message);
            });
    }
}

function showCourseDetails(courseId) {
    fetch(`/api/course-tasks/${courseId}`)
        .then(response => response.json())
        .then(tasks => {
            const contentArea = document.getElementById('contentArea');
            contentArea.innerHTML = `<h2>Задания курса</h2>`;
            const list = document.createElement('ul');
            tasks.forEach(task => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `${task.task_description} <span id="task-status-${task.task_id}"></span>`;
                list.appendChild(listItem);
                fetchTaskStatus(courseId, task.task_id);
            });
            contentArea.appendChild(list);
        })
        .catch(error => {
            console.error('Error fetching course tasks:', error);
            contentArea.innerHTML = `<p>Ошибка при загрузке заданий курса.</p>`;
        });
}

function fetchTaskStatus(courseId, taskId) {
    fetch(`/api/task-status/${courseId}/${taskId}`, { credentials: 'include' })
        .then(response => response.json())
        .then(status => {
            const statusElement = document.getElementById(`task-status-${taskId}`);
            if (status && statusElement) {
                let icon;
                switch (status) {
                    case 'completed':
                        icon = '<i class="fas fa-check-circle" style="color: green;"></i>';
                        break;
                    case 'incorrect':
                        icon = '<i class="fas fa-times-circle" style="color: red;"></i>';
                        break;
                    default:
                        icon = '<i class="fas fa-circle" style="color: gray;"></i>';
                }
                statusElement.innerHTML = icon;
            }
        })
        .catch(error => {
            console.error('Error fetching task status:', error);
        });
}

function showCourseDetails(courseId) {
    fetch(`/api/course-tasks/${courseId}`)
        .then(response => response.json())
        .then(tasks => {
            const contentArea = document.getElementById('contentArea');
            contentArea.innerHTML = `<h2>Задания курса</h2>`;
            const list = document.createElement('ul');
            tasks.forEach(task => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `${task.task_description} <span id="task-status-${task.task_id}"></span>`;
                list.appendChild(listItem);
                fetchTaskStatus(courseId, task.task_id);
            });
            contentArea.appendChild(list);
        })
        .catch(error => {
            console.error('Error fetching course tasks:', error);
            contentArea.innerHTML = `<p>Ошибка при загрузке заданий курса.</p>`;
        });
}

function fetchTaskStatus(courseId, taskId) {
    fetch(`/api/task-status/${courseId}/${taskId}`, { credentials: 'include' })
        .then(response => response.json())
        .then(status => {
            const statusElement = document.getElementById(`task-status-${taskId}`);
            if (statusElement) {
                let icon;
                switch (status) {
                    case 'success': // Assuming 'success' means 'completed'
                        icon = '<i class="fas fa-check-circle" style="color: green;"></i>';
                        break;
                    case 'failure': // Assuming 'failure' means 'incorrect'
                        icon = '<i class="fas fa-times-circle" style="color: red;"></i>';
                        break;
                    default: // Handle 'not_started' or any other unknown status
                        icon = '<i class="fas fa-circle" style="color: gray;"></i>';
                }
                statusElement.innerHTML = icon;
            }
        })
        .catch(error => {
            console.error('Error fetching task status:', error);
        });
}
document.addEventListener('DOMContentLoaded', fetchUserData);

function displayUserData(userData) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `<h1>Мои данные</h1><p>Имя: ${userData.name}</p> <p>Логин: ${userData.login}<p>Email: ${userData.email}</p>`;
}
//Проверка роли пользователя и добавление вкладки если нужно
document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/user-data', { method: 'GET', credentials: 'include' })
        .then(response => response.json())
        .then(userData => {
            if (userData.role === 'admin') {
                const navPanel = document.querySelector('.nav-panel');
                const adminLink = document.createElement('a');
                adminLink.href = "#";
                adminLink.className = "nav-link";
                adminLink.innerText = "Администрирование";
                adminLink.onclick = function () { showTab('admin'); };
            }
            if (['admin', 'teacher'].includes(userData.role)) {
                const navPanel = document.querySelector('.nav-panel');
                const createCourseLink = document.createElement('a');
                createCourseLink.href = "#";
                createCourseLink.className = "nav-link";
                createCourseLink.innerText = "Создать курс";
                createCourseLink.onclick = function () { showTab('createCourse'); };
            }
        });
});
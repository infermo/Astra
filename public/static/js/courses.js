document.addEventListener('DOMContentLoaded', function () {
    checkAuthStatusAndUpdateNav();
});

function checkAuthStatusAndUpdateNav() {
    fetch('/api/check-auth', { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch auth status');
            }
            return response.json();
        })
        .then(data => {
            const navPanel = document.querySelector('.header');
            if (data.isAuthenticated) {
                updateNavForAuthenticatedUser(navPanel);
            } else {
                updateNavForUnauthenticatedUser(navPanel);
            }
        })
        .catch(error => {
            console.error('Ошибка при проверке статуса аутентификации:', error);
            updateNavForUnauthenticatedUser(document.querySelector('.header'));
        });
}

function updateNavForAuthenticatedUser(navPanel) {
    removeNavLink('Регистрация');
    removeNavLink('Войти');
    addNavLink(navPanel, '/lk.html', 'Личный кабинет');
}

function updateNavForUnauthenticatedUser(navPanel) {
    removeNavLink('Личный кабинет');
}

function addNavLink(navPanel, href, text) {
    if (!document.querySelector(`a[href='${href}']`)) {
        const link = document.createElement('a');
        link.href = href;
        link.className = 'nav-link';
        link.textContent = text;
        navPanel.appendChild(link);
    }
}

function removeNavLink(text) {
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        if (link.textContent === text) {
            link.parentNode.removeChild(link);
        }
    });
}

function fetchUserDataAndCourses() {
    fetch('/api/get-user-id', { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                fetchCourses();
                throw new Error('Failed to fetch user data');
            }
            return response.json();
        })
        .then(userData => {
            const userId = userData.userId;
            fetchCourses(userId);
        })
        .catch(error => {
            console.error('Ошибка при получении данных пользователя:', error);
            fetchCourses();
        });
}

document.addEventListener('DOMContentLoaded', fetchUserDataAndCourses);

function fetchCourses(userId = null) {
    fetch('/api/courses', { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch courses');
            }
            return response.json();
        })
        .then(courses => {
            const mainContainer = document.querySelector('.main');
            mainContainer.innerHTML = '';

            courses.forEach(course => {
                const courseCard = document.createElement('div');
                courseCard.className = 'course-card';
                courseCard.innerHTML = `
                    <h3>${course.course_name}</h3>
                    <p>${course.description || 'Изучим Astra Linux'}</p>
                    <div class="button-container">
                        <button onclick="showCourseDetails(${course.course_id})">Подробнее</button>
                    </div>`;

                if (userId) {
                    fetch(`/api/check-enrollment/${userId}/${course.course_id}`, { credentials: 'include' })
                        .then(res => res.json())
                        .then(enrollmentData => {
                            if (enrollmentData.isEnrolled) {
                                courseCard.innerHTML += `<p>Вы уже записаны!</p>`;
                            } else {
                                const buttonContainer = courseCard.querySelector('.button-container');
                                const enrollButton = document.createElement('button');
                                enrollButton.textContent = 'Записаться';
                                enrollButton.onclick = function () {
                                    enrollCourse(userId, course.course_id);
                                };
                                buttonContainer.appendChild(enrollButton);
                            }
                            mainContainer.appendChild(courseCard);
                        });
                } else {
                    mainContainer.appendChild(courseCard);
                }
            });
        })
        .catch(error => {
            console.error('Ошибка при получении курсов:', error);
        });
}

function enrollCourse(userId, courseId) {
    fetch('/api/enroll-course', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ userId, courseId })
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            if (data.success) {
                location.reload();
            }
        })
        .catch(error => {
            console.error('Ошибка при записи на курс:', error);
            alert('Произошла ошибка при записи на курс.');
        });
}

function showCourseDetails(courseId) {
    fetch(`/api/course-tasks/${courseId}`)
        .then(response => response.json())
        .then(tasks => {
            const modal = document.getElementById('courseModal');
            const modalContent = document.querySelector('.modal-content');

            modalContent.innerHTML = ''; // Очищаем старое содержимое

            // Создаем заголовок
            const title = document.createElement('h3');
            title.textContent = `Задание курса ${courseId}`;
            modalContent.appendChild(title);

            // Создаем список заданий
            const taskList = document.createElement('div');
            taskList.style.marginTop = '20px';

            if (!Array.isArray(tasks) || tasks.length === 0) {
                const noTasksMessage = document.createElement('p');
                noTasksMessage.textContent = 'Задания отсутствуют.';
                taskList.appendChild(noTasksMessage);
            } else {
                tasks.forEach(task => {
                    const taskItem = document.createElement('div');
                    taskItem.style.backgroundColor = '#e4e4e4';
                    taskItem.style.padding = '10px';
                    taskItem.style.marginBottom = '10px';
                    taskItem.style.borderRadius = '10px';

                    taskItem.textContent = task.task_description;
                    taskList.appendChild(taskItem);
                });
            }

            modalContent.appendChild(taskList);

            // Добавляем кнопку закрытия
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Закрыть';
            closeButton.style.marginTop = '20px';
            closeButton.style.background = '#007BFF';
            closeButton.style.color = 'white';
            closeButton.style.padding = '10px 20px';
            closeButton.style.border = 'none';
            closeButton.style.borderRadius = '5px';
            closeButton.style.cursor = 'pointer';

            closeButton.addEventListener('click', () => {
                modal.style.display = 'none';
            });

            modalContent.appendChild(closeButton);

            modal.style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching course details:', error);
            alert('Ошибка при загрузке деталей курса.');
        });
}



function closeModal() {
    document.getElementById('courseModal').style.display = "none";
}

window.onclick = function (event) {
    let modal = document.getElementById('courseModal');
    if (event.target === modal) {
        modal.style.display = "none";
    }
}
document.addEventListener('DOMContentLoaded', function () {
    checkAuthStatusAndUpdateNav();

    // Находим ссылку на ЛК
    const lkLink = document.getElementById('lkLink');
    if (lkLink) {
        lkLink.addEventListener('click', function (event) {
            event.preventDefault();
            // Перед переходом проверяем авторизацию
            fetch('/api/check-auth', { credentials: 'include' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch auth status');
                    }
                    return response.json();
                })
                .then(data => {
                    // Если пользователь авторизован – отправляем в ЛК
                    if (data.isAuthenticated) {
                        window.location.href = 'lk.html';
                    } else {
                        // Если не авторизован – сразу на страницу авторизации
                        window.location.href = 'auth.html';
                    }
                })
                .catch(error => {
                    console.error('Ошибка при проверке статуса аутентификации:', error);
                    // При ошибке тоже переводим на авторизацию
                    window.location.href = 'auth.html';
                });
        });
    }
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
            if (data.isAuthenticated) {
                updateNavForAuthenticatedUser();
            } else {
                updateNavForUnauthenticatedUser();
            }
        })
        .catch(error => {
            console.error('Ошибка при проверке статуса аутентификации:', error);
            updateNavForUnauthenticatedUser();
        });
}

function updateNavForAuthenticatedUser() {
    // Если пользователь авторизован, например, прячем ссылку "Регистрация"
    const regLink = document.getElementById('regLink');
    if (regLink) {
        regLink.parentNode.removeChild(regLink);
    }
}

function updateNavForUnauthenticatedUser() {
    // Если пользователь не авторизован, можно скрыть некоторые ссылки и т.д.
}
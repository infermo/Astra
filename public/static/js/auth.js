document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var login = document.getElementById('login').value;
    var password = document.getElementById('password').value;

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ login, password })
    })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'Успешный вход') {
                console.log(data.message);
                window.location.href = '/lk.html'; // Redirect on successful login
            } else {
                console.log(data.message);
                alert(data.message);  // Show error message
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Произошла ошибка при попытке входа');
        });
});
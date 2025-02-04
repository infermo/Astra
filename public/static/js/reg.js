const nameInput = document.getElementById('name');
const patronymicInput = document.getElementById('patronymic');
const surnameInput = document.getElementById('surname');
const loginInput = document.getElementById('login');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const submitButton = document.querySelector('button[type="submit"]');

const confirmPasswordError = document.getElementById('confirmPasswordError');

const passwordRequirements = {
    lengthRequirement: false,
    uppercaseRequirement: false,
    lowercaseRequirement: false,
    specialCharRequirement: false
};

// Проверка соответствия паролю политике
function validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-ZА-Я]/.test(password);
    const hasLowerCase = /[a-zа-я]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasMinLength = password.length >= minLength;

    // Обновляем состояние требований
    passwordRequirements.lengthRequirement = hasMinLength;
    passwordRequirements.uppercaseRequirement = hasUpperCase;
    passwordRequirements.lowercaseRequirement = hasLowerCase;
    passwordRequirements.specialCharRequirement = hasSpecialChar;

    // Обновляем отображение требований
    document.getElementById('lengthRequirement').className = hasMinLength ? 'valid' : 'invalid';
    document.getElementById('uppercaseRequirement').className = hasUpperCase ? 'valid' : 'invalid';
    document.getElementById('lowercaseRequirement').className = hasLowerCase ? 'valid' : 'invalid';
    document.getElementById('specialCharRequirement').className = hasSpecialChar ? 'valid' : 'invalid';

    // Проверяем, все ли требования соблюдены
    return hasMinLength && hasUpperCase && hasLowerCase && hasSpecialChar;
}

// Проверка совпадения паролей
function checkPasswordsMatch() {
    if (passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordError.textContent = 'Пароли не совпадают';
        return false;
    } else {
        confirmPasswordError.textContent = '';
        return true;
    }
}

// Проверка, что все обязательные поля заполнены
function allFieldsFilled() {
    return (
        nameInput.value.trim() !== '' &&
        patronymicInput.value.trim() !== '' &&
        surnameInput.value.trim() !== '' &&
        loginInput.value.trim() !== '' &&
        emailInput.value.trim() !== '' &&
        passwordInput.value.trim() !== '' &&
        confirmPasswordInput.value.trim() !== ''
    );
}

// Общая функция для обновления кнопки
function updateSubmitButtonState() {
    const isPasswordValid = validatePassword(passwordInput.value);
    const doPasswordsMatch = checkPasswordsMatch();
    const fieldsFilled = allFieldsFilled();

    submitButton.disabled = !(isPasswordValid && doPasswordsMatch && fieldsFilled);
}

// Вешаем слушатели на все поля, чтобы при любом изменении обновлять состояние кнопки
nameInput.addEventListener('input', updateSubmitButtonState);
patronymicInput.addEventListener('input', updateSubmitButtonState);
surnameInput.addEventListener('input', updateSubmitButtonState);
loginInput.addEventListener('input', updateSubmitButtonState);
emailInput.addEventListener('input', updateSubmitButtonState);

passwordInput.addEventListener('input', function () {
    validatePassword(this.value);
    updateSubmitButtonState();
});

confirmPasswordInput.addEventListener('input', function () {
    checkPasswordsMatch();
    updateSubmitButtonState();
});

// При отправке формы
document.getElementById('registrationForm').addEventListener('submit', function (event) {
    event.preventDefault();

    // Дополнительная страховка от случайной отправки, если кнопка всё же неактивна
    //if (submitButton.disabled) return;

    const formData = {
        name: this.name.value,
        patronymic: this.patronymic.value,
        surname: this.surname.value,
        login: this.login.value,
        password: passwordInput.value,
        email: this.email.value
    };

    fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    })
        .then(response => response.json())
        .then(data => {
            if (data.message.includes('Пользователь добавлен с ID:')) {
                alert('Регистрация успешна!');
                window.location.href = '/auth.html';
            } else {
                alert(data.message || 'Ошибка при регистрации');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Ошибка при регистрации');
        });
});
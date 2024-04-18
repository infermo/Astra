const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // Папка для статических файлов

const pool = new Pool({
    user: 'postgres',
    host: '192.168.31.120',
    database: 'postgres',
    password: 'ASdf1234',
    port: 5432,
});

app.use(session({
    secret: 'asdasdasdasdasdasdasd',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function isAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.status(401).json({ message: 'Пользователь не авторизован' });
    }
}

// Use this middleware for routes that require authentication
app.get('/lk.html', isAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/lk.html'); // Ensure you adjust the path correctly
});


app.post('/login', async (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
        return res.status(400).json({ message: 'Требуется логин и пароль.' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role }; // Store only essential info
                req.session.isAuthenticated = true;
                console.log(req.session);
                res.json({ message: 'Успешный вход' });
            } else {
                res.status(401).json({ message: 'Не верный логин и/или пароль' });
            }
        } else {
            res.status(401).json({ message: 'Не верный логин и/или пароль' });
        }
    } catch (error) {
        console.error('Ошибка сервера', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.post('/register', async (req, res) => {
    const { name, patronymic, surname, login, password, email, role = 'student' } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    pool.query('INSERT INTO users (name, patronymic, surname, login, password, email, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [name, patronymic, surname, login, hashedPassword, email, role], (error, results) => {
            if (error) {
                return res.status(500).send({ message: 'Ошибка при регистрации пользователя' });
            }
            res.status(201).send({ message: `Пользователь добавлен с ID: ${results.rows[0].id}` });
        });
});
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Не удалось выйти из системы');
        }
        res.send({ message: 'Вы вышли из системы' });
    });
});
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, login, role FROM users');
        res.status(200).json(result.rows);
        //console.log(result);
        return; // Важно вернуться после отправки ответа, чтобы избежать дальнейшего выполнения кода
    } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        res.status(500).json({ message: 'Ошибка при получении списка пользователей' });
        return; // Также возвращаемся после отправки ответа в случае ошибки
    }

});

app.get('/api/user-data', async (req, res) => {
    if (!req.session || !req.session.user) {
        res.status(401).json({ error: "Пользователь не авторизован" });
        return;
    }
    // Если всё в порядке, возвращаем данные пользователя
    res.json({ name: req.session.user.name, email: req.session.user.email, role: req.session.user.role });
});

app.post('/change-role', async (req, res) => {
    const { userId, newRole } = req.body;
    if (!['admin', 'teacher', 'student'].includes(newRole)) {
        return res.status(400).json({ message: 'Некорректная роль' });
    }

    try {
        const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING *', [newRole, userId]);
        if (result.rows.length > 0) {
            res.status(200).json({ success: true, message: 'Роль успешно изменена', user: result.rows[0] });
        } else {
            res.status(404).json({ message: 'Пользователь не найден' });
        }
    } catch (error) {
        console.error('Ошибка при изменении роли:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
app.post('/create-course', async (req, res) => {
    const { courseName, courseDescription } = req.body;
    const userId = req.user.id;  // Убедитесь, что у пользователя есть middleware для аутентификации
    // Проверяем роль пользователя
    if (!['teacher', 'admin'].includes(req.user.role)) {
        return res.status(403).send({ message: 'Недостаточно прав для создания курса' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO courses (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
            [courseName, courseDescription, userId]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании курса:', error);
        res.status(500).json({ message: 'Ошибка при создании курса' });
    }
});


app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const axios = require('axios');

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
    saveUninitialized: true,
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
app.get('/api/get-user-id', (req, res) => {
    if (req.session && req.session.user && req.session.user.id) {
        res.json({ userId: req.session.user.id });
    } else {
        res.status(401).json({ message: 'User not authenticated' });
    }
});


app.get('/api/user-data', async (req, res) => {
    if (!req.session || !req.session.user) {
        res.status(401).json({ error: "Пользователь не авторизован" });
        return;
    }
    // Если всё в порядке, возвращаем данные пользователя
    res.json({ userID: req.session.user.id, name: req.session.user.name, email: req.session.user.email, role: req.session.user.role });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ isAuthenticated: true });
    } else {
        res.json({ isAuthenticated: false });
    }
});

app.get('/api/courses', (req, res) => {
    // Предполагается, что вы используете PostgreSQL и pool для запросов
    pool.query('SELECT * FROM courses', (error, results) => {
        if (error) {
            throw error;
        }
        res.status(200).json(results.rows);
    });
});
app.delete('/api/courses/:courseId', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    const { courseId } = req.params;
    try {
        const deleteQuery = 'DELETE FROM courses WHERE course_id = $1';
        const result = await pool.query(deleteQuery, [courseId]);
        if (result.rowCount > 0) {
            res.status(200).json({ message: 'Курс успешно удален' });
        } else {
            res.status(404).json({ message: 'Курс не найден' });
        }
    } catch (error) {
        console.error('Ошибка при удалении курса:', error);
        res.status(500).json({ message: 'Ошибка сервера при удалении курса' });
    }
});

app.get('/api/course-tasks/:courseId', async (req, res) => {
    const { courseId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM course_tasks WHERE course_id = $1', [courseId]);
        if (result.rows.length > 0) {
            res.json(result.rows);
        } else {
            res.status(404).send({ message: 'No tasks found for this course.' });
        }
    } catch (error) {
        console.error('Error retrieving course tasks:', error);
        res.status(500).json({ message: 'Server error retrieving tasks.' });
    }
});

// Endpoint для записи пользователя на курс
app.post('/api/enroll-course', (req, res) => {
    if (!req.session || !req.session.user.id) {
        return res.status(401).json({ message: 'Неавторизованный доступ' });
    }
    const userId = req.session.user.id;
    const { courseId } = req.body;

    const query = 'INSERT INTO user_courses (user_id, course_id) VALUES ($1, $2)';
    pool.query(query, [userId, courseId], (error, result) => {
        if (error) {
            console.error('Ошибка при записи на курс:', error);
            return res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
        res.json({ success: true, message: 'Вы успешно записаны на курс.' });
    });
});
// Endpoint для проверки, записан ли пользователь на курс
app.get('/api/check-enrollment/:userId/:courseId', (req, res) => {
    const { userId, courseId } = req.params;
    const query = 'SELECT 1 FROM user_courses WHERE user_id = $1 AND course_id = $2';
    pool.query(query, [userId, courseId], (error, result) => {
        if (error) {
            res.status(500).json({ success: false, message: 'Ошибка при проверке записи на курс.' });
        } else {
            const isEnrolled = result.rowCount > 0;
            res.json({ isEnrolled });
        }
    });
});

app.get('/api/my-courses', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    try {
        let query = '';
        let params = [];

        if (userRole === 'student') {
            query = `
                SELECT c.* FROM courses c
                JOIN user_courses uc ON uc.course_id = c.course_id
                WHERE uc.user_id = $1
            `;
            params = [userId];
        } else if (userRole === 'teacher') {
            query = 'SELECT * FROM courses WHERE created_by = $1';
            params = [userId];
        } else if (userRole === 'admin') {
            query = 'SELECT * FROM courses';
            // Для админа запрос выполняется без параметров
            if (params.length === 0) {
                const result = await pool.query(query);
                res.json(result.rows);
                return;
            }
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error retrieving courses:', error);
        res.status(500).json({ message: 'Server error retrieving courses.' });
    }
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
app.post('/api/create-course', async (req, res) => {
    const { courseName, tasks } = req.body;

    // Проверяем, существует ли уже курс с таким названием
    try {
        const existingCourse = await pool.query('SELECT * FROM courses WHERE course_name = $1', [courseName]);
        if (existingCourse.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Курс с таким названием уже существует' });
        }

        // Вставляем новый курс, если с таким названием не найдено
        const newCourse = await pool.query('INSERT INTO courses (course_name, created_by) VALUES ($1, $2) RETURNING course_id', [courseName, req.session.user.id]);
        const courseId = newCourse.rows[0].course_id;

        // Вставляем задания для курса, если они есть
        if (tasks && tasks.length) {
            for (let task of tasks) {
                await pool.query('INSERT INTO course_tasks (course_id, task_description) VALUES ($1, $2)', [courseId, task]);
            }
        }

        res.status(201).json({ success: true, message: 'Курс успешно создан', courseId: courseId });
    } catch (error) {
        console.error('Ошибка при создании курса:', error);
        res.status(500).json({ success: false, message: 'Ошибка сервера при создании курса' });
    }
});


app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});

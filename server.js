const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const app = express();
const passwordValidator = require('password-validator');
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { exec } = require('child_process');
const { t } = require('tar');
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));


//const host = '192.168.31.21';
const host = '10.185.235.178';
const pool = new Pool({
    user: 'postgres',
    host: 'db',
    database: 'postgres',
    port: 5432,
    ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(path.join(__dirname, 'ssl', 'rootCA.crt')).toString(),
        cert: fs.readFileSync(path.join(__dirname, 'ssl', 'client.crt')).toString(),
        key: fs.readFileSync(path.join(__dirname, 'ssl', 'client.key')).toString(),
    }
});
pool.query('SELECT version()')
    .then(res => console.log(res.rows))
    .catch(err => console.error(err));

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
                req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role, login: user.login }; // Store only essential info
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
const schema = new passwordValidator();
schema
    .is().min(8)
    .has().uppercase()
    .has().lowercase()
    .has().symbols();

app.post('/register', async (req, res) => {
    const { name, patronymic, surname, login, password, email, role = 'student' } = req.body;

    if (!schema.validate(password)) {
        return res.status(400).json({ message: 'Пароль не соответствует требованиям безопасности.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    pool.query('INSERT INTO users (name, patronymic, surname, login, password, email, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [name, patronymic, surname, login, hashedPassword, email, role], (error, results) => {
            if (error) {
                return res.status(500).send({ message: 'Ошибка при регистрации пользователя' });
            }

            // Вызов функции для добавления пользователя в FreeIPA
            addUserToFreeIPA(login, password, (err, result) => {
                if (err) {
                    return res.status(500).send({ message: 'Пользователь зарегистрирован, но произошла ошибка при добавлении в FreeIPA' });
                }
                res.status(201).send({ message: `Пользователь добавлен с ID: ${results.rows[0].id} и добавлен в FreeIPA` });
            });
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
    res.json({ userID: req.session.user.id, name: req.session.user.name, email: req.session.user.email, role: req.session.user.role, login: req.session.user.login, password: req.session.user.password });

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
app.delete('/api/users/:userId', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    const { userId } = req.params;
    try {
        const deleteResult = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        if (deleteResult.rowCount > 0) {
            res.status(200).json({ success: true, message: 'Пользователь успешно удален' });
        } else {
            res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }
    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        res.status(500).json({ success: false, message: 'Ошибка сервера при удалении пользователя' });
    }
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

app.get('/api/termidesk-sessions', isAuthenticated, async (req, res) => {
    try {
        const response = await axios.get('http://192.168.31.100:9100/metrics');
        const data = response.data;
        const match = data.match(/active_termidesk_sessions\s+(\d+)/);
        if (match) {
            const activeSessions = parseInt(match[1], 10);
            res.json({ activeSessions });
        } else {
            res.status(500).json({ message: 'Не удалось найти данные о сессиях' });
        }
    } catch (error) {
        console.error(`Ошибка при выполнении запроса: ${error.message}`);
        res.status(500).json({ message: 'Ошибка при получении данных о сессиях' });
    }
});


function addUserToFreeIPA(username, password, callback) {
    const group = 'freeipa_users';
    const expireDate = '20380119031407Z';
    const ipaServerIP = '10.185.224.2';
    const sshUser = 'adm2';
    const kerberosUser = 'admin';
    const kerberosPassword = process.env.KERBEROS_PASSWORD;
    ssh.connect({
        host: ipaServerIP,
        username: sshUser,
        privateKey: fs.readFileSync(path.join(__dirname, 'ssh', 'id_rsa')).toString()
    }).then(async () => {
        try {
            console.log('Получение билета Kerberos...');
            let result = await ssh.execCommand(`echo "${kerberosPassword}" | kinit ${kerberosUser}`);
            if (result.code !== 0) {
                throw new Error(`Ошибка при аутентификации Kerberos: ${result.stderr}`);
            }
            // Проверка существования пользователя
            result = await ssh.execCommand(`ipa user-show ${username}`);
            if (result.code === 0) {
                console.log(`Пользователь ${username} уже существует, пересоздание...`);
                result = await ssh.execCommand(`ipa user-del ${username}`);
                if (result.code !== 0) {
                    throw new Error(`Ошибка при удалении пользователя ${username}: ${result.stderr}`);
                }
            }

            // Создание пользователя
            console.log(`Создание пользователя ${username}`);
            result = await ssh.execCommand(`echo -e "${password}\\n${password}" | ipa user-add ${username} --first=FreeIPA --last=Astra --password`);
            if (result.code !== 0) {
                throw new Error(`Ошибка при создании пользователя ${username}: ${result.stderr}`);
            }

            // Установка пароля и отключение требования его смены
            console.log(`Установка пароля для ${username}`);
            result = await ssh.execCommand(`echo -e "${password}\\n${password}" | ipa passwd ${username}`);
            if (result.code !== 0) {
                throw new Error(`Ошибка при установке пароля для ${username}: ${result.stderr}`);
            }

            console.log(`Отключение требования смены пароля для ${username}`);
            result = await ssh.execCommand(`ipa user-mod ${username} --setattr=krbPasswordExpiration=${expireDate}`);
            if (result.code !== 0) {
                throw new Error(`Ошибка при отключении требования смены пароля для ${username}: ${result.stderr}`);
            }

            // Добавление пользователя в группу
            console.log(`Добавление пользователя ${username} в группу ${group}`);
            result = await ssh.execCommand(`ipa group-add-member ${group} --users=${username}`);
            if (result.code !== 0) {
                throw new Error(`Ошибка при добавлении пользователя ${username} в группу ${group}: ${result.stderr}`);
            }

            console.log(`Пользователь ${username} создан и добавлен в группу ${group}`);
            callback(null, `Пользователь ${username} создан и добавлен в группу ${group}`);
        } catch (error) {
            console.error(error.message);
            callback(error);
        } finally {
            ssh.dispose();
        }
    }).catch(err => {
        console.error(`Ошибка подключения к серверу FreeIPA: ${err.message}`);
        callback(err);
    });
};


app.post('/api/submit-result', async (req, res) => {
    const { login, courseId, taskId, result, status } = req.body;

    try {
        // Получаем user_id по логину
        const userQuery = 'SELECT id FROM users WHERE login = $1';
        const userResult = await pool.query(userQuery, [login]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        const userId = userResult.rows[0].id;

        // Проверяем, существует ли уже запись результата для данного пользователя, курса и задания
        const checkQuery = 'SELECT id FROM task_results WHERE user_id = $1 AND course_id = $2 AND task_id = $3';
        const checkResult = await pool.query(checkQuery, [userId, courseId, taskId]);

        if (checkResult.rows.length > 0) {
            // Если запись существует, обновляем её
            const updateQuery = 'UPDATE task_results SET result = $1, status = $2, date = NOW() WHERE user_id = $3 AND course_id = $4 AND task_id = $5 RETURNING id';
            const updateValues = [result, status, userId, courseId, taskId];
            const updateResult = await pool.query(updateQuery, updateValues);
            res.status(200).json({ message: 'Результат успешно обновлен', resultId: updateResult.rows[0].id });
        } else {
            // Если записи нет, вставляем новую
            const insertQuery = 'INSERT INTO task_results (user_id, course_id, task_id, result, status, date) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id';
            const insertValues = [userId, courseId, taskId, result, status];
            const insertResult = await pool.query(insertQuery, insertValues);
            res.status(200).json({ message: 'Результат успешно записан', resultId: insertResult.rows[0].id });
        }
    } catch (error) {
        console.error('Ошибка при записи результата в базу данных:', error);
        res.status(500).json({ message: 'Ошибка при записи результата' });
    }
});
app.get('/api/task-status/:courseId/:taskId', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const { courseId, taskId } = req.params;
    try {
        const result = await pool.query(
            'SELECT status FROM task_results WHERE user_id = $1 AND course_id = $2 AND task_id = $3',
            [userId, courseId, taskId]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0].status);
        } else {
            res.json(null); // Возвращаем null, если статуса нет
        }
    } catch (error) {
        console.error('Error retrieving task status:', error);
        res.status(500).json({ message: 'Server error retrieving task status.' });
    }
});

module.exports = { addUserToFreeIPA };
app.listen(3000, () => {
    console.log(`Host ip: ${host}:3000`);
    //console.log('Сервер запущен на порту 3000');
});
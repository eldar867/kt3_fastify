const fastify = require('fastify')({ logger: false }); // logger: false чтобы не спамил в консоль
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 1. База данных
const db = new sqlite3.Database('./users.db');

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)");
});

// 2. Плагины
async function init() {
  // Статика (CSS)
  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, '../public'),
    prefix: '/public/' 
  });

  // Парсер форм
  await fastify.register(require('@fastify/formbody'));

  // Шаблоны Pug
  await fastify.register(require('@fastify/view'), {
    engine: { pug: require('pug') },
    root: path.join(__dirname, '../views')
  });

  // 3. Маршруты

  // Главная -> редирект на список
  fastify.get('/', async (request, reply) => {
    return reply.redirect('/users');
  });

  // СПИСОК пользователей
  fastify.get('/users', async (request, reply) => {
    const users = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM users", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    return reply.view('users.pug', { users: users });
  });

  // Страница СОЗДАНИЯ
  fastify.get('/create', async (request, reply) => {
    return reply.view('create.pug');
  });

  // Обработка СОЗДАНИЯ (POST)
  fastify.post('/create', async (request, reply) => {
    const { name, email } = request.body;
    await new Promise((resolve, reject) => {
      db.run("INSERT INTO users (name, email) VALUES (?, ?)", [name, email], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return reply.redirect('/users');
  });

  // Страница РЕДАКТИРОВАНИЯ
  // Важно: этот роут должен быть ПОСЛЕ статических, но мы используем конкретный путь /edit/:id
  fastify.get('/edit/:id', async (request, reply) => {
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE id = ?", [request.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) return reply.code(404).send('User not found');
    return reply.view('edit.pug', { user: user });
  });

  // Обработка ОБНОВЛЕНИЯ (POST)
  fastify.post('/update/:id', async (request, reply) => {
    const { name, email } = request.body;
    const id = request.params.id;
    
    await new Promise((resolve, reject) => {
      db.run("UPDATE users SET name = ?, email = ? WHERE id = ?", [name, email, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return reply.redirect('/users');
  });

  // УДАЛЕНИЕ (DELETE)
  fastify.delete('/delete/:id', async (request, reply) => {
    const id = request.params.id;
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM users WHERE id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return { status: 'ok' }; // Возвращаем JSON для fetch запроса
  });

  // Запуск
  try {
    await fastify.listen({ port: 3000, host: '127.0.0.1' });
    console.log('Server started: http://127.0.0.1:3000');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

init();
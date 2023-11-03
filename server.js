const express = require('express');
const sql = require('mssql');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cutAudio = require('./audioCutter');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const moment = require('moment-timezone');
const bcrypt = require('bcrypt');
const cors = require('cors');
const fs = require('fs');
const fsPromises = fs.promises;
const corsOptions = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    optionsSuccessStatus: 200
};

const app = express();

// Requerimos el módulo 'dotenv' y ejecutamos su método 'config'
require('dotenv').config();
require('moment/locale/es'); // Importar la localización en español
const { check, validationResult } = require('express-validator');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/views', express.static(path.join(__dirname, 'views')));
app.use(express.static('public')); // Aquí es donde debes poner esta línea
app.use('/public', express.static('public'));
app.use('/audio', express.static('/mnt/CapitalPress/Transcripciones texto'));
app.use('/fragmentos', express.static('/mnt/CapitalPress/Fragmentos'));
app.use(cors()); // Habilitar CORS para todas las rutas
// Sirve los archivos estáticos de la carpeta 'build'
app.use(express.static(path.join(__dirname, 'build')));




app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// A partir de aquí van tus rutas y la línea para iniciar el servidor



app.use(session({
    secret: process.env.SESSION_SECRET, // Obtenemos la clave secreta desde las variables de entorno
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // En un ambiente de producción deberías cambiar secure a true
}));


const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

function validateToken(token) {
    try {
        // Verifica el token
        const decoded = jwt.verify(token, SECRET_KEY);

        // Si es válido, devuelve la carga útil
        return decoded;
    } catch (error) {
        // Si hay algún error (token no válido, token caducado, etc.), devuelve null
        return null;
    }
}


app.get('/', checkAuthenticated, function(req, res) {
    console.log(req.session.user);
    const keyword = req.query.keyword;
    let page = req.query.page;
    if (!page) {
        page = 1;
    } else if (page < 1) {
        res.status(400).send('Invalid page number');
        return;
    }

    const pageSize = 20;  // Define your page size here
    const skip = (page - 1) * pageSize;

    const noticiasPromise = sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('cliente_id', sql.Int, parseInt(req.session.user.cliente_id));
        request.input('user_id', sql.Int, parseInt(req.session.user.ID));
        const rowStart = (page - 1) * pageSize + 1;
        const rowEnd = page * pageSize;
        if (keyword) {
            request.input('keyword', sql.NVarChar, keyword);
            const query = `
            WITH OrderedNoticias AS (
                SELECT NoticiasRadio.id, NoticiasRadio.titulo, NoticiasRadio.texto, NoticiasRadio.fecha_medio, Medios.nombre AS medio_nombre,
                       ROW_NUMBER() OVER (ORDER BY NoticiasRadio.fecha_medio DESC) as rn
                FROM (
                    SELECT DISTINCT NoticiasRadio.id
                    FROM UsuariosClientes
                    INNER JOIN ClientesNoticias ON UsuariosClientes.cliente_id = ClientesNoticias.cliente_id
                    INNER JOIN NoticiasRadio ON ClientesNoticias.noticia_id = NoticiasRadio.id
                    INNER JOIN PalabrasClaves ON PalabrasClaves.cliente_id = UsuariosClientes.cliente_id
                    WHERE UsuariosClientes.user_id = @user_id
                    AND (NoticiasRadio.titulo LIKE '%' + PalabrasClaves.palabra + '%'
                    OR NoticiasRadio.texto LIKE '%' + PalabrasClaves.palabra + '%')
                ) AS DistinctNoticiasIDs
                INNER JOIN NoticiasRadio ON DistinctNoticiasIDs.id = NoticiasRadio.id
                LEFT JOIN Medios ON NoticiasRadio.medio_id = Medios.id
            )
            SELECT * FROM OrderedNoticias WHERE rn BETWEEN ${rowStart} AND ${rowEnd}`;

            return request.query(query);
        } else {
            const query = `
                WITH OrderedNoticias AS (
                    SELECT NoticiasRadio.id, NoticiasRadio.titulo, NoticiasRadio.texto, NoticiasRadio.fecha_medio, Medios.nombre AS medio_nombre,
                           ROW_NUMBER() OVER (ORDER BY NoticiasRadio.fecha_medio DESC) as rn
                    FROM (
                        SELECT DISTINCT NoticiasRadio.id
                        FROM UsuariosClientes
                        INNER JOIN ClientesNoticias ON UsuariosClientes.cliente_id = ClientesNoticias.cliente_id
                        INNER JOIN NoticiasRadio ON ClientesNoticias.noticia_id = NoticiasRadio.id
                        INNER JOIN PalabrasClaves ON PalabrasClaves.cliente_id = UsuariosClientes.cliente_id
                        WHERE UsuariosClientes.user_id = @user_id
                        AND (NoticiasRadio.titulo LIKE '%' + PalabrasClaves.palabra + '%'
                        OR NoticiasRadio.texto LIKE '%' + PalabrasClaves.palabra + '%')
                    ) AS DistinctNoticiasIDs
                    INNER JOIN NoticiasRadio ON DistinctNoticiasIDs.id = NoticiasRadio.id
                    LEFT JOIN Medios ON NoticiasRadio.medio_id = Medios.id
                )
                SELECT * FROM OrderedNoticias WHERE rn BETWEEN ${rowStart} AND ${rowEnd}`;
            return request.query(query);
        }
    });

    // Paginacion
    const userId = req.session.user.ID;

    const totalNoticiasPromise = sql.connect(dbConfig).then(function() {
        return new sql.Request()
            .input('user_id', sql.Int, userId)
            .query(`SELECT COUNT(*) AS total
                    FROM UsuariosClientes
                    INNER JOIN ClientesNoticias ON UsuariosClientes.cliente_id = ClientesNoticias.cliente_id
                    INNER JOIN NoticiasRadio ON ClientesNoticias.noticia_id = NoticiasRadio.id
                    WHERE UsuariosClientes.user_id = @user_id
                    AND EXISTS (
                        SELECT 1 FROM PalabrasClaves
                        WHERE PalabrasClaves.cliente_id = UsuariosClientes.cliente_id
                        AND (NoticiasRadio.titulo LIKE '%' + PalabrasClaves.palabra + '%'
                        OR NoticiasRadio.texto LIKE '%' + PalabrasClaves.palabra + '%')
                    )`);
    });



    const clienteIdPromise = sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        console.log('user_id:', req.session.user.ID);
        request.input('user_id', sql.Int, req.session.user.ID);
        const query = `SELECT cliente_id FROM UsuariosClientes WHERE user_id = @user_id`;
        return request.query(query).then(result => {
            return result.recordset[0].cliente_id;
        });
    });

    const palabrasClavesPromise = clienteIdPromise.then(clienteId => {
        console.log('Cliente ID:', clienteId); // Esto imprimirá el ID del cliente
        return sql.connect(dbConfig).then(function() {
            let request = new sql.Request();
            request.input('cliente_id', sql.Int, clienteId);
            const query = `SELECT * FROM PalabrasClaves WHERE cliente_id = @cliente_id`;
            return request.query(query);
        });
    });

    Promise.all([noticiasPromise, palabrasClavesPromise, totalNoticiasPromise, clienteIdPromise])
        .then(function(values) {
            console.log(values[3].recordset);
            const noticias = values[0].recordset;
            const palabrasClaves = values[1].recordset.map(palabra => palabra.palabra);
            const totalNoticias = values[2].recordset[0].total;
            const clienteId = values[3];
            console.log('Cliente ID:', clienteId);


            if (clienteId) {
                const noticiasFiltradas = noticias;

                // Aquí hacemos un log de los datos que vamos a enviar a la plantilla.
                console.log('noticias:', noticiasFiltradas);
                console.log('palabrasClaves:', palabrasClaves);
                console.log('page:', page);
                console.log('pageSize:', pageSize);
                console.log('totalNoticias:', totalNoticias);
                console.log('keyword:', keyword);
                console.log('user:', req.session.user);

                res.render('index', {noticias: noticiasFiltradas, palabrasClaves: palabrasClaves, page: parseInt(page), pageSize: pageSize, totalNoticias: totalNoticias, keyword: keyword, user: req.session.user, moment: moment});
            } else {
                // No se encontró un cliente para este usuario.
                // Puedes manejar esto de la manera que prefieras, por ejemplo, puedes redirigir al usuario a una página de error.
                res.status(400).send('No se encontró un cliente para este usuario');
            }

        })
        .catch(function(err) {
            console.log(err);
            res.status(500).send(err.message);
        });
});

app.get('/noticia/:id', checkAuthenticated, function(req, res) {
    const noticiaId = req.params.id;

    const noticiaPromise = sql.connect(dbConfig).then(function() {
        return new sql.Request().query(`SELECT * FROM NoticiasRadio WHERE id = ${noticiaId}`);
    });

    const palabrasClavesPromise = sql.connect(dbConfig).then(function() {
        return sql.query`SELECT * FROM PalabrasClaves`;
    });

    // Obtén el objeto user desde donde esté definido en tu aplicación
    // Por ejemplo, si tienes el objeto user en req.user, puedes hacer lo siguiente:
    const user = req.user; // Ajusta esto según tus necesidades

    Promise.all([noticiaPromise, palabrasClavesPromise])
        .then(function(values) {
            const noticia = values[0].recordset[0];
            const palabrasClaves = values[1].recordset.map(palabra => palabra.palabra);
            console.log('Ruta del audio: ' + noticia.audio_path);
            const user = req.user;

            // Incluye el objeto user en la renderización de la vista
            res.render('noticia', {noticia: noticia, palabrasClaves: palabrasClaves, user: user});
        })
        .catch(function(err) {
            console.log(err);
            res.status(500).send(err.message);
        });
});


app.get('/alertas', checkRole(['admin', 'auditor']), (req, res) => {
    let page = req.query.page;
    if (!page) {
        page = 1;
    } else if (page < 1) {
        res.status(400).send('Invalid page number');
        return;
    }

    const pageSize = 10;
    const skip = (page - 1) * pageSize;
    const keyword = req.query.keyword;

    sql.connect(dbConfig).then(function() {
        return new sql.Request().query('SELECT COUNT(*) as count FROM Alertas');
    }).then(result => {
        const totalAlerts = result.recordset[0].count;
        const totalPages = Math.ceil(totalAlerts / pageSize);

        let query = `
            SELECT Alertas.*, Medios.nombre AS medio_nombre
            FROM Alertas
            LEFT JOIN NoticiasRadio ON Alertas.id_noticia = NoticiasRadio.id
            LEFT JOIN Medios ON NoticiasRadio.medio_id = Medios.id
            ${keyword ? `WHERE Alertas.keyword LIKE '%${keyword}%'` : ''}
            ORDER BY Alertas.id DESC OFFSET ${skip} ROWS FETCH NEXT ${pageSize} ROWS ONLY
        `;

        return new sql.Request().query(query).then(function(result) {
            const alertas = result.recordset;
            const keywordSet = new Set();
            const uniqueKeywordAlerts = [];

            alertas.forEach(alerta => {
                const pathPrefix = '//172.23.139.32/CapitalPress/Transcripciones texto/';

                if (alerta.audio_path && alerta.audio_path.startsWith(pathPrefix)) {
                    alerta.audio_path = '/audio' + alerta.audio_path.slice(pathPrefix.length).replace(/\\/g, '/');
                }

                if (!keywordSet.has(alerta.keyword)) {
                    keywordSet.add(alerta.keyword);
                    uniqueKeywordAlerts.push(alerta);
                }
            });

            res.render('alertas', {
                alertas: uniqueKeywordAlerts,
                totalPages: totalPages,
                currentPage: page,
                keyword: keyword, // Añade esta línea
                moment: moment,
                user: req.session.user // Asegúrate de que el usuario esté disponible en req.session.user
            });

        });
    })
    .catch(function(err) {
        console.log(err);
        res.status(500).send(err.message);
    });
});

app.get('/crear-usuario', checkAuthenticated, checkRole(['admin', 'auditor']), function(req, res) {
    res.render('crear-usuario', {user: req.session.user});
});

app.post('/crear-usuario', checkAuthenticated, checkRole(['admin', 'auditor']), async function(req, res) {
    const { username, password, role } = req.body;

    // Convierte 'role' en un entero para usarlo como 'role_id'.
    const role_id = parseInt(role);

    // Comprobamos si el usuario actual es un auditor y está intentando crear un rol distinto de cliente
    if (req.session.user.roleName === 'auditor' && role_id !== 2) { // Asumiendo que el ID del rol de cliente es 2
        res.status(403).send('No tienes permiso para crear un usuario con ese rol');
        return;
    }

    try {
    const pool = await sql.connect(dbConfig);
    const checkUserResult = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT * FROM Users WHERE Username = @username');

    if (checkUserResult.recordset.length > 0) {
        // El usuario ya existe
        res.status(400).send('El nombre de usuario ya está en uso. Por favor, elige otro.');
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.request()
        .input('username', sql.NVarChar, username)
        .input('password', sql.NVarChar, hashedPassword)
        .input('role_id', sql.Int, role_id)
        .query('INSERT INTO Users (Username, PasswordHash, role_id) VALUES (@username, @password, @role_id)');

    res.redirect('/lista-usuarios');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

app.get('/editar-usuario/:id', checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            res.status(400).send('ID de usuario inválido');
            return;
        }

        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT * FROM Users WHERE ID = @id');

        const user = result.recordset[0];
        if (!user) {
            res.status(404).send('Usuario no encontrado');
            return;
        }
        res.render('editar-usuario', { userToEdit: user, user: req.session.user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

app.post('/editar-usuario/:id', checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const role_id = parseInt(role);

        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, hashedPassword)
            .input('role_id', sql.Int, role_id)
            .input('id', sql.Int, userId)
            .query('UPDATE Users SET Username = @username, PasswordHash = @password, role_id = @role_id WHERE ID = @id');

        res.redirect('/lista-usuarios');

    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

app.get('/eliminar-usuario/:id', checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const userId = req.params.id;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, userId)
            .query('DELETE FROM Users WHERE ID = @id');

        res.redirect('/lista-usuarios');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

app.get('/lista-usuarios', checkAuthenticated, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT Users.ID, Users.Username, Roles.name AS roleName
                FROM Users
                INNER JOIN Roles ON Users.role_id = Roles.ID
            `);

        const users = result.recordset;
        res.render('lista-usuarios', { users: users, user: req.session.user }); // Pasar información del usuario autenticado
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

app.get('/clientes', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.query('SELECT TOP (1000) [id], [nombre] FROM [CapitalPress].[dbo].[Clientes] WHERE is_deleted = 0').then(function(recordset) {
            const clientes = recordset.recordset;
            // Renderizar la vista 'clientes' y pasar la lista de clientes y el usuario actual
            res.render('clientes', { clientes: clientes, user: req.session.user });
        }).catch(function(error) {
            console.log(error);
            res.status(500).send(error.message);
        });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});

async function getPalabrasClaves(clienteId) {
    const query = `
        SELECT palabra
        FROM PalabrasClaves
        WHERE cliente_id = @cliente_id
    `;

    let request = new sql.Request();
    request.input('cliente_id', sql.Int, clienteId);

    const result = await request.query(query);
    return result.recordset;
}

app.post('/palabras-claves/:clienteId', checkAuthenticated, async function(req, res) {
    const clienteId = req.params.clienteId;
    const palabra = req.body.palabra;
    const palabra_cercana = req.body.palabra_cercana; // Obtener la palabra cercana

    // Conexión a la base de datos y lógica de inserción
    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('cliente_id', sql.Int, parseInt(clienteId));
        request.input('palabra', sql.NVarChar, palabra);
        request.input('palabra_cercana', sql.NVarChar, palabra_cercana); // Insertar la palabra cercana
        await request.query('INSERT INTO PalabrasClaves (cliente_id, palabra, palabra_cercana) VALUES (@cliente_id, @palabra, @palabra_cercana)');

        res.redirect('/palabras-claves/' + clienteId);
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al agregar la palabra clave');
    }
});

app.get('/palabras-claves/:clienteId', checkAuthenticated, async function(req, res) {
    const clienteId = req.params.clienteId;

    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('cliente_id', sql.Int, parseInt(clienteId));
        const result = await request.query('SELECT [id], [cliente_id], [palabra], [palabra_cercana] FROM [PalabrasClaves] WHERE [cliente_id] = @cliente_id AND [is_deleted] = 0');
        const palabrasClaves = result.recordset;

        // Renderizar la vista y pasar las palabras claves y el ID del cliente
        res.render('palabras_claves', { palabrasClaves: palabrasClaves, clienteId: clienteId, user: req.session.user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al obtener las palabras clave');
    }
});

app.get('/palabras-claves/:clienteId/eliminar/:palabraId', checkAuthenticated, async function(req, res) {
    const clienteId = req.params.clienteId;
    const palabraId = req.params.palabraId;

    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('palabra_id', sql.Int, parseInt(palabraId));
        await request.query('UPDATE [PalabrasClaves] SET [is_deleted] = 1 WHERE [id] = @palabra_id');

        res.redirect('/palabras-claves/' + clienteId);
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al eliminar la palabra clave');
    }
});


//.........................Clientes..............................................

// Ruta para mostrar el formulario de agregar cliente
app.get('/clientes/agregar', checkAuthenticated, function(req, res) {
    res.render('agregar_cliente', { user: req.session.user });
});

// Ruta para manejar la inserción del nuevo cliente
app.post('/clientes/agregar', checkAuthenticated, async function(req, res) {
    const nombre = req.body.nombre;

    // Conexión a la base de datos y lógica de inserción
    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('nombre', sql.NVarChar, nombre);
        await request.query('INSERT INTO Clientes (nombre) VALUES (@nombre)');

        res.redirect('/clientes');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al agregar el cliente');
    }
});

// Ruta para manejar la eliminación lógica del cliente
app.get('/clientes/eliminar/:clienteId', checkAuthenticated, async function(req, res) {
    const clienteId = req.params.clienteId;

    // Conexión a la base de datos y lógica de eliminación lógica
    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('id', sql.Int, parseInt(clienteId));

        // Borrar lógicamente el cliente
        await request.query('UPDATE Clientes SET is_deleted = 1 WHERE id = @id');

        // Borrar lógicamente las palabras claves asociadas al cliente
        await request.query('UPDATE PalabrasClaves SET is_deleted = 1 WHERE cliente_id = @id');

        res.redirect('/clientes');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al eliminar el cliente');
    }
});

app.get('/clientes/configuracion/:clienteId', checkAuthenticated, async function(req, res) {
    const clienteId = req.params.clienteId;
    try {
        // Lógica para recuperar los filtros para este cliente
        const filtros = await obtenerFiltros(clienteId);
        res.render('configuracion_cliente', { clienteId: clienteId, filtros: filtros, user: req.session.user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener la configuración del cliente.');
    }
});

async function obtenerFiltros(clienteId) {
    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('cliente_id', sql.Int, parseInt(clienteId));
        const result = await request.query('SELECT f.id, f.nombre, f.descripcion FROM Filtros AS f JOIN Clientes_Filtros AS cf ON f.id = cf.filtro_id WHERE cf.cliente_id = @cliente_id AND f.is_deleted = 0');
        return result.recordset;
    } catch (error) {
        console.error(error);
        throw new Error('Error al obtener los filtros.');
    }
}

async function obtenerPalabrasClavePorCliente(clienteId) {
    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('cliente_id', sql.Int, parseInt(clienteId));
        const result = await request.query(`
            SELECT id, palabra, palabra_cercana
            FROM PalabrasClaves
            WHERE cliente_id = @cliente_id AND is_deleted = 0
        `);
        return result.recordset;
    } catch (error) {
        console.error(error);
        throw new Error('Error al obtener las palabras clave.');
    }
}

async function obtenerPalabrasClavePorFiltro(filtroId) {
    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('filtro_id', sql.Int, parseInt(filtroId));
        const result = await request.query(`
            SELECT pc.id, pc.palabra, pc.palabra_cercana
            FROM PalabrasClaves AS pc
            WHERE pc.filtro_id = @filtro_id AND pc.is_deleted = 0
        `);
        return result.recordset;
    } catch (error) {
        console.error(error);
        throw new Error('Error al obtener las palabras clave.');
    }
}

//....................................Filtros Clientes............................................................

// Ruta GET para mostrar el formulario de creación de filtro
app.get('/filtros/agregar', checkAuthenticated, function(req, res) {
    res.render('agregar_filtro', { user: req.session.user });
});
// Ruta POST para procesar el formulario de creación de filtro
app.post('/filtros/agregar', checkAuthenticated, async function(req, res) {
    const nombre = req.body.nombre;
    const descripcion = req.body.descripcion;

    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('nombre', sql.NVarChar, nombre);
        request.input('descripcion', sql.NVarChar, descripcion);
        await request.query('INSERT INTO Filtros (nombre, descripcion) VALUES (@nombre, @descripcion)');

        res.redirect('/clientes'); // Redirige a la página adecuada
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al agregar el filtro');
    }
});

// Ruta GET para mostrar el formulario de edición de filtro
app.get('/filtros/editar/:filtroId', checkAuthenticated, async function(req, res) {
    const filtroId = req.params.filtroId;
    // Obtener la información actual del filtro
    // ...

    res.render('editar_filtro', { filtro: filtro, user: req.session.user });
});

// Ruta POST para procesar el formulario de edición de filtro
app.post('/filtros/editar/:filtroId', checkAuthenticated, async function(req, res) {
    const filtroId = req.params.filtroId;
    const nombre = req.body.nombre;
    const descripcion = req.body.descripcion;

    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('id', sql.Int, parseInt(filtroId));
        request.input('nombre', sql.NVarChar, nombre);
        request.input('descripcion', sql.NVarChar, descripcion);
        await request.query('UPDATE Filtros SET nombre = @nombre, descripcion = @descripcion WHERE id = @id');

        res.redirect('/clientes'); // Redirige a la página adecuada
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al editar el filtro');
    }
});

// Ruta GET para eliminar un filtro
app.get('/filtros/eliminar/:filtroId', checkAuthenticated, async function(req, res) {
    const filtroId = req.params.filtroId;

    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('id', sql.Int, parseInt(filtroId));
        await request.query('UPDATE Filtros SET is_deleted = 1 WHERE id = @id');

        res.redirect('/clientes'); // Redirige a la página adecuada
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al eliminar el filtro');
    }
});

app.get('/filtros/configuracion/:filtroId', checkAuthenticated, async function(req, res) {
    const filtroId = req.params.filtroId;
    try {
        // Obtener los datos del filtro
        const filtro = await obtenerFiltro(filtroId);

        // Obtener las palabras clave asociadas con el filtro
        const palabrasClaves = await obtenerPalabrasClavePorFiltro(filtroId);

        // Renderizar la vista
        res.render('configuracion_filtro', { filtro: filtro, palabrasClaves: palabrasClaves, user: req.session.user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener la configuración del filtro.');
    }
});

app.post('/clientes/configuracion/:clienteId/agregar-filtro', checkAuthenticated, async function(req, res) {
    const clienteId = req.params.clienteId;
    const nombreFiltro = req.body.nombre;
    const descripcionFiltro = req.body.descripcion;

    // Conexión a la base de datos y lógica de inserción
    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('nombre', sql.NVarChar, nombreFiltro);
        request.input('descripcion', sql.NVarChar, descripcionFiltro);

        // Inserta el nuevo filtro y obtén el ID del filtro que acabas de insertar
        const result = await request.query('INSERT INTO Filtros (nombre, descripcion) OUTPUT INSERTED.id VALUES (@nombre, @descripcion)');
        const filtroId = result.recordset[0].id;

        // Inserta la relación entre el cliente y el filtro en la tabla ClientesFiltros
        request.input('cliente_id', sql.Int, parseInt(clienteId));
        request.input('filtro_id', sql.Int, filtroId);
        await request.query('INSERT INTO Clientes_Filtros (cliente_id, filtro_id) VALUES (@cliente_id, @filtro_id)'); // Nota: Asegúrate de que el nombre de la tabla sea correcto

        res.redirect('/clientes/configuracion/' + clienteId);
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al agregar el filtro');
    }
});

app.get('/clientes/configuracion/:clienteId/filtro/:filtroId', checkAuthenticated, async function(req, res) {
    const clienteId = req.params.clienteId;
    const filtroId = req.params.filtroId;
    // Lógica para recuperar las palabras clave para este filtro
    const palabrasClaves = await obtenerPalabrasClavePorFiltro(filtroId);
    res.render('agregar_palabras_filtro', { clienteId: clienteId, filtroId: filtroId, palabrasClaves: palabrasClaves, user: req.session.user });
});

app.post('/clientes/configuracion/:clienteId/filtro/:filtroId/agregar-palabra', checkAuthenticated, async function(req, res) {
    const clienteId = req.params.clienteId;
    const filtroId = req.params.filtroId;
    const palabra = req.body.palabra;
    const palabra_cercana = req.body.palabra_cercana;

    // Conexión a la base de datos y lógica de inserción
    try {
        await sql.connect(dbConfig);
        let request = new sql.Request();
        request.input('cliente_id', sql.Int, parseInt(clienteId));
        request.input('filtro_id', sql.Int, parseInt(filtroId));
        request.input('palabra', sql.NVarChar, palabra);
        request.input('palabra_cercana', sql.NVarChar, palabra_cercana);
        await request.query('INSERT INTO PalabrasClaves (cliente_id, filtro_id, palabra, palabra_cercana) VALUES (@cliente_id, @filtro_id, @palabra, @palabra_cercana)');

        res.redirect('/clientes/configuracion/' + clienteId + '/filtro/' + filtroId);
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al agregar la palabra clave');
    }
});

app.get('/clientes/configuracion/:clienteId/filtro/:filtroId/agregar-palabras', async (req, res) => {
    let clienteId = req.params.clienteId;
    let filtroId = req.params.filtroId;
    let user = req.user; // Suponiendo que tienes el usuario en req.user
    try {
        let palabrasClaves = await obtenerPalabrasClavePorCliente(clienteId);
        res.render('agregar_palabras_filtro', {
            clienteId: clienteId,
            filtroId: filtroId,
            palabrasClaves: palabrasClaves,
            user: { Logos: null } // Asegúrate de pasar el usuario a la vista
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Hubo un error al obtener las palabras clave para este filtro.');
    }
});


//..............................Medios Online..................................

app.get('/mediosonline', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.query('SELECT * FROM [CapitalPress].[dbo].[MediosOnline] WHERE is_deleted = 0').then(function(recordset) {
            const mediosOnline = recordset.recordset;
            // Renderizar la vista 'mediosonline' y pasar la lista de medios online, el usuario actual y moment
            res.render('mediosonline', { mediosOnline: mediosOnline, user: req.session.user, moment: moment });
        }).catch(function(error) {
            console.log(error);
            res.status(500).send(error.message);
        });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});

app.post('/mediosonline', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('nombre', sql.NVarChar(255), req.body.nombre)
               .input('link', sql.NVarChar(500), req.body.link)
               .input('fecha_creacion', sql.Date, req.body.fecha_creacion)
               .input('audiencias', sql.NVarChar(255), req.body.audiencias) // Cambiado 'audiencia' a 'audiencias' aquí
               .input('tarifas', sql.NVarChar(255), req.body.tarifas)
               .query('INSERT INTO MediosOnline (nombre, link, fecha_creacion, audiencias, tarifas) VALUES (@nombre, @link, @fecha_creacion, @audiencias, @tarifas)') // Y aquí también
               .then(function() {
                   res.redirect('/mediosonline');
               })
               .catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});

app.get('/mediosonline/:id',checkAuthenticated, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM MediosOnline WHERE id = @id');
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.put('/mediosonline/:id', checkAuthenticated, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombre', sql.NVarChar(255), req.body.nombre)
            .input('link', sql.NVarChar(500), req.body.link)
            .input('fecha_creacion', sql.Date, req.body.fecha_creacion)
            .input('audiencia', sql.NVarChar(255), req.body.audiencias)
            .input('tarifas', sql.NVarChar(255), req.body.tarifas)
            .query('UPDATE MediosOnline SET nombre = @nombre, link = @link, fecha_creacion = @fecha_creacion, audiencia = @audiencia, tarifas = @tarifas WHERE id = @id');
        res.redirect('/mediosonline');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/mediosonline/:id',checkAuthenticated, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('UPDATE MediosOnline SET is_deleted = 1 WHERE id = @id');
        if (result.rowsAffected[0] > 0) {
            res.json({ message: "Medio marcado como eliminado con éxito." });
        } else {
            res.status(404).json({ message: "Medio no encontrado." });
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/mediosonline/edit', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('id', sql.Int, req.body.id)
               .input('nombre', sql.NVarChar(255), req.body.nombre)
               .input('link', sql.NVarChar(500), req.body.link)
               .input('fecha_creacion', sql.Date, req.body.fecha_creacion)
               .input('audiencias', sql.NVarChar(255), req.body.audiencias)
               .input('tarifas', sql.NVarChar(255), req.body.tarifas)
               .query('UPDATE MediosOnline SET nombre = @nombre, link = @link, fecha_creacion = @fecha_creacion, audiencias = @audiencias, tarifas = @tarifas WHERE id = @id')
               .then(function() {
                   res.redirect('/mediosonline');
               })
               .catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});

app.get('/mediosonline/edit/:id', checkAuthenticated, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM MediosOnline WHERE id = @id');

        const medio = result.recordset[0];
        if (medio) {
            res.render('edit_medioonline', { medio: medio, user: req.session.user });
        } else {
            res.status(404).send('Medio no encontrado.');
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/mediosonline/delete/:id', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('id', sql.Int, req.params.id)
               .query('UPDATE MediosOnline SET is_deleted = 1 WHERE id = @id')
               .then(function() {
                   res.redirect('/mediosonline');
               })
               .catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});


//..............................Noticias online......................................

// Obtener todas las noticias
app.get('/noticiasonline', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();

        // Ajuste en la consulta SQL para incluir el JOIN
        const query = `
            SELECT n.*, m.nombre as nombreMedio
            FROM [CapitalPress].[dbo].[NoticiasOnline] n
            JOIN [CapitalPress].[dbo].[MediosOnline] m ON n.medio_id = m.id
        `;

        request.query(query).then(function(recordset) {
            const noticiasOnline = recordset.recordset;
            // Renderizar la vista 'noticiasonline' y pasar la lista de noticias online, el usuario actual y moment
            res.render('noticiasonline', { noticiasOnline: noticiasOnline, user: req.session.user, moment: moment });
        }).catch(function(error) {
            console.log(error);
            res.status(500).send(error.message);
        });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});


// Añadir noticias

app.post('/noticiasonline/add', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('medio_id', sql.Int, req.body.medio_id)
               .input('titulo', sql.NVarChar(255), req.body.titulo)
               .input('texto', sql.NVarChar(4000), req.body.texto)
               .input('link', sql.NVarChar(500), req.body.link)
               .input('Medio', sql.NVarChar(255), req.body.Medio)
               .input('fecha_medio', sql.Date, req.body.fecha_medio)
               .input('cantidad_caracteres', sql.Int, req.body.texto.length)
               .query('INSERT INTO [CapitalPress].[dbo].[NoticiasOnline] (medio_id, titulo, texto, link, Medio, fecha_medio, cantidad_caracteres) VALUES (@medio_id, @titulo, @texto, @link, @Medio, @fecha_medio, @cantidad_caracteres)')
               .then(function() {
                   res.redirect('/noticiasonline');
               }).catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
    console.log(error);
        res.status(500).send(error.message);
    });
});

app.get('/noticiasonline/add', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.query('SELECT * FROM [CapitalPress].[dbo].[MediosOnline] WHERE is_deleted = 0').then(function(recordset) {
            const mediosOnline = recordset.recordset;
            res.render('add_noticia', { mediosOnline: mediosOnline, user: req.session.user });
        }).catch(function(error) {
            console.log(error);
            res.status(500).send(error.message);
        });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});


// Editar noticia
app.post('/noticiasonline/edit/:id', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('id', sql.Int, req.params.id)
               .input('medio_id', sql.Int, req.body.medio_id)
               .input('titulo', sql.NVarChar(255), req.body.titulo)
               .input('texto', sql.NVarChar(4000), req.body.texto)
               .input('link', sql.NVarChar(500), req.body.link)
               .input('Medio', sql.NVarChar(255), req.body.Medio)
               .input('fecha_medio', sql.Date, req.body.fecha_medio)
               .input('cantidad_caracteres', sql.Int, req.body.texto.length)
               .query('UPDATE [CapitalPress].[dbo].[NoticiasOnline] SET medio_id = @medio_id, titulo = @titulo, texto = @texto, link = @link, Medio = @Medio, fecha_medio = @fecha_medio, cantidad_caracteres = @cantidad_caracteres WHERE id = @id')
               .then(function() {
                   res.redirect('/noticiasonline');
               }).catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});


// Eliminar noticia
app.get('/noticiasonline/delete/:id', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('id', sql.Int, req.params.id)
               .query('DELETE FROM [CapitalPress].[dbo].[NoticiasOnline] WHERE id = @id')
               .then(function() {
                   res.redirect('/noticiasonline');
               }).catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});

//--------------------------------------------------Programas Radio--------------------------------------------------
app.get('/programas', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();

        const queryProgramasDetallados = `
            SELECT
                p.id,
                p.nombre,
                p.descripcion,
                m.nombre AS medio_nombre,
                t.valor AS tarifa,
                a.audiencia
            FROM
                [CapitalPress].[dbo].[Programas] p
            JOIN
                [CapitalPress].[dbo].[Medios] m ON p.medio_id = m.id
            LEFT JOIN
                [CapitalPress].[dbo].[Tarifas] t ON p.id = t.programa_id
            LEFT JOIN
                [CapitalPress].[dbo].[Audiencia] a ON p.id = a.programa_id
            WHERE
                p.is_deleted = 0;
        `;

        let programas;

        return request.query(queryProgramasDetallados)
        .then(function(recordset) {
            programas = recordset.recordset || [];
            const queryMedios = 'SELECT * FROM [CapitalPress].[dbo].[Medios]';
            return request.query(queryMedios);
        })
        .then(function(recordsetMedios) {
            const medios = recordsetMedios.recordset;

            // Renderizamos la vista con los datos de programas y medios, sin franjas.
            res.render('programas', {
                programas: programas,
                medios: medios,
                user: req.session.user
            });
        })
        .catch(function(error) {
            console.log(error);
            res.status(500).send(error.message);
        });

    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});

//añadir programas
app.post('/programas/add', checkAuthenticated, function(req, res) {
    let programaId;  // <-- Declara la variable aquí, en un ámbito superior

    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();

        return request.input('nombre', sql.NVarChar(255), req.body.nombre_programa)
               .input('medio_id', sql.Int, req.body.medio_id)
               .input('descripcion', sql.NVarChar(1000), req.body.descripcion)
               .query('INSERT INTO [CapitalPress].[dbo].[Programas] (nombre, medio_id, descripcion) OUTPUT INSERTED.id VALUES (@nombre, @medio_id, @descripcion)');

    }).then(function(result) {
        programaId = result.recordset[0].id;  // <-- Asigna el valor aquí

        let request = new sql.Request();
        return request.input('medio_id', sql.Int, req.body.medio_id)
               .input('programa_id', sql.Int, programaId)
               .input('valor', sql.Float, req.body.tarifa)
               .query('INSERT INTO [CapitalPress].[dbo].[Tarifas] (medio_id, programa_id, valor) VALUES (@medio_id, @programa_id, @valor)');

    }).then(function() {
        let request = new sql.Request();
        return request.input('programa_id', sql.Int, programaId)
               .input('audiencia', sql.Float, req.body.audiencia)
               .query('INSERT INTO [CapitalPress].[dbo].[Audiencia] (programa_id, audiencia) VALUES (@programa_id, @audiencia)');

    }).then(function() {
        res.redirect('/programas');

    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});


app.get('/programas/add', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.query('SELECT * FROM [CapitalPress].[dbo].[Medios] WHERE is_deleted = 0').then(function(recordset) {
            const medios = recordset.recordset;
            res.render('add_programa', { medios: medios, user: req.session.user });
        }).catch(function(error) {
            console.log(error);
            res.status(500).send(error.message);
        });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});
// editar programas
app.post('/programas/edit/:id', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('id', sql.Int, req.params.id)
               .input('nombre', sql.NVarChar(255), req.body.nombre)
               .input('medio_id', sql.Int, req.body.medio_id)
               .input('descripcion', sql.NVarChar(1000), req.body.descripcion)
               .query('UPDATE [CapitalPress].[dbo].[Programas] SET nombre = @nombre, medio_id = @medio_id, descripcion = @descripcion WHERE id = @id')
               .then(function() {
                   res.redirect('/programas');
               }).catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});
// eliminar programas
app.get('/programas/delete/:id', checkAuthenticated, function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('id', sql.Int, req.params.id)
               .query('UPDATE [CapitalPress].[dbo].[Programas] SET is_deleted = 1 WHERE id = @id')
               .then(function() {
                   res.redirect('/programas');
               }).catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});

app.get('/api/medios', function(req, res) {
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.query('SELECT * FROM [CapitalPress].[dbo].[Medios]').then(function(recordset) {
            const medios = recordset.recordset;
            res.json(medios);  // Devuelve los medios en formato JSON
        }).catch(function(error) {
            console.log(error);
            res.status(500).send(error.message);
        });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});

app.get('/api/programas/:medioId', function(req, res) {
    const medioId = req.params.medioId;
    sql.connect(dbConfig).then(function() {
        let request = new sql.Request();
        request.input('medio_id', sql.Int, medioId)
               .query('SELECT * FROM [CapitalPress].[dbo].[Programas] WHERE medio_id = @medio_id AND is_deleted = 0')
               .then(function(recordset) {
                   const programas = recordset.recordset;
                   res.json(programas);  // Devuelve los programas en formato JSON
               }).catch(function(error) {
                   console.log(error);
                   res.status(500).send(error.message);
               });
    }).catch(function(error) {
        console.log(error);
        res.status(500).send(error.message);
    });
});




//---------------------------------------------------Radio Fragmentos------------------------------------------------

app.get('/fragmentosnoticias', checkAuthenticated, async function(req, res) {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM FragmentosNoticias');
        const fragmentos = result.recordset;
        res.render('fragmentosnoticias', { fragmentos: fragmentos, user: req.session.user, moment: moment });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

app.get('/fragmentosnoticias/add', checkAuthenticated, function(req, res) {
    res.render('add_fragmentosnoticias', { user: req.session.user });
});

app.post('/fragmentosnoticias/add', checkAuthenticated, function(req, res) {
    try {
        sql.connect(dbConfig).then(function() {
            let request = new sql.Request();

            // Convertir los minutos y segundos a formato HH:mm:ss
            const inicioHoras = String(req.body.inicioHoras).padStart(2, '0');
            const inicioMinutos = String(req.body.inicioMinutos).padStart(2, '0');
            const finalHoras = String(req.body.finalHoras).padStart(2, '0');
            const finalMinutos = String(req.body.finalMinutos).padStart(2, '0');

            const start_time = `${inicioHoras}:${inicioMinutos}:00`;
            const end_time = `${finalHoras}:${finalMinutos}:00`;

            request.input('franja_id', sql.Int, req.body.programaDropdown)
                   .input('start_time', sql.Time, start_time)
                    .input('end_time', sql.Time, end_time)
                   .input('descripcion', sql.NVarChar(sql.MAX), req.body.fragmentTitle)
                   .input('fecha_medio', sql.Date, new Date().toISOString().slice(0, 10)) // Asumiendo que la fecha del medio es la fecha actual
                   .input('fecha_subida', sql.DateTime, new Date().toISOString())
                   .input('audio_url_frag', sql.NVarChar(500), req.body.audio_url_frag)
                   .query('INSERT INTO [CapitalPress].[dbo].[FragmentosNoticias] (franja_id, start_time, end_time, descripcion, fecha_medio, fecha_subida, audio_url_frag) VALUES (@franja_id, @start_time, @end_time, @descripcion, @fecha_medio, @fecha_subida, @audio_url_frag)')
                   .then(function() {
                       res.redirect('/fragmentosnoticias'); // Redirige a la página deseada después de guardar
                   }).catch(function(error) {
                       console.log(error);
                       res.status(500).send('Error en el servidor');
                   });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});


app.get('/fragmentosnoticias/edit/:id', checkAuthenticated, async function(req, res) {
    try {
        const id = req.params.id;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM FragmentosNoticias WHERE id = @id');
        const fragmento = result.recordset[0];
        if (fragmento) {
            res.render('edit_fragmentosnoticias', { fragmento: fragmento, user: req.session.user });
        } else {
            res.status(404).send('Fragmento no encontrado');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

app.post('/fragmentosnoticias/edit/:id', checkAuthenticated, async function(req, res) {
    try {
        const id = req.params.id;
        const { noticia_id, franja_id, start_time, end_time, selected_text, fecha_medio, fecha_subida } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .input('noticia_id', sql.Int, noticia_id)
            .input('franja_id', sql.Int, franja_id)
            .input('start_time', sql.Time, start_time)
            .input('end_time', sql.Time, end_time)
            .input('selected_text', sql.NVarChar(sql.MAX), selected_text)
            .input('fecha_medio', sql.Date, fecha_medio)
            .input('fecha_subida', sql.DateTime, fecha_subida)
            .query('UPDATE FragmentosNoticias SET noticia_id = @noticia_id, franja_id = @franja_id, start_time = @start_time, end_time = @end_time, selected_text = @selected_text, fecha_medio = @fecha_medio, fecha_subida = @fecha_subida WHERE id = @id');
        res.redirect('/fragmentosnoticias');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

//--------------------------------------------------------Login------------------------------------------------

app.get('/login', function(req, res) {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query(`SELECT Users.*, Roles.name as roleName
                    FROM Users
                    INNER JOIN Roles ON Users.role_id = Roles.id
                    WHERE Username = @username`);



        const user = result.recordset[0];

        if (!user || user.PasswordHash !== password) {
            res.status(401).send('Usuario o contraseña incorrectos');
        } else {
            // El usuario se autenticó correctamente

            const resultCliente = await pool.request()
                .input('user_id', sql.Int, user.ID)
                .query('SELECT cliente_id FROM UsuariosClientes WHERE user_id = @user_id');
            const cliente = resultCliente.recordset[0];
            console.log('Cliente asociado:', cliente);  // Imprime la información del cliente
            if (cliente) {
                // Guardamos la información del usuario y del cliente en la sesión
                req.session.user = {
                    ...user,
                    role_id: user.role_id,
                    roleName: user.roleName
                };
                console.log('Información en sesión:', req.session.user);  // Imprime la información en la sesión
                res.redirect('/');
            } else {
                res.status(401).send('Este usuario no tiene un cliente asociado');
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

function checkAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        console.log('User is not authenticated');  // Y esto
        res.redirect('/login');
    }
}



app.get('/logout', function(req, res){
  req.session.destroy(function(err) {
    if(err) {
      console.log(err);
    } else {
      res.redirect('/login');
    }
  });
});

function checkRole(roles) {
    return (req, res, next) => {
        if (req.session.user && roles.includes(req.session.user.roleName)) {
            next();
        } else {
            res.status(403).send('Acceso denegado');
        }
    };
}

//---------------------------------------------React------------------------------------------------
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query(`SELECT Users.*, Roles.name as roleName
                    FROM Users
                    INNER JOIN Roles ON Users.role_id = Roles.id
                    WHERE Username = @username`);

        const user = result.recordset[0];

        if (!user || user.PasswordHash !== password) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        const resultCliente = await pool.request()
            .input('user_id', sql.Int, user.ID)
            .query('SELECT cliente_id FROM UsuariosClientes WHERE user_id = @user_id');

        const cliente = resultCliente.recordset[0];

        if (cliente) {
            req.session.user = {
                ...user,
                role_id: user.role_id,
                roleName: user.roleName
            };
            return res.status(200).json({ success: true, message: 'Inicio de sesión exitoso', user: req.session.user });
        } else {
            return res.status(401).json({ success: false, message: 'Este usuario no tiene un cliente asociado' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

app.get('/api/current_user', checkAuthenticated, (req, res) => {
    console.log("Accessing /api/current_user");
    console.log("User data:", req.session.user);
    res.json(req.session.user);
});


//app.get('*', (req, res) => {
//    res.sendFile(path.join(__dirname, 'index.html'));
//});


//---------------------------------------------------Cortar Audio---------------------------------------------------
function timeToSeconds(minutes, seconds) {
    return parseInt(minutes) * 60 + parseInt(seconds);
}

app.post('/cut-audio', function(req, res) {
    const data = req.body;
    console.log("Received data:", data);

    // Verificar si data.audioUrl es una URL completa (contiene 'http://', 'https://', etc.)
    if (data.audioUrl.startsWith('http://') || data.audioUrl.startsWith('https://')) {
        const url = new URL(data.audioUrl);
        data.audioUrl = url.pathname; // Esto nos dará la parte de la ruta del URL, sin el dominio o protocolo
    }

    if (data.audioUrl.includes("/radio/")) {
        data.audioUrl = data.audioUrl.replace("/radio", "");
    } else if (data.audioUrl.includes("/audio/")) {
        data.audioUrl = data.audioUrl.replace("/audio", "");
    }

    const filePath = path.join('G:/CapitalPress/GrabacionesRadio', data.audioUrl);
    console.log("Full path to input file:", filePath);

    // Extract the directory and emisora name from the file path
    const directory = path.dirname(filePath);
    const emisoraName = directory.split(path.sep).slice(-3, -2)[0]; // Tomamos el nombre de la emisora de la ruta

    // Definimos la carpeta central de Fragmentos y luego la subcarpeta de la emisora
    const centralFragmentDirectory = 'G:\\CapitalPress\\Fragmentos';
    const emisoraFragmentDirectory = path.join(centralFragmentDirectory, emisoraName);

    // Si la subcarpeta de la emisora no existe, la creamos
    if (!fs.existsSync(emisoraFragmentDirectory)) {
        fs.mkdirSync(emisoraFragmentDirectory, { recursive: true });
        console.log("Emisora directory created successfully:", emisoraFragmentDirectory);
    }

    const uniqueFileName = `${moment().format('HHmmssSSS')}.mp3`;
    const outputFile = path.join(emisoraFragmentDirectory, uniqueFileName);
    console.log("File Output:", outputFile);

    const start = timeToSeconds(data.startMinute, data.startSecond);
    const end = timeToSeconds(data.endMinute, data.endSecond);
    console.log("Start after conversion:", start);
    console.log("End after conversion:", end);

    ffmpeg(filePath)
    .setStartTime(start)
    .setDuration(end - start)
    .output(outputFile)
    .on('end', function(err) {
        if (!err) {
            console.log('conversion has been done successfully');
            res.json({ fragmentPath: "/fragmentos/" + emisoraName + "/" + uniqueFileName });
        }
    })
    .on('error', function(err) {
        console.log('an error happened: ' + err.message);
        res.status(500).send('Error during audio processing');
    })
    .run();
});



//--------------------------------------------------------Reproductor video

async function listContent(baseDirectory, directory) {
    const fullPathDirectory = path.resolve(baseDirectory, directory);
    console.log('Full path:', fullPathDirectory);
    let files = await fsPromises.readdir(fullPathDirectory);
    console.log('Files:', files);
    let contentList = [];

    for (let file of files) {
        let fullPath = path.join(fullPathDirectory, file);
        let stat = await fsPromises.stat(fullPath);

        if (stat.isDirectory()) {
            contentList.push({ type: 'directory', name: file, path: fullPath.replace(baseDirectory, '/') });
        } else if (path.extname(file) === '.mp4' || path.extname(file) === '.mp3') {
            const relativePath = path.relative(baseDirectory, fullPath);
            console.log("Generated relative path:", relativePath);
            contentList.push({ type: 'file', name: file, path: relativePath });

        }
    }

    return contentList;
}

app.get('/list-years', async (req, res) => {
    console.log('Received request for list-years endpoint');
    try {
        let years = await listContent('E:/GrabacionesTv', '');
        console.log('Years (before filter and map):', years);
        years = years.filter(item => item.type === 'directory').map(item => item.name);
        console.log('Years (after filter and map):', years);
        res.json(years);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send('Error listing years');
    }
});

app.get('/list-months', async (req, res) => {
    console.log('Received request for list-months endpoint');
    const year = req.query.year;
    if (!year) {
        return res.status(400).send('Year is required');
    }

    try {
        console.log('Year value:', year);
        let months = await listContent('E:/GrabacionesTv', year);
        console.log('Months (before filter and map):', months);
        months = months.filter(item => item.type === 'directory').map(item => item.name);
        console.log('Months (after filter and map):', months);
        res.json(months);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send('Error listing months');
    }
});


app.get('/list-days', async (req, res) => {
    console.log('Received request for list-days endpoint');
    const year = req.query.year;
    const month = req.query.month;
    const channel = req.query.channel;

    if (!year || !month || !channel) {
        return res.status(400).send('Year, Month, and Channel are required');
    }

    try {
        let days = await listContent('E:/GrabacionesTv', `${year}/${month}/${channel}`);
        days = days.filter(item => item.type === 'directory').map(item => item.name);
        res.json(days);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send('Error listing days');
    }
});


app.get('/list-channels', async (req, res) => {
    console.log('Received request for list-channels endpoint');
    const year = req.query.year;
    const month = req.query.month;

    console.log("Received year:", year);  // Agregar esta línea
    console.log("Received month:", month);  // Agregar esta línea

    if (!year || !month) {
        return res.status(400).send('Year and Month are required');
    }

    try {
        let channels = await listContent(`E:/GrabacionesTv`, `${year}/${month}`);
        channels = channels.filter(item => item.type === 'directory').map(item => item.name);
        res.json(channels);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send('Error listing channels');
    }
});

app.get('/view-videos', checkAuthenticated, (req, res) => {
    res.render('view-videos');  // Renderiza la vista view-videos.ejs
});

app.get('/videos/*', function(req, res) {


    const videoPath = path.join('E:/GrabacionesTv', req.params[0]);
    console.log("Trying to serve video from:", videoPath);

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4'
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4'
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

app.get('/list-videos', async (req, res) => {
    const directory = req.query.path || '';

    console.log("Accessing directory:", directory);

    try {
        let content = await listContent('E:/GrabacionesTv', directory);
        console.log("Content:", content);
        res.json(content);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send('Error listing content');
    }
});


//----------------------------------Cortador video

function timeToSeconds(minutes, seconds) {
    return (parseInt(minutes) * 60) + parseInt(seconds);
}


app.post('/cut-video', function(req, res) {
    const data = req.body;
    console.log("Received data:", data);

    // Extrae la ruta del video de la URL, descartando la parte "http://localhost:3000/videos"
    const videoPathFromUrl = new URL(data.videoUrl).pathname.replace('/videos', '');

    // Combina la ruta extraída con la ruta base donde se almacenan tus videos
    const filePath = path.join('//172.23.139.32/GrabacionesTv', videoPathFromUrl);
    console.log("Full path to input video:", filePath);

    const directory = path.dirname(filePath);
    const fragmentDirectory = path.join(directory, 'Fragmentos');
    console.log("Trying to create directory at:", fragmentDirectory);

    if (!fs.existsSync(fragmentDirectory)) {
        fs.mkdirSync(fragmentDirectory, { recursive: true });
        console.log("Directory created successfully");
    }

    const uniqueFileName = `${moment().format('HHmmssSSS')}.mp4`;
    const outputFile = path.join(fragmentDirectory, uniqueFileName);
    console.log("Output video file:", outputFile);

    const start = timeToSeconds(data.startMinute, data.startSecond);
    const end = timeToSeconds(data.endMinute, data.endSecond);
    console.log("Start after conversion:", start);
    console.log("End after conversion:", end);

    ffmpeg(filePath)
        .setStartTime(start)
        .setDuration(end - start)
        .output(outputFile)
        .on('end', function(err) {
            if (!err) {
                console.log('Video conversion has been done successfully');
                res.json({ fragmentPath: outputFile.replace("//172.23.139.32/GrabacionesTv", "") });
            }
        })
        .on('error', function(err) {
            console.log('An error happened: ' + err.message);
            res.status(500).send('Error during video processing');
        })
        .run();
});

app.get('/view-videos', checkAuthenticated, async (req, res) => {
    try {
        // ... cualquier lógica necesaria ...

        res.render('view-videos', { user: req.session.user }); // Pasar información del usuario autenticado
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});

app.get('/radio/*', (req, res) => {
    const audioPath = path.join('/mnt/CapitalPress/GrabacionesRadio', req.params[0]);
    console.log("Trying to serve audio from:", audioPath);
    
    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(audioPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg'  // Asumiendo que tus archivos son MP3
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg'  // Asumiendo que tus archivos son MP3
        };
        res.writeHead(200, head);
        fs.createReadStream(audioPath).pipe(res);
    }
});

//------------------------------------- audio

app.get('/list-audio', async (req, res) => {
    const directory = req.query.path || '';
    const fullPath = path.join('/mnt/CapitalPress/GrabacionesRadio', directory);

    console.log("Accessing directory query param:", directory);
    console.log("Full path to access:", fullPath);

    try {
        let content = await listContent(fullPath);
        console.log("Content listed:", content);
        res.json(content);
    } catch (error) {
        console.error("Error listing content for path", fullPath, ":", error);
        res.status(500).send('Error listing content');
    }
});


    try {
        let content = await listContent('/mnt/CapitalPress/GrabacionesRadio', directory);
        console.log("Content:", content);
        res.json(content);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send('Error listing content');
    }
});

app.get('/view-radio', checkAuthenticated, async (req, res) => {
    try {
        // ... cualquier lógica necesaria ...

        res.render('view-radio', { user: req.session.user }); // Pasar información del usuario autenticado
    } catch (err) {
        console.error(err);
        res.status(500).send('Error en el servidor');
    }
});





//-------------------------------------out

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
app.listen(3000, function() {
    console.log('App listening on port 3000!');
});

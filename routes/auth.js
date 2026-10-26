const express = require('express');

//const app = express();
const bcrypt = require('bcryptjs');

const router = express.Router();
//router.use(express.json()); // Parsear JSON en las solicitudes


//router.use(cors(corsOptions)); // Permitir solicitudes desde el frontend en desarrollo

// Iniciar sesión
router.post('/login', async (req, res) => {
    const { usuario, password } = req.body;

    if (
        typeof usuario !== 'string' ||
        typeof password !== 'string' ||
        !usuario.trim() ||
        !password
        
    ) {
        
        return res.status(400).json({
            message: 'Debes ingresar usuario y contraseña',
            
        });
    }

    try {
        const resultado = await req.app.locals.pool.query(
            `SELECT
                id_usuario,
                nombre,
                usuario,
                password_hash,
                rol,
                activo
             FROM instrumentos.usuarios
             WHERE usuario = $1`,
            [usuario.trim()]
        );

        const cuenta = resultado.rows[0];

        // Usar el mismo mensaje evita revelar si una cuenta existe.
        if (
            !cuenta ||
            !cuenta.activo ||
            !(await bcrypt.compare(password, cuenta.password_hash))
        ) {
            return res.status(401).json({
                message: 'Usuario o contraseña incorrectos'
            });
        }

        // Crear una nueva sesión después de validar las credenciales.
        req.session.regenerate((error) => {
            if (error) {
                console.error('Error al crear sesión:', error);

                return res.status(500).json({
                    message: 'No fue posible iniciar sesión'
                });
            }

            req.session.usuario = {
                id_usuario: cuenta.id_usuario,
                nombre: cuenta.nombre,
                usuario: cuenta.usuario,
                rol: cuenta.rol
            };

            req.session.save((error) => {
                if (error) {
                    console.error('Error al guardar sesión:', error);

                    return res.status(500).json({
                        message: 'No fue posible guardar la sesión'
                    });
                }

                return res.json({
                    message: 'Sesión iniciada correctamente',
                    usuario: req.session.usuario
                });
            });
        });

    } catch (error) {
        console.error('Error en login:', error);

        return res.status(500).json({
            message: 'Error interno al iniciar sesión'
        });
    }
});


// Consultar el usuario autenticado
router.get('/me', (req, res) => {
    if (!req.session?.usuario) {
        return res.status(401).json({
            message: 'No hay una sesión activa'
        });
    }

    return res.json({
        usuario: req.session.usuario
    });
});


// Cerrar sesión
router.post('/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error('Error al cerrar sesión:', error);

            return res.status(500).json({
                message: 'No fue posible cerrar la sesión'
            });
        }

        res.clearCookie('instrumentos.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        return res.json({
            message: 'Sesión cerrada correctamente'
        });
    });
});


module.exports = router;

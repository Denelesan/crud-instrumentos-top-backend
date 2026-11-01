// Importar Express
const express = require('express');
const cors = require('cors');
const { Pool, Query } = require('pg');
const { ApartmentOutlined } = require('@ant-design/icons');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000; // Puerto en el que el servidor escuchará
const multer = require("multer");
//const archiver = await import("archiver");
const path = require('path');
const fs = require('fs');

//Configurar las sesiones
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');


// Configurar conexión de Postgre
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
app.locals.pool = pool;

app.use(express.json()); // Parsear JSON en las solicitudes

// Configura las opciones de CORS
const corsOptions = {
    origin: 'http://localhost:3000',     // Permite únicamente este origen
    credentials: true,       // Permite el intercambio de cookies/cabeceras de autorización
    optionsSuccessStatus: 200 // Responde con 200 OK a las peticiones preflight (OPTIONS)
  };

app.use(cors(corsOptions)); // Permitir solicitudes desde el frontend en desarrollo


//Con esta configuración:
//- La sesión se almacena en PostgreSQL.
//- La cookie dura ocho horas como máximo.
//- JavaScript del navegador no puede leer directamente la cookie, gracias a httpOnly.
//- En producción, secure requiere HTTPS.
//- createTableIfMissing permite que el paquete cree la tabla de sesiones si no existe.
//La tabla user_sessions es independiente de instrumentos.usuarios: una almacena las sesiones activas y la otra las cuentas de usuario.
app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),

    name: 'instrumentos.sid',

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,
    rolling: true,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000 // 1 hora
    }
}));

const authRoutes = require('./routes/auth');

app.use('/api/auth', authRoutes);

//Funcion que:
//Comprueba si existe una sesión.
//Comprueba si la sesión contiene un usuario autenticado.
//Si no existe, devuelve 401 Unauthorized.
//Si existe, ejecuta next() y permite continuar con la ruta.
function requireAuth(req, res, next) {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        message: 'Debes iniciar sesión para acceder a este recurso',
      });
    }
  
    next();
  }

//Funcion que revisa que middleware de sesión ya validó la cookie y cargó el usuario. Al iniciar sesión, se guarda en req.session.usuario el identificador y el rol de la cuenta validada, comprobando también que esté activa.
function requireRole(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.session?.usuario) {
            return res.status(401).json({
                message: "Debes iniciar sesión"
            });
        }

        if (!rolesPermitidos.includes(req.session.usuario.rol)) {
            return res.status(403).json({
                message: "No tienes permisos para realizar esta acción"
            });
        }

        next();
    };
}

const storage = multer.diskStorage({

    destination:(req,file,cb)=>{

        const id = req.params.id_verificacion;

        const folder =
        `uploads/verificaciones/${id}`;


        if(!fs.existsSync(folder)){
            fs.mkdirSync(folder,{
                recursive:true
            });
        }

        cb(null, folder);
    },


    filename:(req,file,cb)=>{
        const nombre = path.parse(file.originalname).name;
        const extension = path.extname(file.originalname);
        const ahora = new Date();
        const fecha =
        `${ahora.getFullYear()}-${
        String(ahora.getMonth()+1).padStart(2,"0")}-${
        String(ahora.getDate()).padStart(2,"0")}_${
        String(ahora.getHours()).padStart(2,"0")}-${
        String(ahora.getMinutes()).padStart(2,"0")}-${
        String(ahora.getSeconds()).padStart(2,"0")}`;
        const uniqueName =
        `${nombre}_${fecha}${extension}`;
        //path.extname(file.originalname) + Date.now();
        //file.originalname +"_"+ Date.now();
        cb(null, uniqueName);

    }

});


const upload = multer({
    storage
});

const storageCalibraciones = multer.diskStorage({



    destination: (req, file, cb) => {

        const num_certificado = req.params.n_certificado
        //cb(null, `uploads/calibraciones/${num_certificado}`);

        const folderCalibr =
        `uploads/calibraciones/${num_certificado}`;


        if(!fs.existsSync(folderCalibr)){
            fs.mkdirSync(folderCalibr,{
                recursive:true
            });
        }

        cb(null, folderCalibr);
    },

    filename: (req, file, cb) => {

        const nombre = path.parse(file.originalname).name;
        const extension = path.extname(file.originalname);
        const ahora = new Date();
        const fecha =
        `${ahora.getFullYear()}-${
        String(ahora.getMonth()+1).padStart(2,"0")}-${
        String(ahora.getDate()).padStart(2,"0")}_${
        String(ahora.getHours()).padStart(2,"0")}-${
        String(ahora.getMinutes()).padStart(2,"0")}-${
        String(ahora.getSeconds()).padStart(2,"0")}`;
        const uniqueName =
        `${nombre}_${fecha}${extension}`;
        //path.extname(file.originalname) + Date.now();
        //file.originalname +"_"+ Date.now();
        cb(null, uniqueName);
    }

});

const uploadCalibracion = multer({
    storage: storageCalibraciones
});

// Petición de tipo de instrumentos
app.get('/api/instrumentos/tipo', async (req, res)=>{
    try {
        const result = await pool.query('SELECT id_tipo, tipo FROM instrumentos.tipo');
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener los tipos de instrumentos", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})
// Petición para eliminar un instrumento
app.delete('/api/instrumentos/delete/:id_instrumento',requireRole('admin'),
async (req, res) => {
  const { id_instrumento } = req.params;

  try {
    // 1. Verificar que el instrumento exista
    const instrumento = await pool.query(
      `SELECT id_instrumento
       FROM instrumentos.instrumentos
       WHERE id_instrumento = $1`,
      [id_instrumento]
    );

    if (instrumento.rowCount === 0) {
      return res.status(404).json({
        message: 'El instrumento no existe.'
      });
    }

    // 2. Comprobar las relaciones existentes
    const relaciones = await pool.query(
      `SELECT
        EXISTS (
          SELECT 1
          FROM instrumentos.instrumento_calibr
          WHERE id_instrumento = $1
        ) AS tiene_calibraciones,

        EXISTS (
          SELECT 1
          FROM instrumentos.instrumento_verif
          WHERE id_instrumento = $1
        ) AS tiene_verificaciones`,
      [id_instrumento]
    );

    const {
      tiene_calibraciones,
      tiene_verificaciones
    } = relaciones.rows[0];

    // 3. No permitir eliminar si hay hitos asociados
    if (tiene_calibraciones || tiene_verificaciones) {
      const motivos = [];

      if (tiene_calibraciones) {
        motivos.push('hitos de calibración');
      }

      if (tiene_verificaciones) {
        motivos.push('hitos de verificación');
      }

      return res.status(409).json({
        message:
          `No es posible eliminar el instrumento porque tiene asociados: ${motivos.join(' e ')}. ` +
          'Puedes darlo de baja para conservar su historial técnico.',
        tiene_calibraciones,
        tiene_verificaciones
      });
    }

    // 4. Intentar eliminar el instrumento
    const resultado = await pool.query(
      `DELETE FROM instrumentos.instrumentos
       WHERE id_instrumento = $1
       RETURNING *`,
      [id_instrumento]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        message: 'El instrumento no fue encontrado.'
      });
    }

    return res.status(200).json({
      message: 'Instrumento eliminado correctamente.',
      instrumento: resultado.rows[0]
    });

  } catch (error) {
    console.error(
      'Error al eliminar instrumento:',
      error
    );

    // 5. Protección adicional para otras tablas relacionadas
    if (error.code === '23503') {
      return res.status(409).json({
        message:
          'No es posible eliminar el instrumento porque existen otros registros asociados.'
      });
    }

    return res.status(500).json({
      message: 'Error interno al eliminar el instrumento.'
    });
  }
}
);


// Petición de marcas de instrumentos
app.get('/api/instrumentos/marca',async (req, res)=>{
    try {
        const result = await pool.query('SELECT id_marca, marca FROM instrumentos.marca');
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener la marca de instrumentos", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Petición de modelo de instrumentos según su marca
app.get('/api/instrumentos/modelo',async (req, res)=>{
    const {id_marca} = req.query
    try {
        let result = await pool.query('SELECT id_modelo, modelo FROM instrumentos.modelo WHERE id_marca=$1', [id_marca]);
        
        if (result.rowCount === 0) {
            result = await pool.query('SELECT id_modelo, modelo FROM instrumentos.modelo WHERE id_modelo=13');
            
        }
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener los modelos de instrumentos", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Petición de modelo de instrumentos
app.get('/api/instrumentos/modelos', async (req, res)=>{
    //const {id_marca} = req.query
    try {
        const result = await pool.query('SELECT id_modelo, modelo FROM instrumentos.modelo');
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener los modelos de instrumentos", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Estamos realizando una petición para una vista general
app.get('/api/instrumentos',requireAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM instrumentos."Tabla de Instrumentos"');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener los datos' });
    }
  });

// Estamos realizando una petición para un sólo detalle
app.get('/api/instrumentos/:id', async (req, res) => {
    const {id}= req.params
    try {
      const result = await pool.query('SELECT * FROM instrumentos."Tabla de Instrumentos" WHERE id=$1',[id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Instrumento no encontrado' });
    }
      res.json(result.rows[0]);;
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener los datos' });
    }
  });

// Ruta para actualizar un instrumento
app.put('/api/instrumentos/:id_instrumento', async (req, res)=>{
    const {id_instrumento} = req.params;
    const {ubicacion} = req.body

    try {
        const updateInstrumentos = await pool.query(
            'UPDATE instrumentos.instrumentos SET ubicacion= $2 WHERE id_instrumento= $1 RETURNING *',
            [id_instrumento,ubicacion]
        );
        if (updateInstrumentos.rows.length === 0) {
            return res.status(404).json({ message: "Item no encontrado"});
        }
        res.json(updateInstrumentos.rows[0])
    }
    catch (err) {
        console.error(err.message);
        res.status(500).send("Error en la actualización")
    }
})

// Ruta para crear un instrumento topográfico nuevo
app.post('/api/instrumentos', async (req, res) => {
    try {
        const {id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado} = req.body //datos que recibimos desde el fronted
        const newInstrument = await pool.query(
            'INSERT INTO instrumentos.instrumentos(id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
            [id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado]
        )
        /*await pool.query(
            'INSERT INTO instrumentos.instrumentos(id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURING *',
            [id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado]
        )*/
        res.json(newInstrument.rows[0])
    } catch (error) {
        console.error(error)
    }

})

// Ruta para crear un hito de calibración nuevo
app.post('/api/calibration', async (req, res) => {
    try {
        const {id_empresa, fecha_solicitud, orden_compra, precio_oc} = req.body //datos que recibimos desde el fronted
        const newCalibration = await pool.query(
            'INSERT INTO instrumentos.solic_calibracion(id_empresa, fecha_solicitud, orden_compra, precio_oc) VALUES ($1, $2, $3, $4) RETURNING *',
            [id_empresa, fecha_solicitud, orden_compra, precio_oc]
        )
        console.log(newCalibration)
        /*await pool.query(
            'INSERT INTO instrumentos.instrumentos(id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURING *',
            [id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado]
        )*/
        res.json(newCalibration.rows[0])
    } catch (error) {
        console.error(error)
    }

})

// Ruta para realizar una petición de los hitos de calibración
app.get('/api/calibration', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.hitos_calibracion');
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener los hitos  de calibración", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Ruta para realizar una petición de los hitos de calibración filtrado por su Id Hito
app.get('/api/calibration/:id_hito', async (req, res)=>{
    const {id_hito} = req.params
    try {
        const result = await pool.query('SELECT * FROM instrumentos.hitos_calibracion WHERE "Id Hito"=$1',[id_hito]);
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener los hitos  de calibración", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Ruta para realizar una petición de las empresas que calibran
app.get('/api/calibration_empresas', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.empresa');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener las empresas calibradoras", err)
        res.status(500).json({error: "Error al obtener los datos de empresas"})
    }
})

// Ruta para realizar una petición de los instrumentos en los que aplica calibración y NO son parte del hito de calibración consultado
app.get('/api/calibration/aplica_instrumentos/:id_calibration', async (req, res) => {
    const {id_calibration} = req.params
    try {
      const result = await pool.query('SELECT id, instrumento, serie, tipo, materialidad, seccion, marca, modelo, estado, cargo, aplica_verif, aplica_calib, ubicacion, obs_estado FROM (SELECT * FROM instrumentos."Tabla de Instrumentos" WHERE aplica_calib = TRUE) AS a LEFT JOIN (SELECT * FROM instrumentos.instrumento_calibr WHERE id_solic_calibr = $1) AS b ON a.id = b.id_instrumento WHERE id_solic_calibr IS NULL GROUP BY (id, instrumento, serie, tipo, materialidad, seccion, marca, modelo, estado, cargo, aplica_verif, aplica_calib, ubicacion, obs_estado) ORDER BY id',[id_calibration]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener los datos'});
    }
  });

// Ruta para agregar instrumentos a un hito de calibración
app.post('/api/calibration/addInstrument', async (req, res) => {
    try {
        const {id_calibration, id} = req.body //datos que recibimos desde el fronted
        const newInstrumentCalibration = await pool.query(
            'INSERT INTO instrumentos.instrumento_calibr(id_solic_calibr, id_instrumento) VALUES ($1, $2) RETURNING *',
            [id_calibration, id]
        )
        console.log(newInstrumentCalibration)
        /*await pool.query(
            'INSERT INTO instrumentos.instrumentos(id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURING *',
            [id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado]
        )*/
        res.json(newInstrumentCalibration.rows[0])
    } catch (error) {
        console.error(error)
    }

})

// Petición para eliminar un hito de calibración y todos sus instrumentos asociados. Dado que tenemos 2 consultas, debemos realizarlo utilizando transanccioness.
app.delete('/api/calibration/delete/:id_calibration', async (req, res)=>{
    const {id_calibration} = req.params
    console.log("ID Hito recibido para eliminación:", id_calibration);

    const client = await pool.connect() //Conectamos manualmente para poder manejar la transacción a realizar.

    try {
        await client.query("BEGIN") //Iniciamos la transancción

        //Eliminamos los instrumentos asociados al hito de calibración
        await client.query('DELETE FROM instrumentos.instrumento_calibr WHERE id_solic_calibr = $1',
        [id_calibration])

        //Eliminamos los log asociados al hito de calibración
        await client.query('DELETE FROM instrumentos.log_calibration WHERE id_solic_calibr = $1',
            [id_calibration])
        
        //Posterior a lo anterior, eliminamos el hito de calibración
        const result = await client.query('DELETE FROM instrumentos.solic_calibracion WHERE id_solic_calibr = $1 RETURNING *',[id_calibration])
        
       if(result.rowCount === 0){
            await client.query("ROLLBACK") //Revertimos si no encuentra el hito de calibración
            return res.status(404).json({error:"Hito de Calibración no encontrado"})
        }

        await client.query("COMMIT") //Confirmamos la transacción

        console.log("Resultado de la eliminación:", result.rows[0]);
        res.json(result.rows[0])

    } catch (error) {
        await client.query("ROLLBACK") //Deshacer cambios si hay un error
        console.error("Error al eliminar el Hito de Calibración", error)
        res.status(500).json({error: `Error al eliminar el Hito de Calibración Nº ${id_calibration}`})
    } finally {
        client.release()
    }


})

// Ruta para realizar una petición de los instrumentos asociados a un hito de calibración
app.get('/api/calibration/instrumentos/:id_calibration', async (req, res) => {
    const {id_calibration} = req.params
    try {
      const result = await pool.query('SELECT id, instrumento, serie, tipo, materialidad, seccion, marca, modelo, estado, cargo, aplica_verif, aplica_calib, ubicacion, obs_estado,id_solic_calibr FROM instrumentos."Tabla de Instrumentos" AS a RIGHT JOIN (SELECT * FROM instrumentos.instrumento_calibr WHERE id_solic_calibr = $1) AS b ON a.id = b.id_instrumento GROUP BY (id, instrumento, serie, tipo, materialidad, seccion, marca, modelo, estado, cargo, aplica_verif, aplica_calib, ubicacion, obs_estado,id_solic_calibr) ORDER BY id',[id_calibration]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener los datos'});
    }
  });

// Petición para eliminar instrumentos asociados de un hito de calibración
app.delete('/api/calibration/instrumentasociate/delete/:id_calibration', async (req, res)=>{
    console.log("🚀 ¡Solicitud DELETE recibida!");
    console.log("Parámetro id_calibration:", req.params.id_calibration);
    console.log("Cuerpo de la petición:", req.body);  // <-- Ver si llegan los datos correctamente

    const {id_calibration} = req.params
    const {instrumentosAEliminar} = req.body
    

    if (!instrumentosAEliminar || instrumentosAEliminar.length===0){
        return res.status(400).json({message:`No hay instrumentos para eliminar ${instrumentosAEliminar}`})
    }

    try{
        const query = `DELETE FROM instrumentos.instrumento_calibr WHERE id_instrumento=ANY($1) AND id_solic_calibr=$2`
        const values = [instrumentosAEliminar, id_calibration]

        console.log("Query generada:", query);
        console.log("Valores enviados:", values);

        await pool.query(query, values)

        res.json({message: "Instrumentos eliminados correctamente"})
    }
     catch (error) {
        console.error("Error al eliminar los instrumentos:", error.message);
        res.status(500).json({ message: `Error en el servidor: ${error.message}` });
    } 

})

// Ruta para actualizar la información de un hito de calibración
app.put('/api/calibration/:id_calibration', async (req, res)=>{
    const {id_calibration} = req.params;
    const {id_empresa, fecha_solicitud, orden_de_compra, precio_oc} = req.body
    console.log("ID URL:", id_calibration);
    console.log("Body:", req.body);
    try {
        const updateHitoCalibration = await pool.query(
            'UPDATE instrumentos.solic_calibracion SET id_empresa= $2,orden_compra=$3, fecha_solicitud=$4, precio_oc=$5 WHERE id_solic_calibr= $1 RETURNING *',
            [id_calibration,id_empresa, orden_de_compra, fecha_solicitud, precio_oc]
        );
        if (updateHitoCalibration.rows.length === 0) {
            return res.status(404).json({ message: "Item no encontrado"});
        }
        res.json(updateHitoCalibration.rows[0])
    }
    catch (err) {
        console.error(err.message);
        console.error("Error detallado:", err);
        res.status(500).send("Error en la actualización")
    }
})

// Ruta para realizar una petición de las etapas de un hito de calibración
app.get('/api/calibration_etapas', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.etapas_calibr');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener las etapas de un hito de calibración", err)
        res.status(500).json({error: "Error al obtener los datos de las etapas"})
    }
})

// Ruta para realizar una petición de los medios de comunicación para un hito de calibración
app.get('/api/calibration_medio', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.medio_calibr');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener los medios para un hito de calibración", err)
        res.status(500).json({error: "Error al obtener los datos de los medios"})
    }
})

// Ruta para agregar un avance a un hito de calibración (log)
app.post('/api/calibration/agregar_log', async (req, res) => {
    try {
        const {id_calibration, id_etapa, fecha_log, detalle_log, id_medio} = req.body //datos que recibimos desde el fronted
        const newLog = await pool.query(
            'INSERT INTO instrumentos.log_calibration(id_solic_calibr, id_etapa_calibr,fecha_log,descrip_log,id_medio) VALUES ($1, $2,$3,$4,$5) RETURNING *',
            [id_calibration, id_etapa, fecha_log, detalle_log, id_medio]
        )
        console.log(newLog)
        res.json(newLog.rows[0])
    } catch (error) {
        console.error(error)
    }

})

// Ruta para realizar una petición del log de calibración para un hito de calibración en específico
app.get('/api/calibration/log/:id_calibration', async (req, res)=>{
    const {id_calibration} = req.params
    try {
        const result = await pool.query('SELECT * FROM instrumentos.log_etapas_calibration WHERE id_solic_calibr = $1', [id_calibration]);
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener el log de un hito de calibración", err)
        res.status(500).json({error: "Error al obtener el log de un hito de calibración"})
    }
})

// Ruta para realizar una petición del personal disponible para cargo de instrumentos
app.get('/api/personalcargo', async(req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.personal_cargo');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener el personal disponible para cargo", err)
        res.status(500).json({error: "Error al obtener el personal disponible para cargo"})
    }
})

// Ruta para realizar una petición de las Secciones disponibles para cargo de instrumentos
app.get('/api/seccioncargo', async(req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.seccion');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener las secciones disponibles para cargo", err)
        res.status(500).json({error: "Error al obtener las secciones disponibles para cargo"})
    }
})

// Ruta para realizar una petición de las materialidades disponibles
app.get('/api/materialidades', async(req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.materialidad');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener las materialidades", err)
        res.status(500).json({error: "Error al obtener las materialidades"})
    }
})

// Ruta para realizar una petición de los estados de la tabla instrumento
app.get('/api/estados_instrumento', async(req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.estado_instru');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener los estados del instrumento", err)
        res.status(500).json({error: "Error al obtener los estado del instrumento"})
    }
})

// Ruta para actualizar la información de un instrumento
app.put('/api/instrumento/:id_instrumento', async (req, res)=>{
    const {id_instrumento} = req.params;
    const {instrumento, id_tipo, id_materialidad, id_marca, id_modelo, rut_cargo, id_seccion_cargo, ubicacion, id_estado_instru} = req.body
    console.log("ID URL:", id_instrumento);
    console.log("Body:", req.body);
    try {
        const updateInstrumento = await pool.query(
            'UPDATE instrumentos.instrumentos SET instrumento= $2,id_tipo=$3, id_materialidad=$4, id_marca=$5, id_modelo=$6,rut_cargo=$7,id_seccion_cargo=$8,ubicacion=$9, id_estado_instru=$10 WHERE id_instrumento= $1 RETURNING *',
            [id_instrumento, instrumento, id_tipo, id_materialidad, id_marca, id_modelo, rut_cargo, id_seccion_cargo, ubicacion, id_estado_instru]
        );
        if (updateInstrumento.rows.length === 0) {
            return res.status(404).json({ message: "Item no encontrado"});
        }
        res.json(updateInstrumento.rows[0])
    }
    catch (err) {
        console.error(err.message);
        console.error("Error detallado:", err);
        res.status(500).send("Error en la actualización")
    }
})


// Ruta para realizar una petición del historial de calibraciones de un instrumento.
app.get('/api/instrumento/calibraciones/:id_instrumento', async (req, res)=>{
    const {id_instrumento} = req.params
    try {
        const result = await pool.query('SELECT * FROM instrumentos.v_instrumentos_ingresos_calibr WHERE id_instrumento=$1', [id_instrumento])
        res.json(result.rows)
    } catch (error) {
        console.log("Error al obtener los ingresos a calibración del instrumento", error)
        res.status(500).json({error: "Error al obtener el ingresos a calibración del instrumento"})
    }

})

// Ruta para realizar una petición de las etapas de un hito de calibración
app.get('/api/certificado_estado', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.estado_calibr');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener el estado de un certificado de calibración", err)
        res.status(500).json({error: "Error al obtener los datos de los estados de calibración"})
    }
})

// Ruta para agregar un certificado de calibración
app.post('/api/calibration/agregar_certificado', async (req, res) => {
    try {
        const {n_certificado, id_tipo_instru, id_estado_certif, fecha_certif, responsable} = req.body //datos que recibimos desde el fronted
        const newCertificado = await pool.query(
            'INSERT INTO instrumentos.certificado(n_certificado, id_tipo_instru, id_estado_certif, fecha_certif, responsable) VALUES ($1, $2,$3,$4,$5) RETURNING *',
            [n_certificado, id_tipo_instru, id_estado_certif, fecha_certif, responsable]
        )
        
        let certificado;
        if (Number(id_tipo_instru)===1) {
            certificado = await pool.query(
                'INSERT INTO instrumentos.certificado_gps(n_certificado_g,id_tipo) VALUES ( $1, $2) RETURNING *',
                [n_certificado, id_tipo_instru]
            )
        }       

        if (Number(id_tipo_instru)===2) {
            certificado = await pool.query(
                'INSERT INTO instrumentos.certificado_et(n_certificado_e,id_tipo) VALUES ( $1, $2) RETURNING *',
                [n_certificado, id_tipo_instru]
            )
        } 
        if (Number(id_tipo_instru)===3) {
            certificado = await pool.query(
                'INSERT INTO instrumentos.certificado_nivel(n_certificado_n,id_tipo) VALUES ( $1, $2) RETURNING *',
                [n_certificado, id_tipo_instru]
            )
        } 
        console.log(certificado)
        res.json({
            newCertificado:newCertificado.rows[0],
            certificado: certificado?.rows[0] || null
        })
    } catch (error) {
        console.error("Error al agregar el certificado", error)
        if (error.code === '23505'){
            return res.status(400).json({
                message:"El nº de certificado ya existe"
            })
        }
        return res.status(400).json({
            message: "Error al agregar el certificado",
            detail: error.message
        });
          
    }

})

// Ruta para actualizar la información de una solicitud de calibración (tabla intermedia instrumento_calibr)
app.put('/api/calibration/solicitud/:id_instru_calibr', async (req, res)=>{
    const {id_instru_calibr} = req.params;
    const {n_certificado, fecha_ingreso, fecha_entrega, precio_calibr_instru} = req.body
    //console.log("ID URL:", id_instrumento);
    //console.log("Body:", req.body);
    try {
        const updateInstrumentoCalibration = await pool.query(
            'UPDATE instrumentos.instrumento_calibr SET n_certificado= $2,fecha_ingreso=$3, fecha_entrega=$4, precio_calibr_instru=$5 WHERE id_instru_calibr= $1 RETURNING *',
            [id_instru_calibr, n_certificado, fecha_ingreso, fecha_entrega, precio_calibr_instru]
        );
        if (updateInstrumentoCalibration.rows.length === 0) {
            return res.status(404).json({ message: "Item no encontrado"});
        }
        res.json(updateInstrumentoCalibration.rows[0])
    }
    catch (err) {
        console.error(err.message);
        console.error("Error detallado:", err);
        res.status(500).send("Error en la actualización")
    }
})

//Ruta para obtener la información de detalle del certificado y calibración de instrumentos topográficos
app.get('/api/instrumento/calibraciones/detalle/:id_instrumento/:n_certificado', async (req, res)=>{
    const {id_instrumento,n_certificado} = req.params
    console.log("PARAMS:", req.params);
    try {
        const result = await pool.query('SELECT * FROM instrumentos.v_info_calibracion_instrumentos WHERE id_instrumento=$1 AND n_certificado=$2', [id_instrumento,n_certificado])
        res.json(result.rows)
        console.log("Se ha ejecutado la petición de detalle de certificado")
    } 
    catch (error) {
        console.log("Error al obtener los ingresos a calibración del instrumento", error)
        res.status(500).json({error: "Error al obtener el ingresos a calibración del instrumento"})
    }

})

// Ruta para actualizar la información de calibración de un instrumento topográfico+archivos
app.put('/api/instrumento/calibraciones/certificado/:id_instru_calibr', async (req, res)=>{
    const {id_instru_calibr} = req.params;
    const {n_certificado, id_tipo ,fecha_entrega, id_estado_certif, fecha_certif, responsable_certif,responsable_calibr,prec_dist_gps, prec_alt_gps,fecha_calibr,prec_dist_cp_et,prec_ang_hz_et, prec_ang_vert_et, prec_dist_sp_et, prec_nivel} = req.body
    //console.log("ID URL:", id_instrumento);
    //console.log("Body:", req.body);
    try {
        const updateInstrumentoCalibration2 = await pool.query(
            'UPDATE instrumentos.instrumento_calibr SET fecha_entrega=$2 WHERE id_instru_calibr= $1 RETURNING *',
            [id_instru_calibr, fecha_entrega]
        );
        if (updateInstrumentoCalibration2.rows.length === 0) {
            return res.status(404).json({ message: "Item no encontrado"});
        }
        
        const updateCertificadoCalibration = await pool.query(
            'UPDATE instrumentos.certificado SET id_estado_certif=$3, fecha_certif=$4, responsable=$5 WHERE n_certificado= $1 AND id_tipo_instru=$2 RETURNING *',
            [n_certificado, id_tipo, id_estado_certif, fecha_certif, responsable_certif ]
        )
        if (updateCertificadoCalibration.rows.length === 0) {
            return res.status(404).json({ message: "Item de Certificado no encontrado"});
        }
        let certificadoCalibracion;
        if(Number(id_tipo)===1){
            certificadoCalibracion = await pool.query(
                'UPDATE instrumentos.certificado_gps SET prec_dist=$1, prec_altura=$2, fecha_calibr=$3, responsable=$4 WHERE n_certificado_g=$5 RETURNING *',
            [prec_dist_gps, prec_alt_gps,fecha_calibr, responsable_calibr, n_certificado])
        }
        if(Number(id_tipo)===2){
            certificadoCalibracion = await pool.query(
                'UPDATE instrumentos.certificado_et SET prec_dist_cp=$1,prec_ang_hz=$2, prec_ang_vert=$3, prec_dist_sp=$4, fecha_calibr=$5, responsable=$6 WHERE n_certificado_e=$7 RETURNING *',
            [prec_dist_cp_et,prec_ang_hz_et, prec_ang_vert_et, prec_dist_sp_et,fecha_calibr, responsable_calibr,n_certificado])
        }

        if(Number(id_tipo)===3){
            certificadoCalibracion = await pool.query(
                'UPDATE instrumentos.certificado_nivel SET precision=$1, fecha_calibr=$2, responsable=$3 WHERE n_certificado_n=$4 RETURNING *',
            [prec_nivel,fecha_calibr, responsable_calibr, n_certificado])
        }
        res.json({
            instrumento_calibracion:updateInstrumentoCalibration2.rows[0],
            certificado: updateCertificadoCalibration.rows[0],
            calibracion: certificadoCalibracion?.rows[0]|| null}
        )
    }
    catch (err) {
        console.error(err.message);
        console.error("Error detallado:", err);
        res.status(500).send("Error en la actualización")
    }
})

// Ruta para realizar una petición de los hitos de verificacion
app.get('/api/verificacion', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.hitos_verificacion');
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener los hitos  de verificacion", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Ruta para crear un hito de verificacion nuevo nuevo
app.post('/api/verificaciones/agregar', async (req, res) => {
    try {
        const {id_responsable, id_estado_verif, trim_anio} = req.body //datos que recibimos desde el fronted
        const newVerificacion = await pool.query(
            'INSERT INTO instrumentos.verificacion(id_responsable, id_estado_verif, trim_anio) VALUES ($1, $2, $3) RETURNING *',
            [id_responsable, id_estado_verif, trim_anio]
        )
       
        res.json(newVerificacion.rows[0])
    } catch (error) {
        console.log("Error a crear hito de verificacion", error);
        console.error(error)
    }

})

// Petición de estados de verificacion
app.get('/api/verificaciones/estados', async (req, res)=>{
    //const {id_marca} = req.query
    try {
        const result = await pool.query('SELECT * FROM instrumentos.estado_verif');
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener los estados de verificación", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Petición para eliminar un hito de verificación y todos sus instrumentos asociados. Dado que tenemos 2 consultas, debemos realizarlo utilizando transanccioness.
app.delete('/api/verificaciones/delete/:id_verificacion', async (req, res)=>{
    const {id_verificacion} = req.params
    console.log("ID Verificacion recibido para eliminación:", id_verificacion);

    const client = await pool.connect() //Conectamos manualmente para poder manejar la transacción a realizar.

    try {
        await client.query("BEGIN") //Iniciamos la transancción

        //Eliminamos los instrumentos asociados al hito de verificacion
        await client.query('DELETE FROM instrumentos.instrumento_verif WHERE id_verificacion = $1',
        [id_verificacion])

        //Eliminamos las jornadas asociadas al hito de verificacion
        await client.query('DELETE FROM instrumentos.jorn_verificacion WHERE id_verificacion = $1',
            [id_verificacion])
        
        //Posterior a lo anterior, eliminamos el hito de verificacion
        const result = await client.query('DELETE FROM instrumentos.verificacion WHERE id_verificacion= $1 RETURNING *',[id_verificacion])
        
       if(result.rowCount === 0){
            await client.query("ROLLBACK") //Revertimos si no encuentra el hito de calibración
            return res.status(404).json({error:"Hito de Verificacion no encontrado"})
        }

        await client.query("COMMIT") //Confirmamos la transacción

        console.log("Resultado de la eliminación:", result.rows[0]);
        res.json(result.rows[0])

    } catch (error) {
        await client.query("ROLLBACK") //Deshacer cambios si hay un error
        console.error("Error al eliminar el Hito de Verificación", error)
        res.status(500).json({error: `Error al eliminar el Hito de Verificación Nº ${id_verificacion}`})
    } finally {
        client.release()
    }


})

// Ruta para realizar una petición de los instrumentos en los que aplica verificaciòn y NO son parte del hito de verificacion consultado
app.get('/api/verificaciones/aplica_instrumentos/:id_verificacion', async (req, res) => {
    const {id_verificacion} = req.params
    try {
      const result = await pool.query('SELECT id, instrumento, serie, tipo, materialidad, seccion, marca, modelo, estado, cargo, aplica_verif, aplica_calib, ubicacion, obs_estado FROM (SELECT * FROM instrumentos."Tabla de Instrumentos" WHERE aplica_verif = TRUE) AS a LEFT JOIN (SELECT * FROM instrumentos.instrumento_verif WHERE id_verificacion = $1) AS b ON a.id = b.id_instrumento WHERE id_verificacion IS NULL GROUP BY (id, instrumento, serie, tipo, materialidad, seccion, marca, modelo, estado, cargo, aplica_verif, aplica_calib, ubicacion, obs_estado) ORDER BY id',[id_verificacion]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener los datos'});
    }
  });

  // Ruta para agregar instrumentos a un hito de verificación
app.post('/api/verificaciones/addInstrument', async (req, res) => {
    try {
        const {id_verificacion, id} = req.body //datos que recibimos desde el fronted
        const newInstrumentVerificacion = await pool.query(
            'INSERT INTO instrumentos.instrumento_verif(id_verificacion, id_instrumento) VALUES ($1, $2) RETURNING *',
            [id_verificacion, id]
        )
        console.log(newInstrumentVerificacion)
        /*await pool.query(
            'INSERT INTO instrumentos.instrumentos(id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURING *',
            [id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado]
        )*/
        res.json(newInstrumentVerificacion.rows[0])
    } catch (error) {
        console.error(error)
    }

})


// Ruta para realizar una petición de los instrumentos asociados a un hito de verificacion
app.get('/api/verificacion/instrumentos/:id_verificacion', async (req, res) => {
    const {id_verificacion} = req.params
    try {
      const result = await pool.query('SELECT id, instrumento, serie, tipo, materialidad, seccion, marca, modelo, estado, cargo, aplica_verif, aplica_calib, ubicacion, obs_estado,id_verificacion FROM instrumentos."Tabla de Instrumentos" AS a RIGHT JOIN (SELECT * FROM instrumentos.instrumento_verif WHERE id_verificacion = $1) AS b ON a.id = b.id_instrumento GROUP BY (id, instrumento, serie, tipo, materialidad, seccion, marca, modelo, estado, cargo, aplica_verif, aplica_calib, ubicacion, obs_estado,id_verificacion) ORDER BY id',[id_verificacion]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener los datos'});
    }
  });


// Petición para eliminar instrumentos asociados de un hito de verificacion
app.delete('/api/verificacion/instrumentasociate/delete/:id_verificacion', async (req, res)=>{
    console.log("🚀 ¡Solicitud DELETE recibida!");
    console.log("Parámetro id_calibration:", req.params.id_verificacion);
    console.log("Cuerpo de la petición:", req.body);  // <-- Ver si llegan los datos correctamente

    const {id_verificacion} = req.params
    const {instrumentosAEliminar} = req.body
    

    if (!instrumentosAEliminar || instrumentosAEliminar.length===0){
        return res.status(400).json({message:`No hay instrumentos para eliminar ${instrumentosAEliminar}`})
    }

    try{
        const query = `DELETE FROM instrumentos.instrumento_verif WHERE id_instrumento=ANY($1) AND id_verificacion=$2`
        const values = [instrumentosAEliminar, id_verificacion]

        console.log("Query generada:", query);
        console.log("Valores enviados:", values);

        await pool.query(query, values)

        res.json({message: "Instrumentos eliminados correctamente"})
    }
     catch (error) {
        console.error("Error al eliminar los instrumentos:", error.message);
        res.status(500).json({ message: `Error en el servidor: ${error.message}` });
    } 

})

// Ruta para realizar una petición de los hitos de verificacion filtrado por su Id Hito
app.get('/api/verificacion/:id_verificacion', async (req, res)=>{
    const {id_verificacion} = req.params
    try {
        const result = await pool.query('SELECT * FROM instrumentos.hitos_verificacion WHERE "id_verificacion"=$1',[id_verificacion]);
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener los hitos  de verificacion", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Ruta para realizar una petición de los estados de la tabla verificacion
app.get('/api/estados_verificacion', async(req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.estado_verif');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener los estados de las verificaciones", err)
        res.status(500).json({error: "Error al obtener los estado de las verificaciones"})
    }
})

// Ruta para actualizar la información de los resultados de la verificacion (tabla intermedia instrumento_verif)
app.put('/api/verificacion/solicitud/:id_instru_verif', async (req, res)=>{
    const {id_instru_verif} = req.params;
    const {id_resultado_verif_fis, id_resultado_verif_dig, id_resultado_verif_oper, obs_result} = req.body
    //console.log("ID URL:", id_instrumento);
    //console.log("Body:", req.body);
    try {
        const updateInstrumentoVerificacion = await pool.query(
            'UPDATE instrumentos.instrumento_verif SET id_resultado_verif_fis= $2,id_resultado_verif_dig=$3, id_resultado_verif_oper=$4, obs_result=$5 WHERE id_instru_verif= $1 RETURNING *',
            [id_instru_verif, id_resultado_verif_fis, id_resultado_verif_dig, id_resultado_verif_oper, obs_result]
        );
        if (updateInstrumentoVerificacion.rows.length === 0) {
            return res.status(404).json({ message: "Item no encontrado"});
        }
        res.json(updateInstrumentoVerificacion.rows[0])
    }
    catch (err) {
        console.error(err.message);
        console.error("Error detallado:", err);
        res.status(500).send("Error en la actualización")
    }
})

// Ruta para actualizar la información de un hito de verificación + archivos
app.put('/api/verificacion/:id_verificacion', upload.array('archivos'), async (req, res)=>{
    const {id_verificacion} = req.params;
    const {id_responsable, id_estado_verif, trim_anio} = req.body
    console.log("ID URL:", id_verificacion);
    console.log("Body:", req.body);

    let { fecha_fin_verif } = req.body;

    fecha_fin_verif =
        fecha_fin_verif === ""
            ? null
            : fecha_fin_verif;
    
    try {
        // 1) Actualizar información del hito
        const updateHitoVerificacion = await pool.query(
            'UPDATE instrumentos.verificacion SET id_responsable= $2,id_estado_verif=$3, trim_anio=$4, fecha_fin_verif=$5 WHERE id_verificacion= $1 RETURNING *',
            [id_verificacion,id_responsable, id_estado_verif, trim_anio,fecha_fin_verif]
        );
        if (updateHitoVerificacion.rows.length === 0) {
            return res.status(404).json({ message: "Item no encontrado"});
        }

         // 2) Guardar referencias de archivos
         if(req.files && req.files.length > 0){
            
            for(const archivo of req.files){
                
                await pool.query(
                    `
                    INSERT INTO instrumentos.verificacion_archivos
                    (
                        id_verificacion,
                        nombre_original,
                        nombre_archivo,
                        ruta_archivo,
                        tipo
                    )
                    VALUES($1,$2,$3,$4,$5)
                    `,
                    [
                        id_verificacion,
                        archivo.originalname,
                        archivo.filename,
                        archivo.path,
                        archivo.mimetype,
                    ]
                );

            }

        }
        res.json({
            message:"Hito actualizado correctamente",
            hito:updateHitoVerificacion.rows[0],
            archivos:req.files?.length || 0
        });
    }
    catch (err) {
        console.error(err.message);
        console.error("Error detallado:", err);
        res.status(500).json({
            message:"Error en la actualización",
            error:err.message
        });
    }
})

// Ruta para realizar una petición de las jornadas de verificacion para un hito de verificacion en específico
app.get('/api/verificacion/jornadas/:id_verificacion', async (req, res)=>{
    const {id_verificacion} = req.params
    try {
        const result = await pool.query('SELECT * FROM instrumentos.jornadas_verificacion WHERE id_verificacion = $1', [id_verificacion]);
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener las jornadas de un hito de Verificacion", err)
        res.status(500).json({error: "Error al obtener las jornadas de un hito de Verificacion"})
    }
})

// Ruta para agregar una jornada a un hito de verificacion
app.post('/api/verificacion/agregar_jornada', async (req, res) => {
    try {
        const {id_verificacion, id_responsable,fecha_verif,lugar_verif} = req.body //datos que recibimos desde el fronted
        const newLog = await pool.query(
            'INSERT INTO instrumentos.jorn_verificacion(id_verificacion, id_responsable_jorn,fecha_verif,lugar_verif) VALUES ($1, $2,$3,$4) RETURNING *',
            [id_verificacion, id_responsable,fecha_verif,lugar_verif]
        )
        console.log(newLog)
        res.json(newLog.rows[0])
    } catch (error) {
        console.error(error)
    }

})


// Ruta para realizar una petición del historial de resultados de verificaciones de un instrumento.
app.get('/api/instrumento/verificaciones/:id_instrumento', async (req, res)=>{
    const {id_instrumento} = req.params
    try {
        const result = await pool.query('SELECT * FROM instrumentos.v_resultados_verificacion WHERE id_instrumento=$1', [id_instrumento])
        res.json(result.rows)
    } catch (error) {
        console.log("Error al obtener los ingresos a verificacion del instrumento", error)
        res.status(500).json({error: "Error al obtener el ingresos a verificacion del instrumento"})
    }

})

// Ruta para realizar una petición de los tipos de resultados de una verificacion
app.get('/api/resultados_verificacion', async(req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.resultado_verif');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener los resultados de las verificaciones", err)
        res.status(500).json({error: "Error al obtener los resultados de las verificaciones"})
    }
})

//Ruta para enlistar archivos de un hito de verificacion
app.get(
    '/api/verificacion/:id_verificacion/archivos',
    async(req,res)=>{
    
    const {id_verificacion}=req.params;
    
    const result =
    await pool.query(
    `
    SELECT *
    FROM instrumentos.verificacion_archivos
    WHERE id_verificacion=$1
    `,
    [id_verificacion]    
    );
    res.json(result.rows);

    });

//Ruta para descargar archivos de un hito de verificacion
    app.get(
        '/api/verificacion/archivo/:id',
        async(req,res)=>{
        
        
        const result =
        await pool.query(
        
        `
        SELECT ruta_archivo
        FROM instrumentos.verificacion_archivos
        WHERE id_archivo=$1
        
        `,
        [req.params.id]
        
        );
        
        
        res.download(result.rows[0].ruta_archivo);
        
        
        });

// Visualizar archivo de un hito de verificacion
app.get(
    '/api/verificacion/archivo/:id/visualizar',
    async (req, res) => {

        try {

            const result = await pool.query(
                `
                SELECT ruta_archivo
                FROM instrumentos.verificacion_archivos
                WHERE id_archivo = $1
                `,
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: 'Archivo no encontrado'
                });
            }

            res.sendFile(
                path.resolve(result.rows[0].ruta_archivo)
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: 'Error al visualizar el archivo'
            });
        }
    }
);

// API para eliminar archivos de un hito de verificación

app.delete("/api/verificacion/archivo/:id_archivo", async (req, res) => {

    const { id_archivo } = req.params;

    try {

        // Buscar información del archivo
        const result = await pool.query(
            `SELECT ruta_archivo
             FROM instrumentos.verificacion_archivos
             WHERE id_archivo = $1`,
            [id_archivo]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Archivo no encontrado"
            });
        }

        const rutaArchivo = result.rows[0].ruta_archivo;

        // Eliminar archivo físico
        if (fs.existsSync(rutaArchivo)) {
            fs.unlinkSync(rutaArchivo);
        }

        // Eliminar registro de la BD
        await pool.query(
            `DELETE
             FROM instrumentos.verificacion_archivos
             WHERE id_archivo = $1`,
            [id_archivo]
        );

        res.json({
            message: "Archivo eliminado correctamente"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Error al eliminar el archivo"
        });

    }

});

//Ruta para enlistar información general de los datos de un instrumento
app.get(
    '/api/instrumentos/info/:id_instrumento',
    async(req,res)=>{
    
    const {id_instrumento}=req.params;
    
    const result =
    await pool.query(
    `
    SELECT *
    FROM instrumentos.v_info_instrumento_general
    WHERE id_instrumento=$1
    `,
    [id_instrumento]    
    );
    res.json(result.rows);

    });

//Ruta para enlistar información general de los datos de un instrumento
app.get('/api/instrumentos/info/:id_instrumento', async (req, res)=>{
    const {id_instrumento} = req.params
    try {
        const result = await pool.query(`
        SELECT *
        FROM instrumentos.v_info_instrumento_general
        WHERE id_instrumento=$1
        `, [id_instrumento]);
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener la información de actualización del instrumento", err)
        res.status(500).json({error: "Error al obtener la información de actualización del instrumento"})
    }
})

//Ruta para enlistar información de los datos de un hito de calibración
app.get('/api/calibracion/info/:id_solic_calibr', async (req, res)=>{
    const {id_solic_calibr} = req.params
    try {
        const result = await pool.query(`
        SELECT *
        FROM instrumentos.v_info_datos_calibracion
        WHERE id_solic_calibr=$1
        `, [id_solic_calibr]);
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener la información de actualización del hito de calibración", err)
        res.status(500).json({error: "Error al obtener la información de actualización del hito de calibración"})
    }
})


//Ruta para enlistar información de los datos de un hito de verificacion
app.get('/api/verificacion/info/:id_verificacion', async (req, res)=>{
    const {id_verificacion} = req.params
    try {
        const result = await pool.query(`
        SELECT *
        FROM instrumentos.v_info_datos_verificacion
        WHERE id_verificacion=$1
        `, [id_verificacion]);
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener la información de actualización del hito de verificacion", err)
        res.status(500).json({error: "Error al obtener la información de actualización del hito de verificacion"})
    }
})

//Ruta para enlistar archivos asociados a un instrumento
app.get(
    '/api/instrumentos/:id_instrumento/archivos',
    async(req,res)=>{
    
    const {id_instrumento}=req.params;
    
    const result =
    await pool.query(
    `
    SELECT *
    FROM instrumentos.v_info_archivos
    WHERE id_instrumento=$1
    `,
    [id_instrumento]    
    );
    res.json(result.rows);

    });

//Ruta para agregar una tarea a un hito de verificación
app.post('/api/verificacion/agregar_tareas', async (req, res) => {
    try {
        //const {id_instrumento, id_instru_verif,titulo,descripcion, id_criticidad, id_estado_tarea, id_creado_por,id_responsable} = req.body 
        const tareas = req.body

         // Arreglo donde almacenaremos las tareas insertadas
         const tareasCreadas = [];
        for (const tarea of tareas) {
            const {
                id_instrumento,
                titulo,
                descripcion,
                id_criticidad,
                id_estado_tarea,
                id_verificacion,
                id_responsable,
                id_creado_por
            } = tarea;//datos que recibimos desde el fronted
        const newTask = await pool.query(
            'INSERT INTO instrumentos.tareas(id_instrumento, id_verificacion,titulo,descripcion, id_criticidad, id_estado_tarea, id_creado_por,id_responsable) VALUES ($1, $2,$3,$4,$5,$6,$7,$8) RETURNING *',
            [id_instrumento, id_verificacion,titulo,descripcion, id_criticidad, id_estado_tarea, id_creado_por,id_responsable]
        )
        // Agregamos la tarea recién creada al arreglo
        tareasCreadas.push(newTask.rows[0]);}
       // Devolvemos todas las tareas creadas
       res.status(201).json(tareasCreadas);
    } catch (error) {
        console.error(error)
        res.status(500).json({error: "Error al ingresar una nueva tarea"})
    }

})

// Ruta para realizar una petición de las distintas criticidades de una tarea
app.get('/api/criticidad_tarea', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.criticidad_tareas');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener las distintas criticidades de una tarea", err)
        res.status(500).json({error: "Error al obtener los datos de las criticidades"})
    }
})

// Ruta para realizar una petición de los distintos estados de una tarea
app.get('/api/estado_tarea', async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM instrumentos.estado_tareas');
        res.json(result.rows)
    } catch (err){
        console.log("Error al obtener los distintos estados de una tarea", err)
        res.status(500).json({error: "Error al obtener los datos de los estados de la tarea"})
    }
})

//Ruta para enlistar el total de tareas de un instrumento
app.get(
    '/api/tareas/:id_instrumento',
    async(req,res)=>{
    
    const {id_instrumento}=req.params;
    
    try {
        const result = await pool.query(
    `
    SELECT *
    FROM instrumentos.v_total_tareas
    WHERE id_instrumento=$1
    `,
    [id_instrumento]    
    );
    res.json(result.rows)
    } catch (err){
        console.log("Error al obtener las distintas tareas de un instrumento", err)
        res.status(500).json({error: "Error al obtener los datos las tarea de un instrumento"})
    }

    });


// Petición para eliminar una lista de tareas
app.delete('/api/tareas/delete', async (req, res)=>{
    //console.log("🚀 ¡Solicitud DELETE recibida!");
    //console.log("Parámetro id_calibration:", req.params.id_calibration);
    //console.log("Cuerpo de la petición:", req.body);  // <-- Ver si llegan los datos correctamente

    //const {id_tarea} = req.params
    const {tareasAEliminar} = req.body
    

    try{
        const query = `DELETE FROM instrumentos.tareas WHERE id_tarea=ANY($1)`
        const values = [tareasAEliminar]

        //console.log("Query generada:", query);
        //console.log("Valores enviados:", values);

        await pool.query(query, values)

        res.json({message: "tareas eliminada correctamente"})
    }
     catch (error) {
        console.error("Error al eliminar las tareas:", error.message);
        res.status(500).json({ message: `Error en el servidor: ${error.message}` });
    } 

})

// Ruta para actualizar la información de varias tareas luego de ser completadas
app.put('/api/tareas/completar', async (req, res) => {

    const { tareas } = req.body;

    try {

        for (const tarea of tareas) {

            const query = `
                UPDATE instrumentos.tareas
                SET
                    id_completado_por = $1,
                    fecha_completada = $2,
                    comentario_completado = $3,
                    id_estado_tarea = $4
                WHERE id_tarea = $5
            `;

            const values = [
                tarea.id_completado_por,
                tarea.fecha_completada,
                tarea.comentario_completado,
                tarea.id_estado_tarea,
                tarea.id_tarea
            ];

            await pool.query(query, values);
        }

        res.json({
            message: "Tareas actualizadas correctamente"
        });

    } catch (error) {

        console.error(
            "Error al actualizar las tareas:",
            error.message
        );

        res.status(500).json({
            message: `Error en el servidor: ${error.message}`
        });
    }
});

// Ruta para actualizar los archivos asociados a una certificado de calibración
app.put('/api/calibraciones/archivos/:n_certificado', uploadCalibracion.array('archivos'), async (req, res)=>{
    const {n_certificado} = req.params;
   // const {id_responsable, id_estado_verif, trim_anio} = req.body
    console.log("ID URL:", n_certificado);
    //console.log("Body:", req.body);

    try {
         // 1) Guardar referencias de archivos
         if(req.files && req.files.length > 0){
            
            for(const archivo of req.files){
                
                await pool.query(
                    `
                    INSERT INTO instrumentos.calibracion_archivos
                    (
                        n_certificado,
                        nombre_original,
                        nombre_archivo,
                        ruta_archivo,
                        tipo
                    )
                    VALUES($1,$2,$3,$4,$5)
                    `,
                    [
                        n_certificado,
                        archivo.originalname,
                        archivo.filename,
                        archivo.path,
                        archivo.mimetype,
                    ]
                );

            }

        }
        res.json({
            message:"Archivo de Certificado de Calibración actualizado correctamente",
            //hito:updateHitoVerificacion.rows[0],
            archivos:req.files?.length || 0
        });
    }
    catch (err) {
        console.error(err.message);
        console.error("Error detallado:", err);
        res.status(500).json({
            message:"Error en la actualización",
            error:err.message
        });
    }
})

// API para eliminar archivos de un certificado de calibracion

app.delete("/api/calibracion/archivo/:id_archivo", async (req, res) => {

    const { id_archivo } = req.params;

    try {

        // Buscar información del archivo
        const result = await pool.query(
            `SELECT ruta_archivo
             FROM instrumentos.calibracion_archivos
             WHERE id_archivo = $1`,
            [id_archivo]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Archivo no encontrado"
            });
        }

        const rutaArchivo = result.rows[0].ruta_archivo;

        // Eliminar archivo físico
        if (fs.existsSync(rutaArchivo)) {
            fs.unlinkSync(rutaArchivo);
        }

        // Eliminar registro de la BD
        await pool.query(
            `DELETE
             FROM instrumentos.calibracion_archivos
             WHERE id_archivo = $1`,
            [id_archivo]
        );

        res.json({
            message: "Archivo eliminado correctamente"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Error al eliminar el archivo"
        });

    }

});

//Ruta para enlistar archivos de un certificado de calibracion
app.get(
    '/api/calibracion/:n_certificado/archivos',
    async(req,res)=>{
    
    const {n_certificado}=req.params;
    
    const result =
    await pool.query(
    `
    SELECT *
    FROM instrumentos.calibracion_archivos
    WHERE n_certificado=$1
    `,
    [n_certificado]    
    );
    res.json(result.rows);

    });

//Ruta para descargar archivos de un certificado de calibracion
    app.get(
        '/api/calibracion/archivo/:id',
        async(req,res)=>{
        
        
        const result =
        await pool.query(
        
        `
        SELECT ruta_archivo
        FROM instrumentos.calibracion_archivos
        WHERE id_archivo=$1
        
        `,
        [req.params.id]
        
        );
        
        
        res.download(result.rows[0].ruta_archivo);
        
        
        });

// Visualizar archivo de un certificado de calibracion
app.get(
    '/api/calibracion/archivo/:id/visualizar',
    async (req, res) => {

        try {

            const result = await pool.query(
                `
                SELECT ruta_archivo
                FROM instrumentos.calibracion_archivos
                WHERE id_archivo = $1
                `,
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: 'Archivo no encontrado'
                });
            }

            res.sendFile(
                path.resolve(result.rows[0].ruta_archivo)
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: 'Error al visualizar el archivo'
            });
        }
    }
);

// Visualizar archivo de cualquier documentación
app.get(
    '/api/documentacion/archivo/:id/visualizar',
    async (req, res) => {

        try {

            const result = await pool.query(
                `
                SELECT ruta_archivo
                FROM instrumentos.v_info_archivos
                WHERE id_archivo = $1
                `,
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: 'Archivo no encontrado'
                });
            }

            res.sendFile(
                path.resolve(result.rows[0].ruta_archivo)
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: 'Error al visualizar el archivo'
            });
        }
    }
);

//Api para generar archivos ZIP con el certficado de calibración
app.get('/api/calibracion/:cod_certificado/archivos/zip', async (req, res) => {

    const archiverModule = await import("archiver");
    const { ZipArchive } = await import("archiver");

    const { cod_certificado } = req.params;

    try {

        // Buscar los archivos asociados a la calibración
        const resultado = await pool.query(`
            SELECT
                id_archivo,
                nombre_original,
                ruta_archivo
            FROM instrumentos.calibracion_archivos
            WHERE n_certificado = $1
        `, [cod_certificado]);

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                message: "La calibración no tiene archivos asociados"
            });
        }


        // Nombre del ZIP
        const nombreZip = `calibracion_${cod_certificado}.zip`;

        res.attachment(nombreZip);

        // Crear ZIP
        const archive = new ZipArchive({
            zlib: { level: 9 }
        });

        // Manejo de errores del ZIP
        archive.on('error', (error) => {
            console.error("Error creando ZIP:", error);

            if (!res.headersSent) {
                res.status(500).json({
                    message: "Error al generar el archivo ZIP"
                });
            }
        });

        // Enviar ZIP directamente al navegador
        archive.pipe(res);

        // Agregar archivos
        for (const archivo of resultado.rows) {

            const rutaArchivo = path.resolve(archivo.ruta_archivo);

            // Verificar que exista físicamente
            if (fs.existsSync(rutaArchivo)) {

                archive.file(rutaArchivo, {
                    name: archivo.nombre_original
                });

            } else {

                console.warn(
                    `Archivo no encontrado: ${rutaArchivo}`
                );

            }
        }

        // Finalizar ZIP
        await archive.finalize();

    } catch (error) {

        console.error(error);

        if (!res.headersSent) {
            res.status(500).json({
                message: "Error al descargar los archivos"
            });
        }

    }

});


//Api para generar archivos ZIP del hito de verificación
app.get('/api/verificacion/:id_verificacion/archivos/zip', async (req, res) => {

    const archiverModule = await import("archiver");
    const { ZipArchive } = await import("archiver");

    const { id_verificacion } = req.params;

    try {

        // Buscar los archivos asociados a la calibración
        const resultado = await pool.query(`
            SELECT
                id_archivo,
                nombre_original,
                ruta_archivo
            FROM instrumentos.verificacion_archivos
            WHERE id_verificacion = $1
        `, [id_verificacion]);

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                message: "El hito de verificacion no tiene archivos asociados"
            });
        }


        // Nombre del ZIP
        const nombreZip = `verificacion_${id_verificacion}.zip`;

        res.attachment(nombreZip);

        // Crear ZIP
        const archive = new ZipArchive({
            zlib: { level: 9 }
        });

        // Manejo de errores del ZIP
        archive.on('error', (error) => {
            console.error("Error creando ZIP:", error);

            if (!res.headersSent) {
                res.status(500).json({
                    message: "Error al generar el archivo ZIP"
                });
            }
        });

        // Enviar ZIP directamente al navegador
        archive.pipe(res);

        // Agregar archivos
        for (const archivo of resultado.rows) {

            const rutaArchivo = path.resolve(archivo.ruta_archivo);

            // Verificar que exista físicamente
            if (fs.existsSync(rutaArchivo)) {

                archive.file(rutaArchivo, {
                    name: archivo.nombre_original
                });

            } else {

                console.warn(
                    `Archivo no encontrado: ${rutaArchivo}`
                );

            }
        }

        // Finalizar ZIP
        await archive.finalize();

    } catch (error) {

        console.error(error);

        if (!res.headersSent) {
            res.status(500).json({
                message: "Error al descargar los archivos"
            });
        }

    }

});


//Crea una cuenta pendiente, con rol consulta, y nunca acepta un rol enviado por el cliente.
app.post('/api/auth/registro', async (req, res) => {
    const { nombre, usuario, password } = req.body;
  
    if (
      typeof nombre !== 'string' ||
      typeof usuario !== 'string' ||
      typeof password !== 'string' ||
      !nombre.trim() ||
      !usuario.trim() ||
      password.length < 10
    ) {
      return res.status(400).json({
        message:
          'Ingresa tu nombre, usuario y una contraseña de al menos 10 caracteres',
      });
    }
  
    try {
      const passwordHash = await bcrypt.hash(password, 12);
  
      const resultado = await pool.query(
        `INSERT INTO instrumentos.usuarios
          (nombre, usuario, password_hash, rol, activo, revisado)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_usuario, nombre, usuario, rol, activo, revisado`,
        [
          nombre.trim(),
          usuario.trim(),
          passwordHash,
          'consulta',
          false,
          false
        ]
      );
  
      return res.status(201).json({
        message:
          'Solicitud registrada. Un administrador debe habilitar tu cuenta.',
        usuario: resultado.rows[0],
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          message: 'Ese nombre de usuario ya está registrado',
        });
      }
  
      console.error('Error al registrar usuario:', error);
  
      return res.status(500).json({
        message: 'No fue posible registrar la solicitud',
      });
    }
  });


/* Listar usuarios y sus estados */
app.get(
    '/api/admin/usuarios',
    requireRole('admin'),
    async (req, res) => {
      try {
        const resultado = await pool.query(`
          SELECT
            id_usuario,
            nombre,
            usuario,
            rol,
            activo,
            revisado
          FROM instrumentos.usuarios
          ORDER BY revisado ASC, nombre ASC
        `);
  
        const pendientes = resultado.rows.filter(
          usuario => !usuario.revisado
        ).length;
  
        res.json({
          usuarios: resultado.rows,
          pendientes
        });
      } catch (error) {
        console.error('Error al listar usuarios:', error);
        res.status(500).json({
          message: 'No fue posible cargar los usuarios.'
        });
      }
    }
  );
  
  /* Activar o desactivar una cuenta y registrar su revisión */
  app.patch(
    '/api/admin/usuarios/:id_usuario/estado',
    requireRole('admin'),
    async (req, res) => {
      const { id_usuario } = req.params;
      const { activo } = req.body;
  
      if (typeof activo !== 'boolean') {
        return res.status(400).json({
          message: 'El estado activo debe ser verdadero o falso.'
        });
      }
  
      // Evitar que el administrador desactive su propia cuenta.
      if (
        Number(id_usuario) ===
        Number(req.session.usuario.id_usuario) &&
        activo === false
      ) {
        return res.status(400).json({
          message: 'No puedes desactivar tu propia cuenta.'
        });
      }
  
      try {
        const resultado = await pool.query(
          `UPDATE instrumentos.usuarios
           SET activo = $1,
               revisado = TRUE
           WHERE id_usuario = $2
           RETURNING
             id_usuario, nombre, usuario, rol, activo, revisado`,
          [activo, id_usuario]
        );
  
        if (resultado.rowCount === 0) {
          return res.status(404).json({
            message: 'Usuario no encontrado.'
          });
        }
  
        res.json({
          message: activo
            ? 'Usuario activado correctamente.'
            : 'Usuario desactivado correctamente.',
          usuario: resultado.rows[0]
        });
      } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({
          message: 'No fue posible actualizar el usuario.'
        });
      }
    }
  );

  /* Cambiar el rol de un usuario*/
  app.patch(
    '/api/admin/usuarios/:id_usuario/rol',
    requireRole('admin'),
    async (req, res) => {
      const { id_usuario } = req.params;
      const { rol } = req.body;
        console.log(rol)
      if (rol !== 'admin' && rol !== 'consulta' && rol !== 'editor') {
        return res.status(400).json({
          message: 'El rol no se encuentra validado.'
        });
      }
  
      // Evitar que el administrador desactive su propia cuenta.
      if (
        Number(id_usuario) ===
        Number(req.session.usuario.id_usuario) 
        && rol != 'admin'
      ) {
        return res.status(400).json({
          message: 'No puedes cambiar tu propia cuenta.'
        });
      }
  
      try {
        const resultado = await pool.query(
          `UPDATE instrumentos.usuarios
           SET rol = $1
           WHERE id_usuario = $2
           RETURNING
             id_usuario, nombre, usuario, rol, activo, revisado`,
          [rol, id_usuario]
        );
  
        if (resultado.rowCount === 0) {
          return res.status(404).json({
            message: 'Usuario no encontrado.'
          });
        }
        res.json({
          message: `Rol del usuario cambiado correctamente a ${rol}.`,
           
          usuario: resultado.rows[0]
        });
      } catch (error) {
        console.error('Error al actualizar rol de usuario:', error);
        res.status(500).json({
          message: 'No fue posible actualizar rol del usuario.'
        });
      }
    }
  );
  

// Iniciar el servidor y escuchar en el puerto definido
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
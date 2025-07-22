// Importar Express
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000; // Puerto en el que el servidor escuchará


app.use(cors()); // Permitir solicitudes desde el frontend en desarrollo
app.use(express.json()); // Parsear JSON en las solicitudes

// Configurar conexión de Postgre
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
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
app.delete('/api/instrumentos/delete/:id_instrumento', async (req, res)=>{
    const {id_instrumento} = req.params
    console.log("ID recibido para eliminación:", id_instrumento);

    try {
        const result = await pool.query('DELETE FROM instrumentos.instrumentos WHERE id_instrumento = $1 RETURNING *',
        [id_instrumento])

        console.log("Resultado de la eliminación:", result);
       if(result.rowCount === 0){
            return res.status(404).json({error:"Instrumento no encontrado"})
        }
        
        res.json(result.rows[0])

    } catch (error) {
        console.error("Error al eliminar el instrumento", error)
        res.status(500).json({error: "Error al eliminar el instruimento"})
    }


})


// Petición de marcas de instrumentos
app.get('/api/instrumentos/marca', async (req, res)=>{
    try {
        const result = await pool.query('SELECT id_marca, marca FROM instrumentos.marca');
        res.json(result.rows)
    } catch (err){
        console.log("Error a obtener la marca de instrumentos", err);
        res.status(500).json({error: "Error al obtener los datos"})
    }
})

// Petición de modelo de instrumentos según su marca
app.get('/api/instrumentos/modelo', async (req, res)=>{
    const {id_marca} = req.query
    try {
        const result = await pool.query('SELECT id_modelo, modelo FROM instrumentos.modelo WHERE id_marca=$1', [id_marca]);
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
app.get('/api/instrumentos', async (req, res) => {
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

// Ruta para realizar una petición de las epatas de un hito de calibración
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
        /*await pool.query(
            'INSERT INTO instrumentos.instrumentos(id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURING *',
            [id_tipo, id_materialidad, id_seccion_cargo, id_marca, id_modelo, id_estado_instru, rut_cargo, instrumento, aplica_verif, aplica_calib, cod_serviu, serial_equipo, ubicacion, obs_estado]
        )*/
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

// Iniciar el servidor y escuchar en el puerto definido
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
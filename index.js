// Importar Express
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000; // Puerto en el que el servidor escuchará


app.use(cors()); // Permitir solicitudes desde el frontend en desarrollo
app.use(express.json()); // Parsear JSON en las solicitudes

// COnfigurar conexión de Postgre
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

// Petición de modelo de instrumentos
app.get('/api/instrumentos/modelo', async (req, res)=>{
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

// Iniciar el servidor y escuchar en el puerto definido
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
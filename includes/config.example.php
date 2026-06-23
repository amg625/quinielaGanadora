<?php
/**
 * Configuración de conexión a la base de datos.
 * EDITA estos valores con los datos de tu base MySQL en Hostinger.
 * (hPanel → Bases de datos → MySQL → ahí ves host, nombre de BD, usuario y contraseña)
 */

define('DB_HOST', 'localhost');          // En Hostinger casi siempre es 'localhost'
define('DB_NAME', 'u912746025_MainData'); // Tu base de datos en Hostinger
define('DB_USER', 'TU_USUARIO_MYSQL');   // ej. u912746025_xxxx
define('DB_PASS', 'TU_CONTRASENA');    // tu contraseña de MySQL
define('DB_CHARSET', 'utf8mb4');

// Clave secreta para sesiones (cámbiala por cualquier texto aleatorio largo)
define('APP_SECRET', 'cambia-esto-por-algo-aleatorio-largo-2026');

// Zona horaria de la app
date_default_timezone_set('America/Mexico_City');

function db() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['ok' => false, 'error' => 'Error de conexión a la base de datos. Revisa config.php']));
        }
    }
    return $pdo;
}

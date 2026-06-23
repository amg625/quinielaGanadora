<?php
/**
 * INSTALADOR — ejecútalo UNA sola vez: tudominio.com/quiniela/api/install.php
 * Crea las tablas y carga los 104 partidos reales del Mundial 2026.
 * Cuando termine, BORRA este archivo del servidor por seguridad.
 */
require_once __DIR__ . '/../includes/config.php';

header('Content-Type: text/html; charset=utf-8');
echo "<pre style='font-family:monospace;background:#0b1020;color:#7CF;padding:20px;font-size:14px;line-height:1.6'>";

try {
    $pdo = db();

    // ---- usuarios: password_hash es OPCIONAL (NULL para jugadores normales) ----
    $pdo->exec("CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario VARCHAR(40) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NULL,
        is_admin TINYINT(1) DEFAULT 0,
        juega TINYINT(1) DEFAULT 1,
        creado DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo "✓ Tabla 'usuarios' lista\n";

    // ---- partidos: + columna desenlace para eliminatorias ----
    $pdo->exec("CREATE TABLE IF NOT EXISTS partidos (
        id INT PRIMARY KEY,
        etapa VARCHAR(20) NOT NULL,
        grupo VARCHAR(3) NULL,
        ronda VARCHAR(40) NULL,
        equipo_local VARCHAR(50), local_cod VARCHAR(8), local_flag VARCHAR(16),
        equipo_visita VARCHAR(50), visita_cod VARCHAR(8), visita_flag VARCHAR(16),
        fecha_cdmx DATETIME NOT NULL,
        ciudad VARCHAR(60), pais VARCHAR(30), estadio VARCHAR(80),
        goles_local INT NULL, goles_visita INT NULL,
        desenlace VARCHAR(12) NULL,
        estado VARCHAR(20) DEFAULT 'programado'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo "✓ Tabla 'partidos' lista\n";

    // ---- pronosticos: + columna desenlace (predicción del jugador) ----
    $pdo->exec("CREATE TABLE IF NOT EXISTS pronosticos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        partido_id INT NOT NULL,
        goles_local INT NOT NULL,
        goles_visita INT NOT NULL,
        desenlace VARCHAR(12) NULL,
        puntos INT DEFAULT 0,
        guardado DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq (usuario_id, partido_id),
        INDEX (partido_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo "✓ Tabla 'pronosticos' lista\n";

    $pdo->exec("CREATE TABLE IF NOT EXISTS quiniela_general (
        usuario_id INT PRIMARY KEY,
        pais_opcion1 VARCHAR(50),
        pais_opcion2 VARCHAR(50),
        puntos INT DEFAULT 0,
        guardado DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo "✓ Tabla 'quiniela_general' lista\n";

    $pdo->exec("CREATE TABLE IF NOT EXISTS config (
        clave VARCHAR(40) PRIMARY KEY,
        valor VARCHAR(120)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("INSERT IGNORE INTO config (clave, valor) VALUES ('campeon_real', '')");
    echo "✓ Tabla 'config' lista\n";

    // ---- Cargar los 104 partidos ----
    $json = file_get_contents(__DIR__ . '/../data/matches_seed.json');
    $matches = json_decode($json, true);
    $stmt = $pdo->prepare("INSERT INTO partidos
        (id, etapa, grupo, ronda, equipo_local, local_cod, local_flag,
         equipo_visita, visita_cod, visita_flag, fecha_cdmx, ciudad, pais, estadio,
         goles_local, goles_visita, estado)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
            equipo_local=VALUES(equipo_local), equipo_visita=VALUES(equipo_visita),
            fecha_cdmx=VALUES(fecha_cdmx), goles_local=VALUES(goles_local),
            goles_visita=VALUES(goles_visita), estado=VALUES(estado)");
    $n = 0;
    foreach ($matches as $m) {
        $stmt->execute([
            $m['id'], $m['etapa'], $m['grupo'], $m['ronda'],
            $m['equipo_local'], $m['local_cod'], $m['local_flag'],
            $m['equipo_visita'], $m['visita_cod'], $m['visita_flag'],
            $m['fecha_cdmx'], $m['ciudad'], $m['pais'], $m['estadio'],
            $m['goles_local'], $m['goles_visita'], $m['estado']
        ]);
        $n++;
    }
    echo "✓ {$n} partidos cargados (con datos reales y horarios CDMX)\n";

    // Recalcular puntos de partidos ya finalizados (por si hay pronósticos)
    echo "✓ Partidos ya jugados marcados como finalizados\n";

    // ---- Admin (usuario + contraseña). Memo NO juega (admin puro) ----
    $adminUser = 'admin';
    $adminPass = 'admin2026'; // ⚠ CÁMBIALA al entrar
    $hash = password_hash($adminPass, PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO usuarios (usuario, password_hash, is_admin, juega)
                   VALUES (?, ?, 1, 0)
                   ON DUPLICATE KEY UPDATE is_admin = 1, juega = 0, password_hash = VALUES(password_hash)")
        ->execute([$adminUser, $hash]);
    echo "✓ Admin creado → usuario: {$adminUser} / contraseña: {$adminPass} (NO participa en la quiniela)\n";

    echo "\n========================================\n";
    echo " ✅ INSTALACIÓN COMPLETA\n";
    echo " · Jugadores: entran solo con su nombre.\n";
    echo " · Admin: entra con 'admin' / 'admin2026' (cámbiala).\n";
    echo " · ⚠ BORRA este archivo (api/install.php) ahora.\n";
    echo "========================================\n";

} catch (Exception $e) {
    echo "✗ ERROR: " . $e->getMessage() . "\n";
}
echo "</pre>";

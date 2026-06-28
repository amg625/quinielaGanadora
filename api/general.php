<?php
/**
 * API de la Quiniela General (país campeón).
 * Acciones: get, save
 * Se puede editar siempre que NO haya iniciado el primer partido.
 */
require_once __DIR__ . '/../includes/functions.php';

$pdo = db();
$action = $_GET['action'] ?? '';

/* ¿Ya cerró la quiniela general?
   Cierra en una fecha fija. Para cambiarla, edita FECHA_CIERRE abajo. */
function general_cerrada($pdo) {
    // Fecha y hora límite para elegir campeones (hora CDMX).
    // Formato: 'AAAA-MM-DD HH:MM:SS'. Aquí: lunes 29 junio 2026 a las 23:59.
    $FECHA_CIERRE = '2026-06-29 23:59:59';
    return time() >= strtotime($FECHA_CIERRE);
}

switch ($action) {

    case 'get': {
        require_login();
        $u = current_user();
        $stmt = $pdo->prepare("SELECT pais_opcion1, pais_opcion2, puntos
                               FROM quiniela_general WHERE usuario_id = ?");
        $stmt->execute([$u['id']]);
        json_out([
            'ok' => true,
            'pick' => $stmt->fetch() ?: null,
            'cerrada' => general_cerrada($pdo)
        ]);
    }

    case 'save': {
        require_login();
        $u = current_user();
        if (general_cerrada($pdo)) {
            json_out(['ok' => false, 'error' => 'La quiniela general ya cerró (el Mundial inició).']);
        }
        $d = body();
        $o1 = sanitize($d['opcion1'] ?? '');
        $o2 = sanitize($d['opcion2'] ?? '');
        if (!$o1 || !$o2) json_out(['ok' => false, 'error' => 'Elige tus dos opciones de campeón.']);
        if ($o1 === $o2) json_out(['ok' => false, 'error' => 'La opción 1 y 2 deben ser países distintos.']);

        $pdo->prepare("INSERT INTO quiniela_general (usuario_id, pais_opcion1, pais_opcion2)
                       VALUES (?,?,?)
                       ON DUPLICATE KEY UPDATE pais_opcion1=VALUES(pais_opcion1),
                                               pais_opcion2=VALUES(pais_opcion2),
                                               guardado=NOW()")
            ->execute([$u['id'], $o1, $o2]);
        json_out(['ok' => true, 'msg' => '¡Quiniela general guardada! 🏆']);
    }

    /* Lista de países participantes (distintos, ordenados) */
    case 'paises': {
        $rows = $pdo->query("
            SELECT DISTINCT equipo_local AS pais, local_flag AS flag FROM partidos WHERE etapa='grupos'
            UNION
            SELECT DISTINCT equipo_visita, visita_flag FROM partidos WHERE etapa='grupos'
            ORDER BY pais")->fetchAll();
        json_out(['ok' => true, 'paises' => $rows]);
    }

    default:
        json_out(['ok' => false, 'error' => 'Acción no válida.'], 400);
}

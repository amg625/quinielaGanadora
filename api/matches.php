<?php
/**
 * Partidos y pronósticos.
 * Acciones: list, save_prediction, others
 */
require_once __DIR__ . '/../includes/functions.php';

$action = $_GET['action'] ?? '';
$pdo = db();

switch ($action) {

    case 'list': {
        $u = current_user();
        $partidos = $pdo->query("SELECT * FROM partidos ORDER BY fecha_cdmx, id")->fetchAll();

        $mis = [];
        if ($u) {
            $stmt = $pdo->prepare("SELECT partido_id, goles_local, goles_visita, desenlace, clasifica, puntos
                                   FROM pronosticos WHERE usuario_id = ?");
            $stmt->execute([$u['id']]);
            foreach ($stmt->fetchAll() as $p) $mis[$p['partido_id']] = $p;
        }

        $out = [];
        foreach ($partidos as $p) {
            $pid = (int)$p['id'];
            $out[] = [
                'id' => $pid, 'etapa' => $p['etapa'], 'grupo' => $p['grupo'], 'ronda' => $p['ronda'],
                'local' => $p['equipo_local'], 'local_flag' => $p['local_flag'],
                'visita' => $p['equipo_visita'], 'visita_flag' => $p['visita_flag'],
                'fecha_cdmx' => $p['fecha_cdmx'],
                'ciudad' => $p['ciudad'], 'pais' => $p['pais'], 'estadio' => $p['estadio'],
                'goles_local' => $p['goles_local'] !== null ? (int)$p['goles_local'] : null,
                'goles_visita' => $p['goles_visita'] !== null ? (int)$p['goles_visita'] : null,
                'desenlace' => $p['desenlace'],
                'clasifica' => $p['clasifica'] ?? null,
                'estado' => $p['estado'],
                'bloqueado' => partido_bloqueado($p['fecha_cdmx'], $p['estado']),
                'mi_pred' => $mis[$pid] ?? null,
            ];
        }
        json_out(['ok' => true, 'partidos' => $out]);
    }

    case 'save_prediction': {
        require_login();
        $u = current_user();
        if (empty($u['juega'])) json_out(['ok' => false, 'error' => 'El administrador no participa en la quiniela.']);

        $d = body();
        $pid = (int)($d['partido_id'] ?? 0);
        $gl = $d['goles_local'] ?? null;
        $gv = $d['goles_visita'] ?? null;
        $desenlace = $d['desenlace'] ?? null; // solo eliminatorias
        $clasifica = $d['clasifica'] ?? null; // solo eliminatorias

        if ($gl === null || $gv === null || !is_numeric($gl) || !is_numeric($gv) || $gl < 0 || $gv < 0) {
            json_out(['ok' => false, 'error' => 'Ingresa un marcador válido para ambos equipos.']);
        }

        $stmt = $pdo->prepare("SELECT * FROM partidos WHERE id = ?");
        $stmt->execute([$pid]);
        $p = $stmt->fetch();
        if (!$p) json_out(['ok' => false, 'error' => 'Partido no encontrado.']);

        if (partido_bloqueado($p['fecha_cdmx'], $p['estado'])) {
            json_out(['ok' => false, 'error' => '⏱ Este partido ya está cerrado (falta menos de 1 hora o ya inició).']);
        }
        if ($p['etapa'] === 'eliminatorias' && $p['estado'] === 'pendiente') {
            json_out(['ok' => false, 'error' => 'Este partido aún no está disponible. Se abrirá cuando se definan los cruces.']);
        }

        // En eliminatorias: exigir desenlace y quién clasifica
        if ($p['etapa'] === 'eliminatorias') {
            $validos = ['regular','prorroga','penales'];
            if (!$desenlace || !in_array($desenlace, $validos)) {
                json_out(['ok' => false, 'error' => 'Elige cómo termina el partido: 90 min, prórroga o penales.']);
            }
            // clasifica debe ser uno de los dos equipos
            if (!$clasifica || !in_array($clasifica, [$p['equipo_local'], $p['equipo_visita']])) {
                json_out(['ok' => false, 'error' => 'Elige qué equipo clasifica. ✅']);
            }
        } else {
            $desenlace = null;
            $clasifica = null;
        }

        $pdo->prepare("INSERT INTO pronosticos (usuario_id, partido_id, goles_local, goles_visita, desenlace, clasifica)
                       VALUES (?,?,?,?,?,?)
                       ON DUPLICATE KEY UPDATE goles_local=VALUES(goles_local),
                                               goles_visita=VALUES(goles_visita),
                                               desenlace=VALUES(desenlace),
                                               clasifica=VALUES(clasifica), guardado=NOW()")
            ->execute([$u['id'], $pid, (int)$gl, (int)$gv, $desenlace, $clasifica]);

        json_out(['ok' => true]);
    }

    case 'others': {
        require_login();
        $u = current_user();
        $pid = (int)($_GET['partido_id'] ?? 0);

        // Datos del partido (para saber etapa y si ya empezó)
        $pstmt = $pdo->prepare("SELECT etapa, fecha_cdmx, estado FROM partidos WHERE id = ?");
        $pstmt->execute([$pid]);
        $partido = $pstmt->fetch();
        if (!$partido) json_out(['ok' => false, 'error' => 'Partido no encontrado.']);

        // El admin puede ver siempre; el jugador, solo tras guardar su pronóstico
        if (empty($u['is_admin'])) {
            $chk = $pdo->prepare("SELECT id FROM pronosticos WHERE usuario_id = ? AND partido_id = ?");
            $chk->execute([$u['id'], $pid]);
            if (!$chk->fetch()) {
                json_out(['ok' => false, 'error' => 'Primero guarda tu pronóstico para ver el de los demás. 🔒'], 403);
            }
        }

        // ¿El partido ya empezó? (la hora de inicio ya pasó, o está finalizado/en juego)
        $ya_empezo = (time() >= strtotime($partido['fecha_cdmx']))
                     || in_array($partido['estado'], ['finalizado', 'en_juego']);

        // En ELIMINATORIAS: si NO ha empezado, ocultar los marcadores (solo "ya pronosticó")
        $ocultar = ($partido['etapa'] === 'eliminatorias' && !$ya_empezo && empty($u['is_admin']));

        $stmt = $pdo->prepare("
            SELECT us.usuario, pr.goles_local, pr.goles_visita, pr.desenlace, pr.clasifica, pr.puntos
            FROM pronosticos pr JOIN usuarios us ON us.id = pr.usuario_id
            WHERE pr.partido_id = ? ORDER BY us.usuario");
        $stmt->execute([$pid]);
        $rows = $stmt->fetchAll();

        if ($ocultar) {
            // Devolver solo el nombre y "ya pronosticó", sin marcadores
            $oculto = array_map(fn($r) => ['usuario' => $r['usuario'], 'oculto' => true], $rows);
            json_out(['ok' => true, 'pronosticos' => $oculto, 'oculto' => true]);
        }

        json_out(['ok' => true, 'pronosticos' => $rows, 'oculto' => false]);
    }

    default:
        json_out(['ok' => false, 'error' => 'Acción no válida.'], 400);
}

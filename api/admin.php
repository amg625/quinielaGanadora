<?php
/**
 * Administración (solo admin).
 * Acciones: set_result, edit_match, set_elim_teams, set_champion, list_users, make_admin
 */
require_once __DIR__ . '/../includes/functions.php';
require_admin();

$action = $_GET['action'] ?? '';
$pdo = db();

function recalcular_partido($pdo, $pid) {
    $stmt = $pdo->prepare("SELECT * FROM partidos WHERE id = ?");
    $stmt->execute([$pid]);
    $p = $stmt->fetch();
    if (!$p) return;

    $preds = $pdo->prepare("SELECT * FROM pronosticos WHERE partido_id = ?");
    $preds->execute([$pid]);
    $upd = $pdo->prepare("UPDATE pronosticos SET puntos = ? WHERE id = ?");

    foreach ($preds->fetchAll() as $pr) {
        $pts = calcular_puntos(
            $p['etapa'],
            (int)$pr['goles_local'], (int)$pr['goles_visita'],
            $p['goles_local'] !== null ? (int)$p['goles_local'] : null,
            $p['goles_visita'] !== null ? (int)$p['goles_visita'] : null,
            $pr['desenlace'] ?? null,
            $p['desenlace'] ?? null,
            $pr['clasifica'] ?? null,
            $p['clasifica'] ?? null
        );
        $upd->execute([$pts, $pr['id']]);
    }
}

switch ($action) {

    case 'set_result': {
        $d = body();
        $pid = (int)($d['partido_id'] ?? 0);
        $gl = $d['goles_local'] ?? null;
        $gv = $d['goles_visita'] ?? null;
        $desenlace = $d['desenlace'] ?? null;
        $clasifica = $d['clasifica'] ?? null;

        if (!is_numeric($gl) || !is_numeric($gv) || $gl < 0 || $gv < 0) {
            json_out(['ok' => false, 'error' => 'Marcador inválido.']);
        }

        $stmt = $pdo->prepare("SELECT etapa, equipo_local, equipo_visita FROM partidos WHERE id = ?");
        $stmt->execute([$pid]);
        $row = $stmt->fetch();

        if ($row && $row['etapa'] === 'eliminatorias') {
            $validos = ['regular','prorroga','penales'];
            if (!$desenlace || !in_array($desenlace, $validos)) {
                json_out(['ok' => false, 'error' => 'Indica cómo terminó: 90 min, prórroga o penales.']);
            }
            if (!$clasifica || !in_array($clasifica, [$row['equipo_local'], $row['equipo_visita']])) {
                json_out(['ok' => false, 'error' => 'Indica qué equipo clasificó.']);
            }
        } else {
            $desenlace = null;
            $clasifica = null;
        }

        $pdo->prepare("UPDATE partidos
                       SET goles_local=?, goles_visita=?, desenlace=?, clasifica=?, estado='finalizado'
                       WHERE id = ?")
            ->execute([(int)$gl, (int)$gv, $desenlace, $clasifica, $pid]);

        recalcular_partido($pdo, $pid);
        json_out(['ok' => true, 'msg' => 'Resultado guardado y puntos recalculados ✅']);
    }

    case 'edit_match': {
        $d = body();
        $pid = (int)($d['partido_id'] ?? 0);
        $campos = []; $vals = [];
        foreach (['equipo_local','local_flag','local_cod','equipo_visita','visita_flag','visita_cod',
                  'fecha_cdmx','ciudad','pais','estadio','estado','ronda'] as $c) {
            if (isset($d[$c])) { $campos[] = "$c = ?"; $vals[] = sanitize($d[$c]); }
        }
        if (!$campos) json_out(['ok' => false, 'error' => 'Nada que actualizar.']);
        $vals[] = $pid;
        $pdo->prepare("UPDATE partidos SET " . implode(', ', $campos) . " WHERE id = ?")->execute($vals);
        json_out(['ok' => true, 'msg' => 'Partido actualizado ✅']);
    }

    case 'set_elim_teams': {
        $d = body();
        $pid = (int)($d['partido_id'] ?? 0);
        $pdo->prepare("UPDATE partidos SET
                        equipo_local=?, local_flag=?, local_cod=?,
                        equipo_visita=?, visita_flag=?, visita_cod=?, estado='programado'
                       WHERE id = ?")
            ->execute([
                sanitize($d['equipo_local'] ?? ''), sanitize($d['local_flag'] ?? 'tbd'), sanitize($d['local_flag'] ?? 'tbd'),
                sanitize($d['equipo_visita'] ?? ''), sanitize($d['visita_flag'] ?? 'tbd'), sanitize($d['visita_flag'] ?? 'tbd'),
                $pid
            ]);
        json_out(['ok' => true, 'msg' => 'Cruce definido y abierto para pronósticos ✅']);
    }

    case 'set_champion': {
        $d = body();
        $campeon = sanitize($d['campeon'] ?? '');
        $pdo->prepare("UPDATE config SET valor = ? WHERE clave = 'campeon_real'")->execute([$campeon]);
        $rows = $pdo->query("SELECT usuario_id, pais_opcion1, pais_opcion2 FROM quiniela_general")->fetchAll();
        $upd = $pdo->prepare("UPDATE quiniela_general SET puntos = ? WHERE usuario_id = ?");
        foreach ($rows as $r) {
            $pts = 0;
            if ($r['pais_opcion1'] === $campeon) $pts = PTS_CAMPEON_OPC1;
            elseif ($r['pais_opcion2'] === $campeon) $pts = PTS_CAMPEON_OPC2;
            $upd->execute([$pts, $r['usuario_id']]);
        }
        json_out(['ok' => true, 'msg' => "Campeón: {$campeon}. Quiniela general recalculada ✅"]);
    }

    case 'list_users': {
        $rows = $pdo->query("SELECT id, usuario, is_admin, juega, creado FROM usuarios ORDER BY usuario")->fetchAll();
        json_out(['ok' => true, 'users' => $rows]);
    }

    case 'make_admin': {
        $d = body();
        $uid = (int)($d['usuario_id'] ?? 0);
        $val = !empty($d['is_admin']) ? 1 : 0;
        $pdo->prepare("UPDATE usuarios SET is_admin = ? WHERE id = ?")->execute([$val, $uid]);
        json_out(['ok' => true, 'msg' => 'Permisos actualizados ✅']);
    }

    default:
        json_out(['ok' => false, 'error' => 'Acción no válida.'], 400);
}

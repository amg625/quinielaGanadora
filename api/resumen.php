<?php
/**
 * Resumen de puntos de un jugador.
 * Devuelve: total, # aciertos exactos, y desglose de partidos donde sumó puntos.
 * Uso: resumen.php?usuario=NombreDelJugador
 */
require_once __DIR__ . '/../includes/functions.php';
require_login();

$pdo = db();
$usuario = sanitize($_GET['usuario'] ?? '');
if (!$usuario) json_out(['ok' => false, 'error' => 'Falta el usuario.']);

// Buscar al jugador
$stmt = $pdo->prepare("SELECT id, usuario FROM usuarios WHERE usuario = ? AND juega = 1");
$stmt->execute([$usuario]);
$u = $stmt->fetch();
if (!$u) json_out(['ok' => false, 'error' => 'Jugador no encontrado.']);

// Partidos donde sumó puntos (puntos > 0), con datos del partido
$stmt = $pdo->prepare("
    SELECT pa.equipo_local, pa.equipo_visita, pa.etapa, pa.grupo, pa.ronda,
           pa.goles_local AS real_l, pa.goles_visita AS real_v,
           pr.goles_local AS pred_l, pr.goles_visita AS pred_v,
           pr.desenlace, pr.puntos, pa.fecha_cdmx
    FROM pronosticos pr
    JOIN partidos pa ON pa.id = pr.partido_id
    WHERE pr.usuario_id = ? AND pr.puntos > 0
    ORDER BY pa.fecha_cdmx");
$stmt->execute([$u['id']]);
$partidos = $stmt->fetchAll();

// Calcular total y aciertos exactos
$total = 0;
$exactos = 0;
$detalle = [];
foreach ($partidos as $p) {
    $total += (int)$p['puntos'];
    $exacto = ((int)$p['pred_l'] === (int)$p['real_l'] && (int)$p['pred_v'] === (int)$p['real_v']);
    if ($exacto) $exactos++;
    $detalle[] = [
        'local' => $p['equipo_local'],
        'visita' => $p['equipo_visita'],
        'etapa' => $p['etapa'],
        'fase' => $p['etapa'] === 'eliminatorias' ? $p['ronda'] : 'Grupo ' . $p['grupo'],
        'real_l' => (int)$p['real_l'], 'real_v' => (int)$p['real_v'],
        'pred_l' => (int)$p['pred_l'], 'pred_v' => (int)$p['pred_v'],
        'puntos' => (int)$p['puntos'],
        'exacto' => $exacto,
    ];
}

// Sumar puntos de quiniela general (campeón) si tiene
$g = $pdo->prepare("SELECT pais_opcion1, puntos FROM quiniela_general WHERE usuario_id = ?");
$g->execute([$u['id']]);
$gen = $g->fetch();
$pts_general = $gen ? (int)$gen['puntos'] : 0;
$total += $pts_general;

json_out([
    'ok' => true,
    'usuario' => $u['usuario'],
    'total' => $total,
    'exactos' => $exactos,
    'aciertos' => count($detalle),
    'pts_general' => $pts_general,
    'campeon_pick' => $gen ? $gen['pais_opcion1'] : null,
    'partidos' => $detalle,
]);

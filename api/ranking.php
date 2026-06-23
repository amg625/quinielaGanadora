<?php
/**
 * Ranking. Excluye usuarios que no juegan (admin).
 * Acciones: ranking (etapa = todos | grupos | eliminatorias | general)
 */
require_once __DIR__ . '/../includes/functions.php';

$pdo = db();
$etapa = $_GET['etapa'] ?? 'todos';

switch ($etapa) {

    case 'grupos':
    case 'eliminatorias': {
        $stmt = $pdo->prepare("
            SELECT us.usuario,
                   COALESCE(SUM(pr.puntos),0) AS puntos,
                   COUNT(pr.id) AS jugados
            FROM usuarios us
            LEFT JOIN pronosticos pr ON pr.usuario_id = us.id
            LEFT JOIN partidos pa ON pa.id = pr.partido_id AND pa.etapa = ?
            WHERE us.juega = 1
            GROUP BY us.id
            ORDER BY puntos DESC, us.usuario ASC");
        $stmt->execute([$etapa]);
        json_out(['ok' => true, 'etapa' => $etapa, 'ranking' => $stmt->fetchAll()]);
    }

    case 'general': {
        $stmt = $pdo->query("
            SELECT us.usuario, qg.pais_opcion1, qg.pais_opcion2, COALESCE(qg.puntos,0) AS puntos
            FROM usuarios us
            LEFT JOIN quiniela_general qg ON qg.usuario_id = us.id
            WHERE us.juega = 1
            ORDER BY puntos DESC, us.usuario ASC");
        json_out(['ok' => true, 'etapa' => 'general', 'ranking' => $stmt->fetchAll()]);
    }

    case 'todos':
    default: {
        $stmt = $pdo->query("
            SELECT us.usuario,
                   COALESCE((SELECT SUM(puntos) FROM pronosticos WHERE usuario_id = us.id),0) AS pts_partidos,
                   COALESCE((SELECT puntos FROM quiniela_general WHERE usuario_id = us.id),0) AS pts_general,
                   COALESCE((SELECT COUNT(*) FROM pronosticos WHERE usuario_id = us.id),0) AS jugados
            FROM usuarios us
            WHERE us.juega = 1
            ORDER BY (pts_partidos + pts_general) DESC, us.usuario ASC");
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) $r['puntos'] = (int)$r['pts_partidos'] + (int)$r['pts_general'];
        json_out(['ok' => true, 'etapa' => 'todos', 'ranking' => $rows]);
    }
}

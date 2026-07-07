<?php
/**
 * Ranking. Excluye usuarios que no juegan (admin).
 * Acciones: ranking (etapa = todos | grupos | eliminatorias | general)
 */
require_once __DIR__ . '/../includes/functions.php';

$pdo = db();
$etapa = $_GET['etapa'] ?? 'todos';

/* Estado del torneo + ganador + posición del usuario actual.
   Se usa para la animación de fin de torneo. */
if ($etapa === 'fin_torneo') {
    // El torneo terminó cuando el partido de la Final está finalizado
    $final = $pdo->query("SELECT estado FROM partidos WHERE ronda = 'Final' LIMIT 1")->fetch();
    $termino = ($final && $final['estado'] === 'finalizado');

    if (!$termino) {
        json_out(['ok' => true, 'termino' => false]);
    }

    // Ranking final completo (mismo cálculo que 'todos')
    $rows = $pdo->query("
        SELECT us.usuario,
               COALESCE((SELECT SUM(puntos) FROM pronosticos WHERE usuario_id = us.id),0) AS pts_partidos,
               COALESCE((SELECT puntos FROM quiniela_general WHERE usuario_id = us.id),0) AS pts_general
        FROM usuarios us
        WHERE us.juega = 1
        ORDER BY (pts_partidos + pts_general) DESC, us.usuario ASC")->fetchAll();

    $lista = [];
    $pos = 0;
    foreach ($rows as $r) {
        $pos++;
        $lista[] = [
            'usuario' => $r['usuario'],
            'puntos' => (int)$r['pts_partidos'] + (int)$r['pts_general'],
            'pos' => $pos,
        ];
    }

    $ganador = $lista[0]['usuario'] ?? null;

    // Posición del usuario actual (si está logueado y juega)
    $mi_pos = null; $mis_pts = null;
    $u = current_user();
    if ($u) {
        foreach ($lista as $item) {
            if ($item['usuario'] === $u['usuario']) {
                $mi_pos = $item['pos'];
                $mis_pts = $item['puntos'];
                break;
            }
        }
    }

    json_out([
        'ok' => true,
        'termino' => true,
        'ganador' => $ganador,
        'total_jugadores' => count($lista),
        'mi_pos' => $mi_pos,
        'mis_pts' => $mis_pts,
    ]);
}

/* Menciones honoríficas (se muestran al terminar el torneo).
   Todo se calcula con datos ya existentes: pronósticos, resultados y puntos. */
if ($etapa === 'menciones') {
    $sql = "SELECT us.usuario, pr.puntos, pr.goles_local AS pl, pr.goles_visita AS pv,
                   pa.goles_local AS rl, pa.goles_visita AS rv, pa.fecha_cdmx, pa.estado
            FROM pronosticos pr
            JOIN usuarios us ON us.id = pr.usuario_id
            JOIN partidos pa ON pa.id = pr.partido_id
            WHERE us.juega = 1
            ORDER BY us.usuario, pa.fecha_cdmx, pa.id";
    $rows = $pdo->query($sql)->fetchAll();

    $j = [];
    foreach ($rows as $r) {
        $u = $r['usuario'];
        if (!isset($j[$u])) $j[$u] = ['exactos'=>0,'aciertos'=>0,'mejor'=>0,'racha'=>0,'racha_max'=>0,'jugados'=>0];
        if ($r['estado'] !== 'finalizado' || $r['rl'] === null) continue;

        $j[$u]['jugados']++;
        $exacto = ((int)$r['pl'] === (int)$r['rl'] && (int)$r['pv'] === (int)$r['rv']);
        $signo = fn($a,$b) => $a > $b ? 1 : ($a < $b ? -1 : 0);
        $acierto_res = $signo($r['pl'],$r['pv']) === $signo($r['rl'],$r['rv']);

        if ($exacto) $j[$u]['exactos']++;
        if ($acierto_res) $j[$u]['aciertos']++;
        if ((int)$r['puntos'] > $j[$u]['mejor']) $j[$u]['mejor'] = (int)$r['puntos'];

        if ($exacto) {
            $j[$u]['racha']++;
            if ($j[$u]['racha'] > $j[$u]['racha_max']) $j[$u]['racha_max'] = $j[$u]['racha'];
        } else {
            $j[$u]['racha'] = 0;
        }
    }

    $lideres = function($campo, $min = 1) use ($j) {
        $best = null; $ganadores = [];
        foreach ($j as $u => $d) {
            $v = $d[$campo];
            if ($v < $min) continue;
            if ($best === null || $v > $best) { $best = $v; $ganadores = [$u]; }
            elseif ($v === $best) { $ganadores[] = $u; }
        }
        return ['valor' => $best, 'jugadores' => $ganadores];
    };

    $campeon = $pdo->query("SELECT valor FROM config WHERE clave='campeon_real'")->fetch();
    $campeon = $campeon ? $campeon['valor'] : '';
    $videntes = [];
    if ($campeon) {
        $stmt = $pdo->prepare("SELECT us.usuario FROM quiniela_general qg
                               JOIN usuarios us ON us.id = qg.usuario_id
                               WHERE us.juega = 1 AND qg.pais_opcion1 = ?");
        $stmt->execute([$campeon]);
        $videntes = array_column($stmt->fetchAll(), 'usuario');
    }

    $peor = null; $peores = [];
    foreach ($j as $u => $d) {
        if ($d['jugados'] < 1) continue;
        if ($peor === null || $d['aciertos'] < $peor) { $peor = $d['aciertos']; $peores = [$u]; }
        elseif ($d['aciertos'] === $peor) { $peores[] = $u; }
    }

    json_out([
        'ok' => true,
        'menciones' => [
            'nostradamus' => $lideres('exactos'),
            'certero'     => $lideres('aciertos'),
            'palo'        => $lideres('mejor'),
            'racha'       => $lideres('racha_max', 2),
            'optimista'   => ['valor' => $peor, 'jugadores' => $peores],
            'vidente'     => ['valor' => $campeon, 'jugadores' => $videntes],
        ],
    ]);
}

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

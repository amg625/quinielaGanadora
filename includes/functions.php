<?php
/**
 * Funciones compartidas por toda la app.
 */
require_once __DIR__ . '/config.php';

session_start();

/* ---------- Respuestas JSON ---------- */
function json_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function body() {
    $raw = file_get_contents('php://input');
    $j = json_decode($raw, true);
    return is_array($j) ? $j : [];
}

/* ---------- Sesión ---------- */
function current_user() {
    return $_SESSION['user'] ?? null;
}

function require_login() {
    if (!current_user()) {
        json_out(['ok' => false, 'error' => 'Debes iniciar sesión.'], 401);
    }
}

function require_admin() {
    $u = current_user();
    if (!$u || empty($u['is_admin'])) {
        json_out(['ok' => false, 'error' => 'Solo el administrador puede hacer esto.'], 403);
    }
}

/* ---------- Reglas de puntos ----------
   FASE DE GRUPOS (sin cambios):
     - Acertar resultado (1/X/2) ............ 3 pts
     - Acertar marcador exacto (incluye lo anterior) ... 5 pts (3+2)
   ELIMINATORIAS (esquema 3+3+3, máx 9):
     - Acertar el resultado de los 90' (gana/empata/pierde) ... 3 pts
     - Acertar el marcador exacto de los 90' ................... 3 pts
     - Acertar cómo termina (90 min / prórroga / penales) ...... 3 pts
*/
function calcular_puntos($etapa, $pred_l, $pred_v, $real_l, $real_v,
                         $pred_desenlace = null, $real_desenlace = null) {
    if ($real_l === null || $real_v === null) return 0;

    $signo = fn($a, $b) => $a > $b ? 1 : ($a < $b ? -1 : 0);
    $acierta_resultado = $signo($pred_l, $pred_v) === $signo($real_l, $real_v);
    $acierta_exacto    = ((int)$pred_l === (int)$real_l && (int)$pred_v === (int)$real_v);

    $pts = 0;
    if ($etapa === 'eliminatorias') {
        if ($acierta_resultado) $pts += 3;   // acierta quién gana/empata a los 90'
        if ($acierta_exacto)    $pts += 3;   // marcador exacto de los 90'
        if ($pred_desenlace && $real_desenlace && $pred_desenlace === $real_desenlace) {
            $pts += 3;                        // cómo termina: 90min / prórroga / penales
        }
    } else {
        if ($acierta_resultado) $pts += 3;
        if ($acierta_exacto)    $pts += 2;   // 3+2 = 5
    }
    return $pts;
}

// Puntos de la quiniela general (país campeón)
const PTS_CAMPEON_OPC1 = 15;
const PTS_CAMPEON_OPC2 = 8;

/* ---------- Bloqueo de partidos ---------- */
// Un partido se bloquea 1 hora antes de iniciar.
function partido_bloqueado($fecha_cdmx, $estado) {
    if ($estado === 'finalizado' || $estado === 'en_juego') return true;
    $inicio  = strtotime($fecha_cdmx);
    $limite  = $inicio - 60 * 60; // 1 hora antes
    return time() >= $limite;
}

function sanitize($s) {
    return htmlspecialchars(trim($s ?? ''), ENT_QUOTES, 'UTF-8');
}

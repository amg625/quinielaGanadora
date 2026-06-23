<?php
/**
 * Autenticación.
 * - Jugadores: entran SOLO con su nombre. La 1ª vez se "reserva" el nombre.
 *   Si el nombre ya existe y NO tiene contraseña, entra directo (es suyo).
 * - Admin: el usuario marcado is_admin tiene contraseña; debe ingresarla.
 * Acciones: login, logout, me, admin_login, change_password
 */
require_once __DIR__ . '/../includes/functions.php';

$action = $_GET['action'] ?? '';
$pdo = db();

function set_persistent_session() {
    // Cookie de sesión de larga duración (2 meses) para que persista al cerrar el navegador
    $params = session_get_cookie_params();
    setcookie(session_name(), session_id(), [
        'expires'  => time() + 60 * 60 * 24 * 62, // 62 días
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

switch ($action) {

    /* Login de JUGADOR: solo nombre. Crea la cuenta si no existe. */
    case 'login': {
        $d = body();
        $usuario = sanitize($d['usuario'] ?? '');
        if (mb_strlen($usuario) < 2 || mb_strlen($usuario) > 40) {
            json_out(['ok' => false, 'error' => 'Tu nombre debe tener entre 2 y 40 caracteres.']);
        }

        $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE usuario = ?");
        $stmt->execute([$usuario]);
        $u = $stmt->fetch();

        if ($u) {
            // Si la cuenta tiene contraseña (es admin), no se entra por aquí
            if (!empty($u['password_hash'])) {
                json_out(['ok' => false, 'error' => 'Ese nombre está reservado para el administrador. Usa el acceso de admin o elige otro nombre.', 'need_admin' => true]);
            }
            // Nombre ya existe y es de jugador → entra (es su cuenta)
        } else {
            // Crear cuenta de jugador nueva (sin contraseña)
            $pdo->prepare("INSERT INTO usuarios (usuario, password_hash, is_admin, juega) VALUES (?, NULL, 0, 1)")
                ->execute([$usuario]);
            $stmt->execute([$usuario]);
            $u = $stmt->fetch();
        }

        $_SESSION['user'] = ['id' => (int)$u['id'], 'usuario' => $u['usuario'],
                             'is_admin' => (int)$u['is_admin'], 'juega' => (int)$u['juega']];
        set_persistent_session();
        json_out(['ok' => true, 'user' => $_SESSION['user']]);
    }

    /* Login de ADMIN: usuario + contraseña */
    case 'admin_login': {
        $d = body();
        $usuario = sanitize($d['usuario'] ?? '');
        $pass    = $d['password'] ?? '';

        $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE usuario = ? AND is_admin = 1");
        $stmt->execute([$usuario]);
        $u = $stmt->fetch();

        if (!$u || empty($u['password_hash']) || !password_verify($pass, $u['password_hash'])) {
            json_out(['ok' => false, 'error' => 'Usuario o contraseña de admin incorrectos.'], 401);
        }

        $_SESSION['user'] = ['id' => (int)$u['id'], 'usuario' => $u['usuario'],
                             'is_admin' => 1, 'juega' => (int)$u['juega']];
        set_persistent_session();
        json_out(['ok' => true, 'user' => $_SESSION['user']]);
    }

    case 'logout':
        $_SESSION = [];
        session_destroy();
        setcookie(session_name(), '', time() - 3600, '/');
        json_out(['ok' => true]);

    case 'me':
        json_out(['ok' => true, 'user' => current_user()]);

    case 'change_password': {
        require_admin();
        $d = body();
        $nueva = $d['password'] ?? '';
        if (strlen($nueva) < 4) json_out(['ok' => false, 'error' => 'Mínimo 4 caracteres.']);
        $hash = password_hash($nueva, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?")
            ->execute([$hash, current_user()['id']]);
        json_out(['ok' => true, 'msg' => 'Contraseña actualizada ✅']);
    }

    default:
        json_out(['ok' => false, 'error' => 'Acción no válida.'], 400);
}

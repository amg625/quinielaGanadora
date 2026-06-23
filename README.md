# ⚽ Quiniela Mundial 2026

Quiniela web para jugar con tus amigos durante todo el Mundial 2026. Pronostica marcadores, compite en el ranking y elige al campeón. Backend en PHP + MySQL para que **todos los jugadores compartan datos** (ranking común, ver pronósticos de otros, admin que sube resultados).

---

## 📁 Estructura del proyecto

```
quiniela/
├── index.html              # Página principal (SPA)
├── .htaccess               # Seguridad y caché
├── css/styles.css          # Diseño completo (responsivo)
├── js/
│   ├── api.js              # Comunicación con el backend
│   ├── ui.js              # Helpers (toast, modal, fechas, banderas)
│   └── app.js             # Lógica principal
├── api/
│   ├── install.php        # ⚠ Instalador (ejecutar UNA vez, luego BORRAR)
│   ├── auth.php           # Login jugador (solo nombre) + admin (con clave)
│   ├── matches.php        # Partidos y pronósticos
│   ├── ranking.php        # Ranking por etapa
│   ├── general.php        # Quiniela general (campeón)
│   └── admin.php          # Panel admin
├── includes/
│   ├── config.php         # ⚙ TUS credenciales (NO se sube a GitHub)
│   ├── config.example.php # Plantilla (sí se sube)
│   └── functions.php      # Reglas de puntos, bloqueos, sesión
└── data/matches_seed.json # Los 104 partidos reales del Mundial 2026
```

---

## 🚀 Instalación en Hostinger

### 1. Base de datos
Ya tienes `u912746025_MainData`. En hPanel → Bases de datos → MySQL, anota el **usuario** y **contraseña** de esa base.

### 2. Configurar credenciales
Edita `includes/config.php`:
```php
define('DB_NAME', 'u912746025_MainData');   // ya está puesto
define('DB_USER', 'tu_usuario_mysql');       // ej. u912746025_xxxx
define('DB_PASS', 'tu_contraseña_mysql');
```

### 3. Subir archivos
Súbelo a `public_html/quiniela/`. Entras desde **guillermoworks.com/quiniela**.
> Verifica que `index.html` esté DIRECTO dentro de `quiniela/`, no anidado en otra carpeta.

### 4. Ejecutar el instalador (una vez)
Abre: `https://guillermoworks.com/quiniela/api/install.php`
Crea las tablas + carga los 104 partidos + crea el admin.

### 5. 🔒 BORRA el instalador
Borra `api/install.php` del servidor por seguridad.

---

## 👥 Cómo se entra

**Jugadores (tus amigos):** solo escriben su **nombre**. La 1ª vez crean su quiniela; después entran con el mismo nombre y retoman. La sesión queda guardada ~2 meses aunque cierren el navegador.

**Tú (admin):** en el login toca "🔐 Soy el administrador" y entra con:
- Usuario: **`admin`**
- Contraseña: **`admin2026`** ← cámbiala al entrar (Admin no participa en la quiniela)

> Si quieres jugar TÚ también, entra aparte como jugador normal con tu nombre (ej. "Memo").

---

## ⚙ Administración durante el Mundial

**Subir resultados:** Admin → "Subir resultados" → marcador → en eliminatorias elige también el desenlace (90 min / prórroga / penales) → Guardar. Los puntos se recalculan solos.

**Abrir cruces de eliminatorias:** cuando terminen los grupos, Admin → "Definir cruces" → elige los equipos reales de cada llave **desde la lista desplegable** (la bandera se asigna sola) → "Definir y abrir cruce".

**Coronar campeón:** al terminar la final, Admin → "Campeón" → elige país → recalcula la quiniela general.

---

## 📊 Sistema de puntos

**Fase de grupos:**
| Acierto | Puntos |
|---|---|
| Resultado (gana/empata/pierde) | 3 |
| Marcador exacto | 5 |

**Eliminatorias (valen más):**
| Acierto | Puntos |
|---|---|
| Resultado / quién avanza | 6 |
| Marcador exacto | 10 |
| Bonus: cómo se define (90min/prórroga/penales) | +3 |

**Quiniela general (campeón):** opción 1 = 15 pts · opción 2 = 8 pts.

---

## 🐙 Subir a GitHub

```bash
cd quiniela
git init
git add .
git commit -m "Quiniela Mundial 2026"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/quiniela-mundial-2026.git
git push -u origin main
```
> `includes/config.php` está en `.gitignore` → tus credenciales NO se suben.

---

## 🏆 Dos etapas, dos ganadores
- **1er ganador:** fase de grupos (72 partidos).
- **2º ganador:** eliminatorias (32 partidos, desde dieciseisavos).
- **Campeón general:** se revela al final.

## 🔧 Notas
- Horarios en **CDMX** (el servidor usa `America/Mexico_City`).
- Cada partido se cierra **30 min antes** de iniciar.
- Solo ves pronósticos ajenos tras guardar el tuyo.
- Datos reales verificados con fuentes FIFA/ESPN/UEFA (jun 2026).
- Los 5 partidos ya jugados al momento de armar esto están cargados con su resultado real y cerrados.

⚠ Si algún equipo de eliminatorias cambia respecto al cruce mostrado, lo ajustas desde Admin → Definir cruces.

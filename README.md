# Limpix v2 – Marketplace de Limpieza con Supabase

## 🗂 Archivos incluidos

```
limpix2/
├── index.html          ← Catálogo público
├── proveedor.html      ← Perfil de cada proveedor
├── admin.html          ← Panel de administración
├── style.css           ← Estilos públicos
├── admin.css           ← Estilos del admin
├── supabase.js         ← ⚠️ Configuración (poner tus keys)
├── app.js              ← Lógica del catálogo
├── profile.js          ← Lógica del perfil
├── admin.js            ← Lógica del panel admin
├── supabase_setup.sql  ← SQL para crear las tablas
└── README.md
```

---

## 🚀 Setup paso a paso

### 1. Crear proyecto en Supabase

1. Andá a [supabase.com](https://supabase.com) → **New project**
2. Elegí nombre, contraseña, región (South America si está disponible, sino US East)
3. Esperá que cargue (~2 min)

### 2. Crear las tablas

1. En tu proyecto de Supabase andá a **SQL Editor**
2. Pegá todo el contenido de `supabase_setup.sql`
3. Hacé clic en **Run**
4. Deberías ver "Success" y las tablas `providers` y `reviews` creadas

### 3. Crear tu usuario admin

1. En Supabase andá a **Authentication → Users → Add user**
2. Ingresá tu email y contraseña
3. Ese email y contraseña los usás para entrar a `admin.html`

### 4. Conectar el sitio a Supabase

Abrí `supabase.js` y reemplazá:

```js
const SUPABASE_URL = 'https://XXXXXXXXXXXXXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
```

Encontrás estos valores en: **Settings → API** de tu proyecto Supabase.

> ✅ La `anon key` es pública y segura de usar en el frontend.

### 5. Deploy en GitHub Pages

```bash
git init
git add .
git commit -m "initial"
git branch -M main
git remote add origin https://github.com/TUUSUARIO/REPO.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → main / root → Save**

---

## 📋 Cómo usar el panel admin

- Accedé a `tusitio.github.io/admin.html`
- Logeate con el email/contraseña que creaste en Supabase Auth
- **Proveedores**: agregá, editá, activá/desactivá y eliminá proveedores
- **Reseñas**: revisá las reseñas pendientes → aprobá o rechazá

## 💬 Flujo de WhatsApp

Cada proveedor tiene su propio número. Cuando un usuario hace clic en "WhatsApp":
- Se abre `wa.me/549NUMERO` con un mensaje pre-cargado
- El mensaje incluye el nombre del proveedor y menciona Limpix

## ⭐ Reseñas

- Cualquier usuario puede dejar una reseña (sin registro)
- Quedan en estado "pendiente" hasta que el admin las aprueba
- Solo las aprobadas se muestran en el perfil público

## 🔧 Personalización

| Qué | Dónde |
|---|---|
| Nombre del sitio | Buscar "limpix" en todos los HTML |
| Número WA global | `index.html` → `wa-global` |
| Colores | `style.css` → variables `:root` |
| Categorías de servicios | `index.html` + `admin.html` → checkboxes |

---

## ❓ Preguntas frecuentes

**¿Los datos se pierden si borro el navegador?**
No. Todo está en Supabase (base de datos real en la nube).

**¿Puedo tener múltiples admins?**
Sí, creá más usuarios en Supabase Auth → todos pueden usar el panel.

**¿Supabase es gratis?**
El plan gratuito incluye 500MB de base de datos, 50.000 filas y 2GB de storage. Más que suficiente para empezar.

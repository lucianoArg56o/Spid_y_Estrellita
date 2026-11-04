# Nido

Caja compartida **exactamente para 2 personas**: 🧚🏻 Spidy (azul) y ★ Estrella (rosa).

- Sin login por email/contraseña
- Perfil local en `localStorage` (cada teléfono)
- Datos reales compartidos en **Neon PostgreSQL** (`DATABASE_URL`)
- Actualización cada 4 segundos (polling)
- Header fijo: **Total disponible → Total especulado**
- Pestañas: Todo · Semana · Compras · Obligaciones
- Categorías: Comida, Limpieza, Hogar, etc.
- Exportar lista de compras (share / clipboard)

## Variable de entorno (Vercel)

Solo una:

| Nombre         | Valor                     |
|----------------|---------------------------|
| `DATABASE_URL` | Connection string de Neon |

## Uso (2 personas)

1. Uno crea la caja y elige 🧚🏻 o ★ → ve el **código de invitación**.
2. El otro entra con ese código (se le asigna el rol libre).
3. Ambos ven y editan los mismos movimientos en tiempo casi real.

## Deploy paso a paso

### 1. Neon (base de datos)

1. Entrá a https://console.neon.tech y creá un proyecto (gratis).
2. Copiá la **connection string** (formato `postgresql://...`).
   Preferí la que dice “pooled” / PgBouncer si aparece.

### 2. GitHub

1. Creá un repo nuevo (público o privado).
2. Subí el contenido de esta carpeta (`nido-final/`) al repo.

```bash
cd nido-final
git init
git add .
git commit -m "Nido ready"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/nido.git
git push -u origin main
```

### 3. Vercel

1. Entrá a https://vercel.com → **Add New Project** → importá el repo.
2. Framework: se detecta solo (Vite / TanStack Start).
3. En **Environment Variables** agregá:
   - Name: `DATABASE_URL`
   - Value: la connection string de Neon
4. Deploy.
5. Cuando termine, abrí la URL de producción en los dos teléfonos.

Las migraciones se corren solas en el build (`npm run build` → `scripts/migrate.mjs`).

## Local (opcional)

```bash
cp .env.example .env   # o export DATABASE_URL=...
npm install
npm run db:migrate
npm run dev
```

## Notas de diseño

- La **plata disponible** la cargan ustedes a mano (es el colchón real).
- Marcar **💰 Pagado** registra el gasto; **🛒 Carrito** y **⏳ Reloj** restan del “especulado” sin tocar todavía el disponible real.
- Cuando paguen de verdad, bajen el disponible a mano (o marquen pagado y ajusten).

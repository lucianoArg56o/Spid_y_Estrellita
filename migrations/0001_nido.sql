create table if not exists households (
  id text primary key,
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists members (
  user_id text primary key,
  household_id text not null references households(id) on delete cascade,
  persona text not null check (persona in ('spidy', 'estrella')),
  display_name text not null default '',
  joined_at timestamptz not null default now()
);

create unique index if not exists members_household_persona_idx
  on members (household_id, persona);

create table if not exists balances (
  household_id text not null references households(id) on delete cascade,
  persona text not null check (persona in ('spidy', 'estrella')),
  sueldo numeric(14,2) not null default 0,
  sueldo_set boolean not null default false,
  disponible numeric(14,2) not null default 0,
  disponible_set boolean not null default false,
  disponible_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (household_id, persona)
);

create table if not exists items (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  kind text not null check (kind in ('gasto', 'especulacion', 'compra', 'obligacion', 'ingreso', 'transferencia')),
  persona text not null check (persona in ('spidy', 'estrella', 'ambos')),
  categoria text not null,
  titulo text not null default '',
  monto numeric(14,2) not null default 0 check (monto >= 0),
  fecha date not null,
  pagado boolean not null default false,
  carrito boolean not null default false,
  reloj boolean not null default false,
  cuenta boolean not null default true,
  fuente_id text,
  mes_ref text,
  pagado_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_household_idx on items (household_id, fecha desc);

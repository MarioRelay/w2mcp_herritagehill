# Heritage Hill — Fabric Medallion ETL Pipeline

Automatización completa de datos de property management usando **Microsoft Fabric** con arquitectura Medallion (Bronze → Silver → Gold). Integra datos de **RealPage BIX** y **OneSite** hacia un modelo semántico listo para Power BI.

---

## Arquitectura

```
SFTP (RealPage BIX)          SharePoint (OneSite XLSX)
        │                               │
        ▼                               ▼
┌──────────────────┐         ┌──────────────────────┐
│ Bronze_BIX       │         │ Bronze_OneSite        │
│ LAH_DF2.ipynb    │         │ LAH_DF2.ipynb         │
│ (descarga SFTP   │         │ (descarga SharePoint  │
│  → raw CSVs)     │         │  → split XLSX sheets) │
└────────┬─────────┘         └──────────┬────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐         ┌──────────────────────┐
│ Silver_BIX       │         │ Silver_OneSite        │
│ LAH_DF2.ipynb    │         │ LAH_DF2.ipynb         │
│ (SCD Type 2      │         │ (XLSX → Delta tables) │
│  → Delta tables) │         └──────────┬────────────┘
└────────┬─────────┘                    │
         └──────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │ Gold_Build       │
              │ LAH_DF2.ipynb    │
              │ (agregaciones    │
              │  → fact tables)  │
              └──────────────────┘
                        │
                        ▼
                  Power BI / Semantic Model
```

El pipeline `Heritage_ETL_Pipeline` orquesta todo esto en Fabric con dependencias automáticas.

---

## Lakehouses en Fabric

| Lakehouse | Propósito |
|-----------|-----------|
| `Heritage_Bronze_LH` | Raw: CSVs de RealPage + XLSX de OneSite |
| `Heritage_Silver_LH` | Limpio: Delta tables con SCD Type 2 |
| `Heritage_Gold_LH` | Agregado: fact tables listas para Power BI |

---

## Notebooks

### Bronze — Extracción

| Notebook | Fuente | Destino |
|----------|--------|---------|
| `BIX_Examples/Bronze_BIX_LAH_DF2.ipynb` | SFTP RealPage | `Heritage_Bronze_LH/Files/RealPageDaily/` |
| `Onesite_Examples/Bronze_OneSite_LAH_DF2.ipynb` | SharePoint XLSX | `Heritage_Bronze_LH/Files/xlsx_by_sheet/` |

### Silver — Transformación

| Notebook | Tablas generadas |
|----------|-----------------|
| `BIX_Examples/Silver_BIX_LAH_DF2.ipynb` | 17 tablas BIX con SCD Type 2 (dimProperty, factGLSummary, factOperationalKPI, dimServiceRequest, etc.) + columnas calculadas (WorkingDays, MRWorkingDays) |
| `Onesite_Examples/Silver_OneSite_LAH_DF2.ipynb` | os_ar_collections, os_denies_cancells, os_effective_rents, os_move_ins, os_delinquent_prepaid, os_leasing_desk |

### Gold — Agregación

`Gold_Build_LAH_DF2.ipynb` genera 5 tablas en `Heritage_Gold_LH`:

| Tabla Gold | Contenido |
|------------|-----------|
| `gold_property_summary` | KPIs por propiedad (ocupación, renta, etc.) |
| `gold_ar_summary` | AR collections con % corriente y % delincuente |
| `gold_maintenance_summary` | Service requests agrupados por propiedad y tipo |
| `gold_leasing_summary` | Move-ins y denies/cancels por propiedad |
| `gold_financial_summary` | GL summary por propiedad, período y cuenta |

### Bootstrap — Despliegue

Notebooks para deployar todo el stack a Fabric desde cero:

| Notebook | Función |
|----------|---------|
| `Bootstrap_Master.ipynb` | Deploy completo: lakehouses + notebooks + pipeline en un solo run |
| `Bootstrap_Create_Bronze_NBs.ipynb` | Solo crea los notebooks Bronze |
| `Bootstrap_Deploy_All_NBs.ipynb` | Actualiza definiciones de todos los notebooks |

---

## Pipeline en Fabric

`Heritage_ETL_Pipeline` ejecuta los notebooks en orden con dependencias:

```
A_Bronze_BIX ────────────► C_Silver_BIX ────────┐
                                                  ├──► E_Gold_Build
B_Bronze_OneSite ────────► D_Silver_OneSite ─────┘
```

Bronze A y B corren en paralelo. Silver espera a su Bronze correspondiente. Gold espera a que ambos Silver terminen.

---

## MCP Proxy (`fabric-proxy.js`)

Proxy local Node.js que expone el API de Microsoft Fabric como servidor MCP (Model Context Protocol), permitiendo a Claude Code interactuar directamente con el workspace de Fabric.

```
Claude Code → localhost:3002 → api.fabric.microsoft.com/v1/mcp/core
```

### Setup

1. Copia `.env.example` a `.env` y llena las variables:

```env
FABRIC_TENANT_ID=tu-tenant-id
FABRIC_CLIENT_ID=tu-client-id
FABRIC_CLIENT_SECRET=tu-client-secret
```

2. Inicia el proxy:

```bash
node fabric-proxy.js
```

3. El proxy corre en `http://localhost:3002` y se registra como servidor MCP `fabric-core` en Claude Code.

### Credenciales necesarias

Se necesita un **Service Principal** de Azure AD con permisos en el workspace de Fabric:
- `Tenant ID` — ID del tenant de Azure
- `Client ID` — App registration ID
- `Client Secret` — Secreto del Service Principal (**nunca commitear en git**)

---

## Estructura del Repo

```
MCP_Fabric/
├── fabric-proxy.js                    # Proxy MCP para Fabric
├── .env.example                       # Plantilla de variables de entorno
├── BIX_Examples/
│   ├── Bronze_BIX_LAH_DF2.ipynb      # Bronze: descarga SFTP RealPage
│   ├── Silver_BIX_LAH_DF2.ipynb      # Silver: SCD2 + computed cols
│   └── SFTP_Download_RealPage.ipynb  # Utilidad SFTP standalone
├── Onesite_Examples/
│   ├── Bronze_OneSite_LAH_DF2.ipynb  # Bronze: descarga SharePoint OneSite
│   └── Silver_OneSite_LAH_DF2.ipynb  # Silver: XLSX → Delta tables
├── Gold_Build_LAH_DF2.ipynb          # Gold: 5 fact tables agregadas
├── Bootstrap_Master.ipynb            # Deploy completo del stack
├── Bootstrap_Create_Bronze_NBs.ipynb
└── Bootstrap_Deploy_All_NBs.ipynb
```

---

## IDs de Workspace (Fabric)

| Item | ID |
|------|----|
| Workspace | `d445bd8c-ec46-44dd-96e1-ea6593a5b99b` |
| Heritage_Bronze_LH | `ce9d8388-a08e-42ea-bb0c-a81c7d45924f` |
| Heritage_Silver_LH | `68c05812-289f-4c00-b9bc-3e4f91f14c43` |
| Heritage_Gold_LH | `8fb6c090-9ca1-4fae-8b61-b90b061bd6ac` |
| Heritage_ETL_Pipeline | `470754f8-d1e0-4c01-89a8-b6d50a93e2bf` |

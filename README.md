# Heritage Hill — Fabric Medallion ETL Pipeline

End-to-end property management data automation built on **Microsoft Fabric** using a Medallion Architecture (Bronze → Silver → Gold). The solution integrates data from **RealPage BIX** and **OneSite** into a semantic model ready for Power BI reporting and analytics.

---

## Architecture

```text
SFTP (RealPage BIX)          SharePoint (OneSite XLSX)
        │                               │
        ▼                               ▼
┌──────────────────┐         ┌──────────────────────┐
│ Bronze_BIX       │         │ Bronze_OneSite       │
│ LAH_DF2.ipynb    │         │ LAH_DF2.ipynb        │
│ (SFTP download   │         │ (SharePoint download │
│  → raw CSVs)     │         │  → split XLSX sheets)│
└────────┬─────────┘         └──────────┬───────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐         ┌──────────────────────┐
│ Silver_BIX       │         │ Silver_OneSite       │
│ LAH_DF2.ipynb    │         │ LAH_DF2.ipynb        │
│ (SCD Type 2      │         │ (XLSX → Delta tables)│
│  → Delta tables) │         └──────────┬───────────┘
└────────┬─────────┘                    │
         └──────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │ Gold_Build       │
              │ LAH_DF2.ipynb    │
              │ (Aggregations    │
              │  → Gold tables)  │
              └──────────────────┘
                        │
                        ▼
               Power BI Semantic Model
```

The `Heritage_ETL_Pipeline` orchestrates the entire workflow with automated dependencies.

---

## Fabric Lakehouses

| Lakehouse            | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `Heritage_Bronze_LH` | Raw ingestion layer for RealPage CSVs and OneSite XLSX files |
| `Heritage_Silver_LH` | Cleansed and modeled Delta tables with SCD Type 2 history    |
| `Heritage_Gold_LH`   | Aggregated business-ready tables for reporting and analytics |

---

## Notebooks

### Bronze Layer — Data Extraction

| Notebook                                        | Source                    | Destination                               |
| ----------------------------------------------- | ------------------------- | ----------------------------------------- |
| `BIX_Examples/Bronze_BIX_LAH_DF2.ipynb`         | RealPage BIX (SFTP)       | `Heritage_Bronze_LH/Files/RealPageDaily/` |
| `Onesite_Examples/Bronze_OneSite_LAH_DF2.ipynb` | OneSite (SharePoint XLSX) | `Heritage_Bronze_LH/Files/xlsx_by_sheet/` |

### Silver Layer — Data Transformation

| Notebook                                        | Output Tables                                                                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIX_Examples/Silver_BIX_LAH_DF2.ipynb`         | 17 BIX tables using SCD Type 2 (dimProperty, factGLSummary, factOperationalKPI, dimServiceRequest, etc.) plus calculated fields such as WorkingDays and MRWorkingDays |
| `Onesite_Examples/Silver_OneSite_LAH_DF2.ipynb` | os_ar_collections, os_denies_cancells, os_effective_rents, os_move_ins, os_delinquent_prepaid, os_leasing_desk                                                        |

### Gold Layer — Business Aggregations

`Gold_Build_LAH_DF2.ipynb` generates five curated Gold tables in `Heritage_Gold_LH`:

| Gold Table                 | Description                                                             |
| -------------------------- | ----------------------------------------------------------------------- |
| `gold_property_summary`    | Property-level KPIs including occupancy, rent, and operational metrics  |
| `gold_ar_summary`          | Accounts receivable collections with current and delinquent percentages |
| `gold_maintenance_summary` | Service request metrics grouped by property and request type            |
| `gold_leasing_summary`     | Leasing performance including move-ins and deny/cancel metrics          |
| `gold_financial_summary`   | Financial summary by property, accounting period, and account group     |

### Bootstrap & Deployment

Deployment notebooks used to provision and update the complete Fabric environment:

| Notebook                            | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `Bootstrap_Master.ipynb`            | Full deployment of lakehouses, notebooks, and pipeline |
| `Bootstrap_Create_Bronze_NBs.ipynb` | Creates Bronze notebooks only                          |
| `Bootstrap_Deploy_All_NBs.ipynb`    | Updates and redeploys all notebook definitions         |

---

## Fabric Pipeline

The `Heritage_ETL_Pipeline` orchestrates notebook execution using dependency-based scheduling:

```text
A_Bronze_BIX ────────────► C_Silver_BIX ────────┐
                                                  ├──► E_Gold_Build
B_Bronze_OneSite ────────► D_Silver_OneSite ─────┘
```

Execution flow:

1. Bronze BIX and Bronze OneSite run in parallel.
2. Each Silver notebook waits for its corresponding Bronze notebook.
3. Gold Build executes only after both Silver processes complete successfully.

---

## MCP Proxy (`fabric-proxy.js`)

A lightweight Node.js proxy exposing the Microsoft Fabric API as an MCP (Model Context Protocol) server, allowing Claude Code to interact directly with the Fabric workspace.

```text
Claude Code → localhost:3002 → api.fabric.microsoft.com/v1/mcp/core
```

### Setup

1. Copy `.env.example` to `.env`.

2. Populate the required credentials:

```env
FABRIC_TENANT_ID=<your-tenant-id>
FABRIC_CLIENT_ID=<your-client-id>
FABRIC_CLIENT_SECRET=<your-client-secret>
```

3. Start the proxy:

```bash
node fabric-proxy.js
```

The MCP server will be available at:

```text
http://localhost:3002
```

and registered in Claude Code as `fabric-core`.

### Required Credentials

An Azure AD Service Principal with access to the Fabric workspace is required:

* Tenant ID
* Client ID
* Client Secret

> Never commit secrets or credentials to source control.

---

## Repository Structure

```text
MCP_Fabric/
├── fabric-proxy.js
├── .env.example
├── BIX_Examples/
│   ├── Bronze_BIX_LAH_DF2.ipynb
│   ├── Silver_BIX_LAH_DF2.ipynb
│   └── SFTP_Download_RealPage.ipynb
├── Onesite_Examples/
│   ├── Bronze_OneSite_LAH_DF2.ipynb
│   └── Silver_OneSite_LAH_DF2.ipynb
├── Gold_Build_LAH_DF2.ipynb
├── Bootstrap_Master.ipynb
├── Bootstrap_Create_Bronze_NBs.ipynb
└── Bootstrap_Deploy_All_NBs.ipynb
```

---

## Microsoft Fabric Resource IDs

| Resource              | ID                                     |
| --------------------- | -------------------------------------- |
| Workspace             | `d445bd8c-ec46-44dd-96e1-ea6593a5b99b` |
| Heritage_Bronze_LH    | `ce9d8388-a08e-42ea-bb0c-a81c7d45924f` |
| Heritage_Silver_LH    | `68c05812-289f-4c00-b9bc-3e4f91f14c43` |
| Heritage_Gold_LH      | `8fb6c090-9ca1-4fae-8b61-b90b061bd6ac` |
| Heritage_ETL_Pipeline | `470754f8-d1e0-4c01-89a8-b6d50a93e2bf` |

---

## Key Features

* Microsoft Fabric Medallion Architecture
* Automated ingestion from RealPage BIX (SFTP)
* Automated ingestion from OneSite (SharePoint XLSX)
* SCD Type 2 historical tracking
* Delta Lake storage format
* Automated Gold-layer aggregations
* Power BI-ready semantic model
* Infrastructure deployment through bootstrap notebooks
* MCP integration for Fabric automation and management

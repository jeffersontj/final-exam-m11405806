# Final Exam Project - Software Engineering in Construction Information Systems
Cornelius Jefferson Tjahjono - M11405806

## Database Design (ER Diagram)
```mermaid
erDiagram
    Regions ||--|{ SubRegions : contains
    SubRegions ||--|{ IntermediateRegions : contains
    SubRegions ||--|{ Countries : contains
    IntermediateRegions ||--|{ Countries : contains
    Countries ||--|{ Observations : has
    Years ||--|{ Observations : recorded_in
    Indicators ||--|{ Observations : type_of
    Countries ||--|{ AuditLogs : tracks_changes

    Regions { int id PK string name }
    SubRegions { int id PK string name int region_id FK }
    IntermediateRegions { int id PK string name int sub_region_id FK }
    Countries { int id PK string name string iso_alpha2 string iso_alpha3 int country_code int sub_region_id FK int intermediate_region_id FK }
    Years { int year PK }
    Indicators { int id PK string name string unit }
    Observations { int id PK int country_id FK int year FK int indicator_id FK decimal value }
    AuditLogs { int id PK int country_id FK string action_type string details datetime log_time }

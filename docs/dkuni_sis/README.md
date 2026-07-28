# SIS Multi-Excel to KnowledgeGraph Studio YAML & Views Converter

Dette modul samler og transformerer både **SIS Begrebslisten** og **SIS Informationsmodellen** fra Excel-format til KnowledgeGraph Studio's YAML Exchange Format med fuld semantisk sporbarhed, automatisk 2D Grid-layout, domænebaserede visninger og eliminering af isolerede noder.

---

## 🚀 Løsninger på Canvas Layout & Søgbarhed

1. **Forbindelse af Isolerede Begreber (`omfatter` / `includes` kanter)**:
   - Scriptet forbinder automatisk alle begreber til deres overordnede **Domæne-node** via en `omfatter` (includes) relation.
   - Dette fjerner svævende noder og gør hele Begrebsmodellen til en sammenhængende graf!
2. **Skift fra Vertikalt Træ til 2D Grid & Force-Directed Layout**:
   - I stedet for at noder stabler sig i én vertikal linje, placeres noderne i et kompakt **5-søjlet 2D Grid** ($X = \text{col} \times 340\text{px}$, $Y = \text{row} \times 200\text{px}$).
   - Visningerne anvender `layoutAlgorithm: force_directed` (D3 Physics), som samler relaterede klynger organisk i 2D.
3. **Strukturerede Visninger per Sub-domæne (`views.xarchi.yaml`)**:
   - Scriptet genererer automatisk fokuserede visninger opdelt efter emneområder (f.eks. *Optagelse*, *Eksamen*, *Kvalifikation*, *Stamdata* m.fl.).
   - Hver visning indeholder kun de ~20-40 noder for det pågældende område, hvilket giver hurtig og overskuelig canvas-navigation.
4. **Opdeling i Notationsvisninger**:
   - Opretter separate visninger for **Begrebsmodellen** (kun forretningsbegreber) og **Informationsmodellen** (kun UML-klasser og kodelister).

---

## ⚙️ Kørsel af scriptet

```bash
cd /home/rolfmadsen/Github/knowledgegraphstudio/docs/dkuni_sis

source venv/bin/activate
python3 convert_sis_to_yaml.py
```

Dette genererer to filer:
- `model.xarchi.yaml` (Semantiske noder, relationer og domæner)
- `views.xarchi.yaml` (Visual 2D Grid positions og strukturerede domænevisninger)

---

## 📥 Indsæt i KnowledgeGraph Studio ("Hele Repositoriet")

1. Åbn den opdaterede `model.xarchi.yaml`.
2. Kopier hele filens indhold over i **Hele Repositoriet** fanen i KnowledgeGraph Studio.
3. Vælg eller skift visning i **Model Explorer** til et af de strukturerede domæne-views (f.eks. *Domæne: Optagelse*).

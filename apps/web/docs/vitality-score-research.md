# Vivra Vitality Score — Research & Scientific References

> Este documento es la fuente de verdad científica detrás del modelo de salud propietario de Vivra.
> Actualizado: Febrero 2026.

---

## 1. Marco conceptual: ¿Por qué un score compuesto?

El Vivra Vitality Score está inspirado en modelos de salud humana como **Garmin Body Battery**, **WHOOP Recovery Score** y **Apple Vitals** (watchOS 11), que demostraron que combinar múltiples señales en un solo número accionable es más útil para el usuario que mostrar métricas aisladas.

La diferencia clave de Vivra vs. esos modelos: **no requerimos hardware**. Toda la señal viene de datos que el dueño ya registra en la app.

---

## 2. Sistemas veterinarios establecidos que fundamentan el modelo

### 2.1 Body Condition Score (BCS) — WSAVA / Purina
- **Escala:** 1–9 (Purina) o 1–5 (AAHA)
- **Gold standard** clínico para evaluar composición corporal en perros
- Puntuación 4–5/9 = ideal; cada punto sobre 5 ≈ +10–15% grasa corporal
- **Validación:** Correlacionado con enfermedad ortopédica, cardíaca, respiratoria, neoplásica y dermatológica
- 📄 [WSAVA BCS Chart (Dog)](https://wsava.org/wp-content/uploads/2020/01/Body-Condition-Score-Dog.pdf)
- 📄 [Purina Body Condition System](https://www.purinainstitute.com/centresquare/nutritional-and-clinical-assessment-tools/the-purina-body-condition-system)
- 📄 [VCA Hospitals — Body Condition Scores](https://vcahospitals.com/know-your-pet/body-condition-scores)

### 2.2 Muscle Condition Score (MCS) — WSAVA
- Escala verbal: Normal / Pérdida leve / Pérdida moderada / Pérdida severa
- **Insight crítico:** BCS y MCS son independientes — un perro obeso puede tener pérdida muscular severa (obesidad sarcopénica), que tiene el peor pronóstico
- Pérdida muscular = primera señal de caquexia en cáncer, ERC, cardiopatía
- 📄 [WSAVA MCS Chart](https://wsava.org/wp-content/uploads/2020/01/Muscle-Condition-Score-Chart-for-Dogs.pdf)
- 📄 [Purina Institute — MCS](https://www.purinainstitute.com/centresquare/nutritional-and-clinical-assessment-tools/muscle-condition-scoring-detect-muscle-loss)

### 2.3 Purina Fecal Score
- Escala 1–7 (2 = ideal); refleja calidad de dieta, microbioma, hidratación
- Equivalente canino de la Bristol Stool Scale
- 📄 [Purina Fecal Scoring System](https://vhc.missouri.edu/wp-content/uploads/2020/07/Nestle-Purina-Fecal-Scoring-System.pdf)

---

## 3. Estudios clave que validan los pilares del score

### 3.1 Edad biológica y riesgo de mortalidad (Pilar: Cuidado Preventivo)
- **Estudio:** GeroScience 2024 — "Biological age in dogs using common clinical markers"
- **Muestra:** 829 perros, 12 años de seguimiento
- **Hallazgo:** Cada año de desviación positiva (edad biológica > cronológica) → HR 1.75 de mortalidad. Es decir, un perro biológicamente 1 año "más viejo" tiene 75% más riesgo de morir en el período
- **Inputs:** CBC + panel de química sérica (loggeable indirectamente via visitas al vet)
- 📄 [GeroScience 2024 — Full paper](https://link.springer.com/article/10.1007/s11357-024-01352-4)
- 📄 [PMC Full Text](https://pmc.ncbi.nlm.nih.gov/articles/PMC11872834/)

### 3.2 Actividad física y longevidad (Pilar: Actividad)
- **Estudio:** Dog Aging Project — Nature Scientific Reports 2023
- **Muestra:** 100,000 acelerómetros distribuidos con Banfield Pet Hospital
- **Hallazgos:**
  - Patrones de actividad correlacionan con fracción de vida, memoria y velocidad de marcha
  - Razas grandes envejecen más rápido epigenéticamente (0.37 años extra por año cronológico)
  - Disfunción cognitiva (Alzheimer canino) correlaciona con reducción de actividad
- 📄 [Dog Aging Project — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9536450/)
- 📄 [Nature 2023 — Activity Patterns & Lifespan](https://www.nature.com/articles/s41598-023-29181-z)
- 📄 [Frontiers Vet Science 2025](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2025.1572794/full)

### 3.3 Obesidad por raza y factores de riesgo (Pilar: Peso)
- **Estudio:** Pegram et al. 2021 — VetCompass UK
- **Muestra:** 40,038 perros
- **Hallazgos:**
  - 41.3% sobrepeso/obesos (21.1% sobrepeso + 20.2% obesos)
  - Castrados: riesgo significativamente mayor
  - Hembras: mayor riesgo que machos
  - Pico de riesgo: 6–12 años
  - Razas mayor riesgo: Labrador, Cavalier KCS, Beagle, Cocker Spaniel, Golden Retriever
  - >50% de la variación por raza está mediada por motivación hacia la comida
- 📄 [Pegram 2021 — Wiley/JSAP](https://onlinelibrary.wiley.com/doi/10.1111/jsap.13325)
- 📄 [Pet Obesity Prevention — Datos 2022](https://www.petobesityprevention.org/2022)

### 3.4 Dog Health Score con IA (modelo análogo directo)
- **Estudio:** Kim & Kim 2024 — Animals (MDPI)
- **Metodología:** Fuzzy associative memory algorithm sobre 600+ instancias de hospitales veterinarios
- **Inputs:** Frecuencia de comportamientos anormales (rascado, lamido, deglución, sueño), estratificados por tamaño/peso
- **Output:** Score 0–10 (>5 = recomendar consulta vet)
- **Concordancia con diagnóstico veterinario: 87.5%**
- Este es el paper más directamente análogo al Vivra Vitality Score
- 📄 [PMC Full Text — Kim & Kim 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10812422/)
- 📄 [PubMed](https://pubmed.ncbi.nlm.nih.gov/38254424/)

### 3.5 Predicción de enfermedades desde seguros (Pilar: Raza + Edad)
- **Estudio:** Nature Scientific Reports 2023 — ML en datos de seguros
- **Hallazgo:** Alta capacidad predictiva de 45 grupos de enfermedad (710 diagnósticos específicos = 82.5% de todos los claims) a partir de raza, edad, sexo e historial de visitas
- 📄 [Nature Scientific Reports 2023](https://www.nature.com/articles/s41598-023-36023-5)

### 3.6 Enfermedad periodontal (Pilar: Grooming/Dental)
- Para los 2 años de edad: 80% de los perros muestran alguna enfermedad periodontal
- Para los 3 años: prácticamente todos tienen signos tempranos
- Razas pequeñas y braquicéfalas: mayor riesgo anatómico
- Las bacterias periodontales que entran al torrente sanguíneo se asocian con enfermedad cardíaca (endocarditis), renal y hepática
- 📄 [Cornell — Periodontal Disease in Dogs](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-information/periodontal-disease)
- 📄 [Today's Veterinary Practice — Periodontal](https://todaysveterinarypractice.com/dentistry/practical-dentistry-periodontal-disease-utilizing-current-information-to-improve-client-compliance/)

### 3.7 Dieta y marcadores clínicos (Pilar: Dieta)
- **Estudio:** PMC — Kibble vs. Raw comparative clinical markers
- **Hallazgos:**
  - Perros con dieta raw: mejor sensibilidad insulínica, mayor conteo linfocitario
  - Perros con kibble: mayor ganancia de peso, triglicéridos más altos, fosfatasa alcalina más alta
  - (Nota: FDA/CDC no recomiendan dieta raw por riesgo de contaminación)
- La calidad de dieta (tipo + gramos) es señal legítima de salud
- 📄 [PMC — Clinical Markers Kibble vs Raw](https://pmc.ncbi.nlm.nih.gov/articles/PMC8174467/)

---

## 4. Análogos en tecnología de salud humana

### 4.1 Garmin Body Battery (5–100)
- **Motor:** Firstbeat Analytics (Finlandia)
- **Inputs:** HRV, FC reposo, estrés (derivado de HRV), calidad de sueño, VO2max, intensidad de actividad
- **Metodología:** Normalización contra baseline personal rodante → metáfora de batería
- **Lección para Vivra:** El baseline personal es más importante que las normas poblacionales
- 📄 [Garmin Body Battery — Explicación oficial](https://support.garmin.com/en-US/?faq=VOFJAsiXut9K19k1qEn5W5)
- 📄 [Pocket-lint — Body Battery explained](https://www.pocket-lint.com/garmin-body-battery-explained/)

### 4.2 WHOOP Recovery Score (0–100%)
- **Inputs:** HRV (sueño profundo), FC reposo, frecuencia respiratoria, rendimiento de sueño, temperatura, SpO2
- **Metodología:** Compara cada noche contra baseline personal de 14 días. HRV tiene mayor peso
- **Categorías:** Verde (67–100%), Amarillo (34–66%), Rojo (0–33%)
- **Lección para Vivra:** Score categorizado en semáforo es más accionable que un número puro
- 📄 [WHOOP — How Recovery Works](https://www.whoop.com/us/en/thelocker/how-does-whoop-recovery-work-101/)

### 4.3 Apple Vitals (watchOS 11, 2024)
- **Metodología:** Baseline de 7 noches; anomalía solo cuando 2+ métricas desvían simultáneamente
- **Lección para Vivra:** Una sola señal = ruido; dos o más señales simultáneas = alerta real (multi-signal anomaly detection)
- 📄 [Apple watchOS 11 — Vitals](https://www.apple.com/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/)
- 📄 [Apple Support — Vitals App](https://support.apple.com/en-us/120142)

---

## 5. Apps competidoras y su metodología

| App | Metodología | Hardware | Score único | Limitación |
|---|---|---|---|---|
| **Whistle Health** | Desviación del baseline personal por comportamiento (rascado, lamido, bebida) | Sí ($100+) | No | Requiere collar especial |
| **Embark** | Genotipado (200k+ marcadores SNP) + riesgo epigenético | No (swab) | No | Una sola foto, no longitudinal |
| **Petivity (Purina)** | Tests laboratorio (microbioma, riñón, dental) | Kits físicos | No | Tests periódicos costosos |
| **Fetch Health Forecast** | Datos de claims de seguros por raza/edad | No | No visible | No app de seguimiento |
| **Fi Collar** | GPS + actividad (pasos, sueño) | Sí ($150+) | No | Solo actividad |
| **Vivra Vitality Score** | Todos los pilares combinados, sin hardware | **No** | **Sí** | — |

- 📄 [Whistle Health](https://www.whistle.com/products/whistle-health-smart-device)
- 📄 [Whistle FIT — Pruritus Study (Frontiers)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10445133/)
- 📄 [Embark Health Testing](https://embarkvet.com/breeders/health/)
- 📄 [Petivity App](https://www.petivity.com/pages/petivity-app)

---

## 6. Predisposiciones por raza — Fuentes primarias

### Libros de referencia veterinaria
- **Gough A, Thomas A, O'Neill D** — *Breed Predispositions to Disease in Dogs and Cats* (3ª ed., Wiley-Blackwell, 2018) — La biblia de predisposiciones por raza
- **Ackerman L** — *The Genetic Connection: A Guide to Health Problems in Purebred Dogs* (2ª ed., AAHA Press)

### Bases de datos de salud por raza
- 📄 [OFA — Orthopedic Foundation for Animals (hip, elbow, cardiac, eye statistics by breed)](https://www.ofa.org/diseases/breed-statistics/)
- 📄 [PennHIP — Hip dysplasia statistics by breed](https://antechimagingservices.com/antechweb/pennhip)
- 📄 [AKC Canine Health Foundation — Breed health research](https://akcchf.org/)
- 📄 [WSAVA — Global Breed Health Surveys](https://wsava.org/global-guidelines/global-dental-guidelines/)
- 📄 [Pet Obesity Prevention — Ideal weight by breed](https://www.petobesityprevention.org/ideal-weight-ranges)

---

## 7. Arquitectura del Vivra Vitality Score

### Fórmula general

```
VitalityScore = Σ(pilar_i × peso_i) × modificadores_raza_edad
```

### Los 5 pilares (20 pts cada uno = 100 pts máximo)

#### Pilar 1 — Peso Corporal (20 pts)
```
puntos = 20 × (1 - penalización_desvío)
```
- Rango ideal: ±5% del peso ideal de la raza → 20/20
- 5–10% desviación → -2 pts por % de desviación
- 10–20% desviación → -3 pts por % adicional
- >20% desviación → máximo 2 pts
- Bonus: tendencia de mejora (+2 pts) o penalización por empeoramiento (-2 pts)
- **Base científica:** WSAVA BCS, VetCompass obesity data (Pegram 2021)

#### Pilar 2 — Cuidado Preventivo (20 pts)
```
puntos = vacunas_score (10) + visitas_score (10)
```
- Vacunas core al día (rabia, parvo, moquillo, adenovirus): 10 pts proporcionales
- Última visita al vet: ≤12 meses = 10 pts; 12–18 meses = 6 pts; 18–24 meses = 3 pts; >24 meses = 0 pts
- **Base científica:** GeroScience 2024 (gaps en visitas → edad biológica acelerada), AVMA guidelines

#### Pilar 3 — Raza + Edad (20 pts — ajuste de riesgo)
```
puntos = 20 - penalizaciones_por_riesgos_activos
```
- Score base 20; se descuentan puntos si existen factores de riesgo activos por edad+raza
- Alerta dental: ≥2 años + raza pequeña/braquicéfala sin grooming reciente → -4 pts
- Alerta cardiaca: raza predispuesta (CKCS, Boxer, Doberman) ≥5 años sin vet reciente → -4 pts
- Alerta obesidad: raza de alto riesgo (Labrador, Beagle) + castrado + >6 años → -3 pts
- Alerta senior: >8 años (razas medianas), >6 años (razas grandes), >10 años (razas pequeñas) → -2 pts (watchlist)
- **Base científica:** Gough/Thomas textbook, VetCompass/Pegram 2021, Cornell periodontal, Nature 2023

#### Pilar 4 — Actividad y Bienestar (20 pts)
```
puntos = actividad_score (12) + grooming_score (8)
```
- Actividades/aventuras en últimos 30 días: ≥4 = 12; 2–3 = 8; 1 = 4; 0 = 0
- Grooming reciente: ≤30 días = 8; 31–60 días = 5; 61–90 días = 2; >90 días = 0
- **Base científica:** Dog Aging Project 2023 (actividad → longevidad, función cognitiva)

#### Pilar 5 — Nutrición (20 pts)
```
puntos = calidad_dieta (10) + precision_porcion (10)
```
- Alimento registrado con datos completos (brand + gramos + tipo): 10 pts base
- Porción adecuada: grams/día vs. necesidad calórica MER (Purina formula):
  - MER = 132 × (peso_kg ^ 0.75) para perros adultos activos (kcal/día)
  - Kcal/g promedio: kibble premium ≈ 3.5 kcal/g, estándar ≈ 3.0 kcal/g
  - ±10% del objetivo: 10 pts; ±10–25%: 6 pts; ±25–40%: 3 pts; >40%: 0 pts
- **Base científica:** Purina MER calculator, PMC diet quality study

### Categorías de score (inspiradas en WHOOP)

| Score | Categoría | Color | Mensaje |
|---|---|---|---|
| 85–100 | Excelente | Verde intenso (`#22c55e`) | "Salud óptima — sigue así" |
| 70–84 | Muy bueno | Verde (`#7CB974`) | "Buen estado general" |
| 55–69 | Regular | Amarillo (`#F59E0B`) | "Hay áreas de mejora" |
| 40–54 | Atención | Naranja (`#F97316`) | "Requiere atención" |
| 0–39 | Crítico | Rojo (`#EF4444`) | "Consulta con tu veterinario" |

### Sistema de flags (multi-signal: ≥2 flags = alerta roja)
Inspirado en Apple Vitals: una sola señal = aviso; dos o más simultáneas = alerta prioritaria.

```
flags = {
  weight_gain:        peso > 5% sobre ideal, tendencia ascendente 30 días
  vaccine_gap:        vacuna core vencida o próxima a vencer (<30 días)
  vet_overdue:        sin visita al vet en >18 meses
  dental_risk:        edad ≥2 años + sin grooming en >60 días + raza pequeña
  obesity_risk:       BCS implícito >6/9 + raza alto riesgo + castrado
  senior_watchlist:   edad supera umbral senior para su tamaño
  diet_missing:       sin datos de alimentación registrados
  activity_low:       0 actividades en 30 días
}
```

---

## 8. Datos que Vivra puede capturar en el futuro (roadmap)

| Dato | Valor predictivo | Cómo capturarlo |
|---|---|---|
| `is_neutered` | Alto (modifica obesidad risk 2x) | Campo en perfil |
| Check-in semanal subjetivo (energía 1–5, apetito, sueño) | Alto (proxy de comportamiento sin sensor) | Notificación push semanal |
| Resultado de análisis de sangre | Muy alto (biological age GeroScience) | Formulario en visitas vet |
| Foto para BCS automático | Muy alto (AI body condition) | Upload mensual + modelo ML |
| Temperatura ambiental / clima | Medio (heat stress en braquicéfalos) | API geolocalización |
| Tipo de seguro | Medio (adherencia a cuidado preventivo) | Campo opcional en perfil |

---

## 9. Posicionamiento competitivo

> **Vivra Vitality Score es el único índice de salud canino multi-pilar, longitudinal y sin hardware del mercado hispano.**

Ninguna app existente combina:
1. ✅ Peso histórico vs. ideal por raza (BCS-proxy)
2. ✅ Cuidado preventivo (vacunas + visitas)
3. ✅ Modificadores de riesgo por raza + edad
4. ✅ Actividad y bienestar
5. ✅ Nutrición (gramos + calidad)

...en un solo score accionable, actualizado en tiempo real, sin requerir ningún dispositivo adicional.

---

*Referencias compiladas y modelo diseñado en Febrero 2026 para Vivra v2.0.*

---
abstract: >-
  Vaccine safety surveillance programs that monitor possible short-term rare adverse events
  following vaccination usually only have access to data on vaccinated individuals who
  experienced the event of interest. The Self-Controlled Case Series design employs such data
  and compares the risk of the event in an “risky” period immediately after vaccination to
  that in a “baseline risk” period where the transient risk should be gone. To ensure valid
  analysis, some assumptions have been given in the literature while others are made
  implicitly through parametric modeling. In this work, we provide a complete formal causal
  framework for the Self-Controlled Cases Series design. We provide sufficient conditions for
  a causal interpretation of the contrasts estimated from the data on exposed individuals who
  experienced the event. These conditions are intuitive but often cannot be tested from the
  available data. We describe practical settings where these conditions may be violated. When
  the conditions are not met, the contrasts estimated in practice do not clearly relate to any
  quantities of causal interest, and should therefore be interpreted with caution.
---

<!-- CONVERTED TEXT - NOT THE PUBLISHED DOCUMENT.
     Made by ingest.py from etievant-2026-sccs-causal-framework.pdf.
     No heading was inserted; any `#` below is the document's own, or was
     detected from its typography. None of the author's wording is altered;
     the publisher's access stamps, where there were any, are blanked and the
     lines they sat on are kept so nothing below them moves.
     Back matter is kept here and trimmed only when text is sent to a model.
     structured route (pdf_to_source): 19 heading(s), 0 displayed quotation(s) as blockquotes, 1 footnote(s) under `# Notes`
     dropped: journal licence (3), running head (19), page number (2), front matter (detected) (20)
     back matter kept for the reader (References) -- in the file, trimmed from the extraction prompt
     abstract kept (173 words) -- in the file's front matter, which the app shows on the orientation panel and a claim may quote; it is never trimmed from the extraction prompt
     headings from the PDF's own outline (19 of its 22 entries found in the text)
     (the raw text layer held 7936 words; this keeps 7610, the difference measured furniture and front matter) -->

<!-- p.1 begins here -->

# 1 Introduction

Programs such as the Vaccine Safety Datalink (VSD) or the Vaccine Adverse Event Reporting System (VAERS) have been developed in the United States [1, 2] to monitor possible adverse events following vaccination (exposure). They evaluate larger and more diverse populations than those included in the clinical trials initially run to assess vaccine safety and efficacy. In addition, they can detect rare adverse events such as Guillain Barré Syndrome (GBS) [3] or intussusception [4]. They collect information on the date of vaccination and other baseline variables such as medical illnesses, medication, etc. But these programs only report on adverse events among exposed individuals.

A popular design using data only on exposed cases (i.e., who experienced the event of interest) is the SelfControlled Case Series (SCCS) [5–8, Chapter 22]. The intuition is that the risk should be transiently increased immediately after exposure and then return to the “baseline risk” unaffected by exposure. The principle of the SCCS design is thus to compare the risk of an event in a “risky” period to that in a “baseline risk” period. Similar to the Case-Crossover design [8, 9, Chapter 7], individuals act as their own controls, and confounding due to time-fixed variables that multiplicatively increase the risk is automatically addressed (when using the multiplicative scale).

<!-- p.2 begins here -->

2 Key assumptions are (i) the effect of the vaccine is transient and the time after which it can no longer have an effect is known, and (ii) the “baseline risk” of the event is the same in each time period. By “baseline risk”, we mean the intrinsic risk not due to the exposure of interest (i.e., vaccine). Contrary to (i), (ii) is not clearly stated in the SCCS literature [5–8, Chapter 22]. Assumption (ii) can be relaxed to state that the baseline risks in the two periods are in a known ratio or from using the ratio of period durations, if unequal. Other assumptions are that the event is rare and the probability of exposure is independent of the occurrence of an event. Here, we focus on a rare adverse event and use data on exposed cases, which justifies the independence assumption [7]. Whitaker et al. [7] also stated that the event must have a positive probability of occurring in each period.

We provide a causal deconstruction of the SCCS design. Such a causal framework can clarify the quantities of causal interest and thus the questions one can answer. It can also identify unnoticed biases [10]. In Section 2, we introduce counterfactual notation. In Section 3, we formalize assumptions (i) and (ii) above, and study how quantities of potential causal interest can be estimated from data on exposed cases only. We investigate bias from violation of the sufficient conditions in Section 4. In Section 5, we consider their plausibility and discuss settings where they may be violated. In Section 6 we study how additional data strengthens inference. We discuss confounders in Section 7. We illustrate bias from violation of the sufficient conditions in a simulation and present a data illustration of our framework based on a study of GBS following Influenza A 2009 Monovalent vaccination [11] in Sections 8 and 9, respectively. Concluding remarks are in Section 10.

# 2 Notation

Our objective is to determine if an exposure (i.e., a vaccine) causes a rare adverse event (e.g., GBS or intussusception), and thus increases the probability of the event. Individuals are followed for two time periods: first, the “risky” period following vaccination (period 1), and then the “baseline risk”, or “control”, period (period 2). We assume the two periods have the same duration; see for example Figure 1 that shows the “risky” and “control” periods used by Salmon et al. for their study of GBS following Influenza A (H1N1) 2009 Monovalent vaccination [11].

We start by describing a full prospective study of n individuals, although the SCCS design only uses data from exposed individuals who experienced the event of interest during one of the two study periods; see Section 3. We assume no individuals are lost to follow-up and they are followed from study entry until the end of period 2 or until they experience the event of interest, whichever occurs first. Let Z be the binary exposure of interest (vaccination), and T be the outcome. Let t = 0 be the study entry time, which is assumed to coincide with the time of exposure. Let t = 1 and t = 2 be the two times of evaluation for the adverse event, at the end of period 1 and period 2, respectively. T can take value 1 (event between times 0 and 1), 2 (event between times >1 and 2), or 3 (no event during follow-up). We assume Z and T are ordered temporally, as in Figure 2A. For example in Salmon et al. [11], Z

<!-- p.3 begins here -->

is H1N1 vaccination and T is the time of occurrence of GBS. We will discuss the presence of a confounding variable W, i.e., that affects both Z and T, in Section 7.

We are interested in the causal effect of Z on T. We focus on the “risky” period, period 1. Let T Z=z be the outcome variable following the hypothetical intervention do(Z = z), i.e., in the counterfactual world where Z would have been set to value z ∈{0, 1}. A key quantity is the causal risk ratio P(TZ=[^1] = 1) P(TZ=[^0] = 1) ≡exp(β),

(1) which compares the risk of getting the event of interest in period 1, had all the individuals been exposed, to the risk of getting the event in period 1, had all the individuals not been exposed. Several conditions are needed to identify P(T Z=z = 1), z ∈{0, 1}, i.e., express it only in terms of the distribution of observable variables, so that it could be estimated in practice; see Section S1 of the supplementary material. However hereafter, we assume the adverse events are only reported by individuals who were exposed, i.e., we only have data on individuals with T ≠3 and Z = 1 (see e.g., Supplementary Table 1A). Thus, we cannot estimate P(T Z=z = t), z ∈{0, 1}, t ∈{1, 2}, and cannot estimate the quantity of causal interest in Equation (1) without making further assumptions; see also Section S2 of the supplementary material.

As a remark, another quantity of potential causal interest is the causal risk ratio in the “treated” P(TZ=[^1] = 1⃒⃒⃒⃒Z = 1) P (TZ=[^0] = 1⃒⃒⃒⃒Z = 1) ≡exp(βZ=1).

(2) But in the absence of confounders as in the setting of Figure 2A that we assume for now, it coincides with the causal risk ratio in Equation (1); see Section S1 of the supplementary material.

# 3 Estimand for data on exposed cases only

Using the notation in Section 2, we translate Conditions (i) and (ii) from Section 1: (i) P(TZ=[^1] = 2) = P(TZ=[^0] = 2). (ii) P(TZ=[^0] = 1) = P(TZ=[^0] = 2). Condition (i) states that the two time periods were well chosen so that Z no longer has an effect after period 1. In addition, it implies that if the vaccine causes adverse events in period 1, it should be on individuals with T Z=0 = 3 rather than individuals with T Z=0 = 2, i.e., the vaccine should cause de novo harm and not accelerate the development of adverse events from period 2 to period 1. Condition (ii) states that the baseline risk of the event is the same in the two time periods, so that a variation in the baseline risk between period 1 and period 2 is not confused with the effect of the vaccine.

<!-- p.4 begins here -->

4 Table : Sufficient assumptions to estimate causally meaningful quantities from SCCS data (i.e., data on the exposed cases only) under the setting of Figure C. The scenarios describe the available data (column ), together with the estimand (column ), and assumptions (column ) to estimate one of the causal risk ratios given in Equations () and (), or (), without bias (column ). Scenario

Estimand Assumptions Causal risk ratio . No confounder (W = ∅)

PðT¼jT≠;Z¼Þ Conditions (i) and (ii) Marginal causal risk

PðT¼jT≠;Z¼Þ ratio in Equation () . No confounder (W = ∅)

PðT¼jT≠;Z¼Þ × PðT¼jT≠;Z¼Þ

PðT¼jT≠;Z¼Þ Condition (i) Marginal causal risk PðT¼jT≠;Z¼Þ and data on the unexposed ratio in Equation cases () . Measured confounder W

PðT¼jT≠;Z¼;WÞ Conditions (i)W and (ii)W Stratum-specific

PðT¼jT≠;Z¼;WÞ causal risk ratio in Equation () . Measured confounder W

PðT¼jT≠;Z¼;WÞ × PðT¼jT≠;Z¼;WÞ

PðT¼jT≠;Z¼;WÞ PðT¼jT≠;Z¼;WÞ Condition (i)W. If in addition there is no interaction Stratum-specific and data on the unexposed between Z and W (βW = β), βW estimates can be causal risk ratio in cases combined to estimate β more efficiently Equation () .a. Unmeasured

PðT¼jT≠;Z¼Þ Conditions (i)W and (ii)W; no interaction between Z Marginal causal risk

PðT¼jT≠;Z¼Þ confounder W and W: βW = β ratio in Equation () .b. Unmeasured

PðT¼jT≠;Z¼Þ Conditions (i)W and (ii)W Causal risk ratio in the

PðT¼jT≠;Z¼Þ confounder W treated in Equation ()

Recall that P(T Z=z = t) cannot be estimated from the available data, z ∈{0, 1}, t ∈{1, 2}; thus we cannot test if Conditions (i) and (ii) hold. We will come back to this point in Section 6 and investigate departure from such Conditions in Section 4.

With data on exposed cases only, and if P(T = t|Z = 1) > 0, t ∈{1, 2}, we can estimate contrast P(T=[^1]|T≠[^3],Z=[^1]) P(T=2|T≠3,Z=1). The additional “Positivity Condition” is related to the one mentioned by Whitaker et al. [7] and is assumed to hold thereafter. Under the setting of Figure 2A, P(T=[^1]|T≠[^3],Z=[^1]) P(T=[^2]|T≠[^3],Z=[^1]) = P(TZ=[^1]=[^1]) P(TZ=1=2); see Section S2 of the supplementary material for details. Thus when Conditions (i) and (ii) above hold under the setting of Figure 2A, the contrast estimated in practice coincides with the marginal causal risk ratio in Equation (1) and has a clear causal meaning.

As will be illustrated in Sections 4 and 8, violation of Conditions (i) and/or (ii) preclude unbiased estimation of exp(β) in Equation (1); see also Section 6. We will investigate plausibility of Conditions (i) and (ii) and discuss settings where they may be violated in Section 5. A setting with confounders as in Figure 2C will be considered in Section 7. We have listed these different scenarios together with assumptions ensuring that a causally relevant quantity can be estimated from the available data in Table 1; scenario 1 corresponds to the one discussed in the present Section.

# 4 Bias due to violation of conditions (i) and (ii)

We consider simple settings where Conditions (i) and (ii) are violated and derive the corresponding bias expressions. We illustrate such bias in a simulation in Section 8.

First assume that the relationships among the variables follow the models below, for z ∈{0, 1}: P(T = 1|Z = z) = exp(α1 + βz),

(3) P(T = 2|Z = z) = exp(α2).

(4) Condition (i) holds. However if α1 ≠α2, then P(T Z=0 = 1) ≠P(T Z=0 = 2) and Condition (ii) does not hold. In that case we have

<!-- p.5 begins here -->

P(T = 2|T ≠3, Z = 1) = exp(β) × exp(α[^1])

P(T = 1|T ≠3, Z = 1) exp(α2) ≠exp(β). The term exp(α[^1]) exp(α2) ≠1 represents the relative change in the baseline risk of an event between period 1 and period 2. In other words, we are not able to disentangle the effect of the vaccine from the variation in the baseline risk between the two time periods.

Now, assume the relationships among the variables follow the models below, for z ∈{0, 1}: P(T = 1|Z = z) = exp(α + βz),

(5) P(T = 2|Z = z) = exp(α + β2z).

(6) Condition (ii) holds. However, if β2 ≠0, the transient risk extends to period 2. In that case P(T Z=0 = 2) ≠P(T Z=1 = 2), Condition (i) does not hold, and we have

P(T = 2|T ≠3, Z = 1) = exp(β)

P(T = 1|T ≠3, Z = 1) exp(β2) ≠exp(β).

# 5 Plausibility of Conditions (i) and (ii)

We now discuss practical settings where Conditions (i) and (ii) may be violated.

## 5.1 Long-term effect

Suppose the time after which Z no longer has an effect is not known, or that we have misunderstood the latency and Z has a long term harmful effect on T. See for example the setting defined by Equations (5) and (6) in Section 4 with β = β2 > 0. In that case, period 2 is poorly chosen and Condition (i) does not hold.

## 5.2 Acceleration effect

In their study of intussception following rotavirus vaccination, Murphy et al. [4] suggested that the vaccine could accelerate the adverse events from period 2 to period 1, and thus the increased number of cases in period 1 is balanced by a decrease in period 2. In their analysis, period 1 started at infants vaccination at 6 months, and lasted for three weeks. In other words, P(T Z=1 = 1) > P(T Z=0 = 1), P(T Z=1 = 2) < P(T Z=0 = 2), and P(T Z=0 = 3) = P(T Z=1 = 3). Condition (i) is thus violated. As a remark, if the vaccine causes intussusception only in individuals who were destined to develop it at a later time, one could argue that it is not truly harmful. This illustrates the importance of clearly defining the question, and thus the ratio, of causal interest. Indeed, if it were possible, one could compare the risk in period 1 under do(Z = 1) and do(Z = 0) and this would suggest a harmful effect of the rotavirus vaccine, whereas comparing period 2 would suggest a protective effect, and comparing period 1 + period 2 would suggest a null effect. These three ratios target different causal effects (i.e., causal effect of the vaccine over different time periods). Clearly, if one is interested in the overall effect of the vaccine in infants aged <1 year, the “risky” period should be 0 −1 year, not less. But because intussception usually happens within the first year of life absent vaccination [4], the baseline risk of the adverse event is probably not the same before and after 1 year. Therefore we believe the SCCS design is not well suited for such an investigation, unless one knows the ratio of baseline risks for the two time periods.

<!-- p.6 begins here -->

6

## 5.3 Risk factors

We define a risk factor as a variable that affects T but not Z. As an illustration, let the exposure be a Human Papillomavirus vaccine proposed through a national school vaccine program to be implemented in, say, October, and let the rare adverse event be GBS. It is known that viral infections such as influenza are risk factors for the development of GBS [12, 13]. We argue that Condition (ii) is unlikely to hold if the incidence of such a viral infection is, say, higher in period 2. Let Ut be a risk factor, the indicator of an influenza infection in period t, t ∈{1, 2}. We assume the following temporal ordering of the variables: Z, U1, U2, T, as in Figure 2B. More precisely for any z ∈{0, 1} and possible values u1 of U1 and u2 of U2, we assume P(T = 1|Z = z, U1 = u1) = exp{α + β1z + k(u1)}, P(T = 2|Z = z, U2 = u2) = exp{α + k(u2)}, with Ut independent of Z, t ∈{1, 2}, and k a nonconstant function. Letting α1 ≡EU1[exp{α + k(U1)}] and α2 ≡EU2[exp{α + k(U2)}], we can write P(T = 1|Z = z) = exp(α1 + β1z) and P(T = 2|Z = z) = exp(α2). If the incidence of influenza is higher in period 2, EU2(U2) > EU1(U1). Then, α1 ≠α2, the baseline risk of an event is not identical in period 1 and period 2, and Condition (ii) does not hold. Salmon et al. noted such a bias and called it “confounding by seasonality” [11], but here it arises from a risk factor. We discuss confounders in Section 7, and we discuss another setting with a risk factor tied to the exposure in Section S3 of the supplementary material.

# 6 Strengthening the study with additional data

As a reminder, under the SCCS design one usually only has access to data on the exposed cases. In this Section we discuss how having additional data (e.g., on unexposed cases) could strengthen inference.

First, if in addition to data on the exposed cases we also had data on the unexposed cases (see e.g., Supplementary Table 1B) we could test if Condition (ii) holds, as indeed

P(T Z=[^0] = 1|T Z=[^0] ≠3) = P(T Z=[^0] = 2|T Z=[^0] ≠3) ⇒P(T Z=[^0] = 1) = P(T Z=[^0] = 2). We could still not test if Condition (i) holds, however, as

P(T Z=[^1] = 2|T Z=[^1] ≠3) = P(T Z=[^0] = 2|T Z=[^0] ≠3) ⇏P(T Z=[^1] = 2) = P(T Z=[^0] = 2). Having data on the unexposed cases would also allow estimation of P(T=[^1]|T≠[^3],Z=[^1]) P(T=1|T≠3,Z=0). This contrast is usually not causally relevant as it equals exp(β) × P(T Z=[^0]=[^1])+P(T Z=[^0]=[^2]) P(T Z=1=1)+P(T Z=1=2), but it could be used to circumvent Condition (ii). Indeed, this contrasts measures the relative change in the baseline risk of the event between the two time periods. For example, assume that the relationships among the variables are as in Equations (3) and (4) in Section 4, with α1 ≠ α2, so that Condition (i) holds but Condition (ii) is violated. We have P(T=[^1]|T≠[^3],Z=[^1]) P(T=[^2]|T≠[^3],Z=[^1]) = exp(β) × exp(α[^1]) exp(α2), and because P(T=[^2]|T≠[^3],Z=[^0]) = exp(α[^1]) P(T=1|T≠3,Z=0) exp(α2), P(T=[^1]|T≠[^3],Z=[^1])

P(T=[^2]|T≠[^3],Z=[^1]) × P(T=[^2]|T≠[^3],Z=[^0]) P(T=[^1]|T≠[^3],Z=[^0]) thus coincides with the causal risk ratio in Equation (1); see scenario 2 in Table 1. In other words, because data on the unexposed cases would allow to quantify the change in the baseline risk between the two time periods, we could disentangle the effect of the vaccine from the variation in the baseline risk. But it is actually challenging to find an appropriate sample of unexposed cases. A randomized vaccine trial would be an ideal source because t = 0 is well defined for the unvaccinated group. There will probably be too few cases with a rare adverse event such as GBS, however. Instead one might turn to a national registry of patients with GBS to look for unvaccinated cases, but there is no well-defined t = 0 for them. A workaround would be to randomly match each vaccinated case in the SCCS data to an unvaccinated case from the registry with same age (and possibly other characteristics; see Section 7). The unvaccinated cases would be assigned the time of vaccination of their matched vaccinated case as t = 0, and one could then estimate P(T = 1|T ≠3, Z = 0) and P(T = 2| T ≠3, Z = 0) based on the number of unvaccinated cases in period 1 and in period 2.

<!-- p.7 begins here -->

On the other hand, with data on exposed cases and exposed non-cases, we could estimate P(T Z=1 = 1) and P(T Z=1 = 2). However, we would still not be able to test Conditions (i) and (ii). To test if (i) and (ii) hold, one would need data on the exposed cases and non-cases, and unexposed cases and non-cases. But then one could simply use the full cohort data to estimate exp(β) directly from P(T Z=1 = 1) and P(T Z=0 = 1) and would not need these Conditions.

# 7 Confounders

## 7.1 Notation

Confounding variables, i.e., variables that affects both Z and T, have not been mentioned so far. In this Section and the following, we let W denote the possibly multivariate confounding variable, and ΩW denote its space of possible values. We assume W, Z, T are ordered temporally, as in Figure 2C. For example in Salmon et al. [11], W contains demographics. The setting of Figure 2A is the special case with W = ∅.

In general, with full cohort data (i.e., with data on exposed and unexposed cases and non-cases) but without measurements on the confounders comprising W, even if the identifiability conditions given in Section S1 of the supplementary material hold, exp(β) in Equation (1) cannot be estimated without bias. However, the SCCS analysis should yield unbiased estimates if the unmeasured confounders are time-fixed and have a multiplicative effect on the risk [5–8, Chapters 22]. We will discuss this point below. But first note that in a setting such as the one in Figure 2C, in addition to the marginal causal risk ratio in Equation (1), one could also be interested in stratum-specific (or conditional) causal risk ratio

P(TZ=[^1] = 1|W = w)

P(TZ=[^0] = 1|W = w) ≡exp(βW=w), w ∈ΩW.

(7) Variation in exp(βW = w) across strata of W can indicate subgroups with varying degrees of risk. We say that the effect is homogeneous across strata of W if exp(βW = w) = exp(β) for any possible values w of W. Second, note that under the setting of Figure 2C, the marginal causal risk ratio in Equation (1) and the causal risk ratio in the treated in Equation (2) do not coincide; see Section S1 of the supplementary material for details.

## 7.2 Sufficient conditions for counterfactual estimands

Again, we assume adverse events are only reported by individuals who were exposed, i.e., we only have data on individuals with T ≠3 and Z = 1 (see e.g., Supplementary Table 2A). Therefore, we cannot estimate P(T Z=z = t) or P(T Z=z = t|W = w), z ∈{0, 1}, t ∈{1, 2}, w ∈ΩW, and cannot estimate quantities of causal interest in Equations (1), (2), or (7), without making further assumptions.

With the available data we can estimate P(T=[^1]|T≠[^3],Z=[^1]) P(T=2|T≠3,Z=1), but as illustrated by the following example, it does not necessarily coincides with the marginal causal risk ratio in Equation (1). Assume for any z ∈{0, 1} and possible values w of W:

P(T = 1|Z = z, W = w) = exp{α + β1z + g(w) + zh(w)},

(8) P(T = 2|Z = z, W = w) = exp{α + g(w)}.

(9) Observe that Conditions (i) and (ii) hold. Yet, the contrast estimated in practice

<!-- p.8 begins here -->

8 P(T = 2|T ≠3, Z = 1) = exp(β[^1]) × EW|Z=[^1][exp{g(W) + h(W)}]

P(T = 1|T ≠3, Z = 1)

(10) EW|Z=1[exp{g(W)}] may differ from exp(β) ≡P(TZ=[^1] = 1) P(TZ=[^0] = 1) = exp(β[^1]) × EW[exp{g(W) + h(W)}] , EW[exp{g(W)}] as indeed the distribution of W varies between the exposed and general populations.

With data on exposed cases only and if P(T = t|W = w, Z = 1) > 0, t ∈{1, 2} and w ∈ΩW, we can also estimate P(T=2|T≠3,W=w,Z=1), w ∈ΩW. We know P(T=[^1]|T≠[^3],W=w,Z=[^1]) P(T=1|T≠3,W=w,Z=1) P(T=[^2]|T≠[^3],W=w,Z=[^1]) = P(TZ=[^1]=[^1]|W=w) P(TZ=1=2|W=w), under the setting of Figure 2C; see Section S2 of the supplementary material. Thus when conditional versions of Conditions (i) and (ii) hold within strata of W (i.e., when Conditions (i)W and (ii)W below hold), the stratum-specific contrasts estimated in practice coincide with the stratum-specific causal risk ratios in Equation (7) and have a clear causal meaning. Conditional (or stratum-specific) versions of Conditions (i) and (ii): (i)W Within strata of W, Z no longer has an effect after period 1: ∀w ∈ΩW, P(TZ=[^1] = 2|W = w) = P(TZ=[^0] = 2|W = w). (ii)W Within strata of W, the baseline risk of the event is the same in the two time periods: ∀w ∈ΩW, P(T Z=[^0] = 1|W = w) = P(TZ=[^0] = 2|W = w). For example, in the setting defined by Equations (8) and (9) above, Conditions (i)W and (ii)W hold and we have P(T=[^2]|T≠[^3],W=w,Z=[^1]) = exp{β[^1] + h(w)}, and this contrast indeed coincides with exp(βW=w) ≡P(TZ=[^1]=[^1]|W=w) P(T=1|T≠3,W=w,Z=1) P(TZ=0=1|W=w), w ∈ΩW.

In addition, P(T=[^1]|T≠[^3],Z=[^1])

P(T=[^2]|T≠[^3],Z=[^1]) coincides with ∑w∈ΩW P(TZ=[^1]=[^2]|W=w)P(W=w|Z=[^1]) under the setting of Figure 2 C; see Section ∑w∈ΩW P(TZ=[^1]=1|W=w)P(W=w|Z=1) S2 of the supplementary material. Thus when Conditions (i)W and (ii)W hold, the marginal contrast estimated in practice coincides with the causal risk ratio in the treated in Equation (2) and also has a clear causal meaning.

## 7.3 Implications

Under the setting of Figure 2C, if Conditions (i)W and (ii)W hold, then from data on the exposed cases only we can estimate the stratum-specific parameter of causal interest βW = w in Equation (7) for any value w of W such that P(T = t|Z = 1, W = w) > 0, t ∈{1, 2}; see scenario 3 in Table 1. If the effect of Z on T is homogeneous across strata of W (for example if h = 0 in Equations (8) and (9) above), then the marginal causal risk ratio coincides with the stratum-specific causal risk ratio and with the causal risk ratio in the treated. In that case, we could use the marginal (or unconditional) contrast P(T=[^1]|T≠[^3],Z=[^1])

P(T=[^2]|T≠[^3],Z=[^1]) to estimate β in Equation (1) directly and confounder W does not need to be measured; see scenario 5.a in Table 1. If the effect of Z on T is heterogeneous across strata of W, we cannot in general estimate exp(β), however; see the example using Equations (8) and (9) above and Section S4.2 of the supplementary material. But in the presence of exposure heterogeneity the marginal contrast P(T=[^1]|T≠[^3],Z=[^1]) P(T=[^2]|T≠[^3],Z=[^1]) estimated in practice still has a clear causal meaning as it coincides with the causal risk ratio in the treated defined in Equation (2); see scenario 5.b in Table 1.

## 7.4 Plausibility of the conditions

Similar derivations and comments as in Sections 4, 5, and 6, can be made in the setting of Figure 2C by conditioning on W. Notably, violation of Conditions (i)W and/or (ii)W would preclude unbiased estimation of βW = w and βZ = 1. As

<!-- p.9 begins here -->

a remark, although it is mathematically possible, there should not be practical situations where Conditions (i) and (ii) hold but Conditions (i)W and (ii)W do not.

There is another practical setting where Condition (ii)W, and therefore Condition (ii), could be violated. Suppose the probability of getting vaccinated depends on age at time t = 0 and the event risk changes with age. Assume that the relationships among the variables follow the models below, for any z ∈{0, 1} and w ∈ΩW:

P(T = 1|Z = z, W = w) = exp{α1 + βz + g1(w)},

(11) P(T = 2|Z = z, W = w) = exp{α2 + g2(w)},

(12) where W is age at time t = 0 and g1 ≠g2. For example, in the association between the Measles, Mumps and Rubella vaccine and the rare adverse event of autism [14, 15], age modulates the period-specific baseline risks and Condition (ii)W usually does not hold. A naive analysis would incorrectly infer an elevated risk of autism following vaccination.

# 8 Simulation studies

In this Section, we illustrate how violation of Conditions (i) and (ii) preclude unbiased estimation of quantities of causal interest such as the ones in Equations (1), (2), or (7).

## 8.1 First setting

For each of the two scenarios illustrating violation of Conditions (i) or (ii), we generate 5,000 replicated populations with n = 10[^6] individuals under the setting of Figure 2C with univariate W. We simulate confounder W taking values in ΩW = {0, 1} such that P(W = 1) ≡pW, and binary exposure Z such that P(Z = 1|W = w) ≡pZ|W = w, w ∈ΩW. We simulate the time to event outcome T taking values in {1, 2, 3} such that

P(TZ=z = t|W = w) = P(T = t|Z = z, W = w) = exp(αt + βtz + γtw + ηtwz), t ∈{1, 2}, z ∈{0, 1} and w ∈ΩW. The SCCS data consists of the observations from individuals with Z = 1 and T ≠3, and the contrasts estimated in practice are exp(α1 + β1) { exp(γ1+η1)pZ|W=1pW +pZ|W=0(1−pW ) }

P(T = 1|T ≠3, Z = 1) pZ|W=1pW +pZ|W=0(1−pW )

P(T = 2|T ≠3, Z = 1) = exp(α2 + β2) { exp(γ2+η2)pZ|W=1pW +pZ|W=0(1−pW ) } pZ|W=1pW +pZ|W=0(1−pW ) or

P(T = 2|T ≠3, W = w, Z = 1) = exp(α[^1] + β[^1] + γ[^1]w + η[^1]w)

P(T = 1|T ≠3, W = w, Z = 1) exp(α2 + β2 + γ2w + η2w). Scenario 1: violation of Condition (i) due to long term harmful effect of Z The parameter values we consider are pW = 0.6, pZ|W = 0 = 0.35, pZ|W = 1 = 0.2, α1 = α2 = log(0.00006), β1 = 0.6, β2 ∈0, β1

[

], γ1 = γ2 = 0.6, η1 = 0.2 and η2 ∈{0, 0.1, 0.2}. The baseline risk of the event is the same in periods 1 and 2 (α1 = α2 and γ1 = γ2). Thus when β2 = η2 = 0, Conditions (i)W and (ii)W, and thus Conditions (i) and (ii), are satisfied. But when β2 > 0 and/or η2 > 0, Condition (i)W, and thus Condition (i), is violated because we misunderstood the latency of Z and there still is an elevated risk of the event in period 2. In addition, βW=1 = 0.8, βW=0 = 0.6, β ≈0.738, and βZ=1 ≈0.712, and Z is harmful. On average over the 5,000 replications when β2 = η2 = 0, 55 individuals are included in the SCCS data. In Figure 3 we focus on the logarithm of the marginal contrast and of the two stratum-specific contrasts estimated with the SCCS data. They are biased when β2 > 0 or η2 > 0, and the bias increases with

<!-- p.10 begins here -->

10 Figure 3: Simulation results of scenario 1 in Section 8.1, over 5,000 replications. Conditions (i)W and (ii)W, and thus Conditions (i) and (ii), are satisfied when β2 = η2 = 0. The contrast estimated in practice does not clearly relate to any quantities of causal interest when β2 ≠0 or η2 ≠ 0 because Condition (i)W is violated. the elevation of risk of the event in period 2 (i.e., with β2 and with η2). In particular, for β2 = β1, the contrast for stratum W = 0 tends to wrongly suggest a null effect of Z. As a remark, there is a small sample bias when β2 = η2 = 0 but this goes away with larger populations; see Section S4.2 of the supplementary material where we consider populations with n = 5 × 10[^6] and n = 10[^7] individuals. Scenario 2: violation of Condition (ii) due to a variation in the baseline risk between period 1 and period 2 The parameter values we consider are pW = 0.6, pZ|W = 0 = 0.35, pZ|W = 1 = 0.2, α1 = log(0.00004), α2 ∈α1, log(0.00010) [ ], β1 = 0.3, β2 = 0, γ1 = 0.2, γ2 ∈{γ1, 0.3, 0.4}, and η1 = η2 = 0. Z does not have an effect on T in period 2 (β2 = η2 = 0). Thus when α1 = α2 and γ1 = γ2, Conditions (i)W and (ii)W, and thus Conditions (i) and (ii), are satisfied. On the other hand, when α1 ≠α2 and/or γ1 ≠γ2, Condition (ii)W, and thus Condition (ii), is violated as there is a variation in the baseline risk of the event between period 1 and period 2. In addition, βW=1 = βW=0 = β = βZ=1 = 0.3, and Z is harmful. On average over the 5,000 replications when α1 = α2 and γ1 = γ2, 27 individuals are included in the SCCS data. Because the effect of Z is homogeneous across strata, in Figure 4 we focus on the logarithm of the marginal contrast estimated with the SCCSdata. Itisbiasedwhen α1 ≠α2 orγ1 ≠γ2, and the biasincreasesasthedifference between thebaseline risk ofthe event in period 1 and period 2 increases. The quantity estimated in practice even tends to suggest a protective effect of Z when α2 > β + α1 + log { exp(γ1)pZ|W=1pW+pZ|W=0(1−pW) }, i.e., when γ2 = γ1 and α2 > −9.826, or γ2 = 0.3 and α2 > −9.879, or exp(γ2)pZ|W=1pW+pZ|W=0(1−pW) γ2 = 0.4 and α2 > −9.934.

## 8.2 Setting with acceleration effect

As a reminder, in such a setting the vaccine accelerates the development of adverse events from period 2 to period 1 and does not cause de novo harm (see Sections 3 and 5.2). We generate 5,000 replicated populations with n = 10[^6] individuals. We assume W = ∅and simulate binary exposure Z such that P(Z = 1) = 0.3. We simulate T Z=0 the time to event outcome in the counterfactual world where Z would have been set to 0 as taking values in {1, 2, 3} and such that P(TZ=[^0] = t) = P(T = t|Z = 0) = exp(α), t ∈{1, 2},

<!-- p.11 begins here -->

Figure 4: Simulation results of scenario 2 in Section 8.1, over 5,000 replications. Conditions (i)W and (ii)W, and thus Conditions (i) and (ii), are satisfied when α2 = α1 and γ2 = γ1. The contrast estimated in practice does not clearly relate to any quantities of causal interest when α2 ≠α1 or γ2 ≠γ1 because Condition (ii)W is violated. Figure 5: Simulation results of the scenario with Acceleration Effect in Section 8.2, over 5,000 replications. Conditions (i) and (ii) are satisfied when P(T Z=1 = 1|T Z=0 = 2) = 0. The contrast estimated in practice does not clearly relate to any quantities of causal interest when P(T Z=1 = 1|T Z=0 = 2) ≠0 because Condition (i) is violated. The log causal risk ratio over period 1 is defined as log { P(TZ=[^1]=1) }, the log causal risk ratio over P(TZ=[^0]=1) P(TZ=[^1]=2) period 2 is defined as log { P(TZ=[^0]=2) }, the log causal risk ratio over periods 1 and 2 is defined as log { P(TZ=[^1]=1)+P(TZ=[^1]=2) }. P(TZ=[^0]=1)+P(TZ=[^0]=2) with α = log(0.00008). We simulate T Z=1 such that P(T Z=1 = 1|T Z=0 = 1) = 1, P(T Z=1 = 3|T Z=0 = 3) = 1, and P(TZ=[^1] = 1|TZ=[^0] = 2) ∈0, 0.2

[

]. The SCCS data consists of the observations from individuals with Z = 1 and T ≠3. On average over the 5,000 replications, 48 individuals are included in the SCCS data. The acceleration effect does not occur when P(T Z=1 = 1|T Z=0 = 2) = 0, but it does and Condition (i) is violated when P(T Z=1 = 1|TZ=0 = 2) > 0, because

P(T Z=1 = 2) < P(T Z=0 = 2). In Figure 5 we focus on the logarithm of P(T=[^1]|T≠[^3],Z=[^1]) P(T=[^2]|T≠[^3],Z=[^1]) estimated with the SCCS data. It is biased when P(T Z=1 = 1|T Z=0 = 2) > 0, and the bias increases with P(T Z=1 = 1|T Z=0 = 2). In Figure 5, we also display the true value of the logarithm of the causal risk ratio over period 1, over period 2, and over periods 1 and 2. As mentioned in Section 5.2, they all answer different causal questions and thus differ when P(T Z=1 = 1|T Z=0 = 2) > 0.

<!-- p.12 begins here -->

12

# 9 Data illustration

We use a study of GBS following H1N1 vaccination [11]. Salmon et al. used the proportion of vaccinated individuals who experienced GBS during the “risky” period to estimate the probability of the event occurring in period 1 rather than in period 2. They mentioned confounders (e.g., demographics) but did not specify patient-specific characteristics and only showed marginal numbers of events. Thus, they seemed to assume that the effect of Z is homogeneous across strata of W. Then, to ensure that Z no longer had an effect on T in the control period, they considered a “washout period” after period 1. In other words, period 2 did not follow period 1 directly so that Condition (i)W is likely to hold; see Figure 1. Finally, they assumed no “confounding by seasonality” due to viral infections so that Condition (ii)W is also likely to hold.

Following Sections 3 and 7, if Conditions (i)W and (ii)W hold and there is no interaction between Z and W, then we can estimate the causal effect of Z on T through contrast P(T=[^1]|T≠[^3],Z=[^1]) P(T=2|T≠3,Z=1). According to Table 2 in Salmon et al. [11], P̂(T = 1|T ≠3, Z = 1) =

[^54]+[^23] = 0.701, P̂(T = 2|T ≠3, Z = 1) = [^54]+[^23] = 0.299. Thus exp(β̂) = 2.348 (95 % confidence interval = [1.202, 3.493]) and the data suggests an increased risk of GBS following H1N1 vaccination. As a remark, as they only had data on the exposed cases, Salmon et al. then used baseline rates (that they called “background” rates) from the literature to compute the attributable risk of excess cases of GBS per million vaccinations; this is like having data on unexposed cases.

Condition (ii)W could be violated if influenza also increases the risk of GBS; see Sections 5. To assess potential bias due to seasonality of viral infections, Salmon et al. also removed individuals with influenza symptoms. However, Salmon et al. [11] emphasized that if influenza symptoms are also caused by the H1N1 vaccine, such a stratification on influenza symptoms could block part of the effect of the vaccine on GBS. We also believe this could create a spurious association between the vaccine and influenza infection [16]; see Figure 2D.

# 10 Discussion

We translated key assumptions for the SCCS design using a counterfactual notation, through Conditions (i) and (ii). However, these conditions often cannot be tested from the available data (Sections 3). External data could be used to strengthen the inference, but practical issues may arise and Condition (i) stays untestable (Section 6). The SCCS literature seemed to suggest that variables modulating the period-specific baseline risks should not be an issue as long as they are observed [5–8, Chapter 22]. Yet, we saw that when Conditions (ii) is violated and without knowledge of the ratio of baseline risks for the two time periods, the quantity estimated in practice does not have a clear causal meaning (Sections 4 and 6). More generally, if Condition (i) and/or Condition (ii) do not hold, the marginal contrast estimated in practice usually does not coincide with quantities of causal interest such as the marginal causal risk ratio (Sections 4 and 8). We described practical settings where Conditions (i) or (ii) may fail (Section 5). Notably, they can be invalid if risk-factors modulate the period-specific baseline risks. In the presence of a confounder W as under the setting of Figure 2C, one may need a stratum-specific version of the Conditions, namely Conditions (i)W and (ii)W, to estimate causally relevant quantities (Sections 7 and 8). In addition, the marginal causal risk ratio might not be estimable, unless the exposure effect is homogeneous across strata of W. In presence of heterogeneity when Conditions (i)W and (ii)W hold, the marginal contrast estimated in practice will have a clear causal meaning, however, as it coincides with the causal risk ratio in the treated. We summarized the sets of sufficient assumptions in Table 1.

The SCCS design is subject to other sources of bias. First, even for serious adverse events such as GBS, we cannot expect all events to be reported. If the probability of reporting the event varies across values of W, the study population may not be representative of the target population, but the estimated stratum-specific contrasts will have a clear causal meaning. However, the event ascertainment probability could also depend on T, for example if the probability of reporting the event decreases from study entry time to end of follow-up, as one may more easily relate the adverse event to the vaccine if it happened not long after vaccination. Then, there will be an under-representation of exposed individuals with an event in period 2, and in this situation akin to detection bias,

<!-- p.13 begins here -->

one could falsely declare a harmful effect of the vaccine; see Section S4.1 of the supplementary material. Furthermore, cases could misreport their date of vaccination and artificially increase the number of events in period 1. However, in the VSD or VAERS [1, 2], reports are filled by health providers and information on the date of vaccination and event should be more accurate. Finally, other events could prevent individuals from reporting their adverse event (e.g., moving to a different country), or preclude its occurrence (e.g., death). Practically speaking, we assume that censoring and competing events are rare enough to be ignored. But just as with detection bias, the quantity estimated in practice could be misleading if censoring depends on T or if the vaccine also transiently increases the risk of competing events.

In summary, we have discussed sufficient conditions for valid causal interpretation under the SCCS design and related threats to validity. When Conditions (i) and (ii) are violated, the quantities estimated from data on exposed cases usually do not have a clear causal meaning. Because these conditions are restrictive and usually untestable, the quantities estimated in practice should be interpreted with caution. Acknowledgments: We are grateful to Micheal Fay at the Biostatistics Research Branch, National Institute of Allergy and Infectious Diseases, and to the anonymous Reviewer, for valuable feedback and suggestions. This work utilized the computational resources of the NIH HPC Biowulf cluster. Funding Information: This work was supported by the Intramural Research Program of the Division of Cancer Epidemiology and Genetics, National Cancer Institute, National Institutes of Health. Author Contributions: All authors have accepted responsibility for the entire content of this manuscript and approved its submission. Original idea, D.F.; Conceptualization, L.E.; Original draft preparation, L.E.; Draft review and editing, L.E., D.F., M.H.G. Conflict of Interest: The authors state no conflict of interest. Data Availability: No data pertain to this work. R code used for the simulation is available on GitHub at https:// github.com/Etievant/SCCS. Supplementary Materials: See Supplementary Materials available online at https://www.degruyter.com/ for additional details and simulation studies.

# Notes

<!-- Footnotes, printed at the foot of p. 1, p. 2, p. 3. Lifted here because they fall inside a sentence that runs across the page break. -->

*Corresponding author: Lola Etiévant, Biostatistics Branch, Division of Cancer Epidemiology and Genetics, National Cancer Institute, National Institutes of Health, 9609 Medical Center Drive, Rockville, MD, 20850, USA, E-mail: lola.e.etievant@gmail.com Mitchell H. Gail, Biostatistics Branch, Division of Cancer Epidemiology and Genetics, National Cancer Institute, National Institutes of Health, 9609 Medical Center Drive, Rockville, MD, 20850, USA Dean Follmann, Biostatistics Research Branch, Division of Clinical Research, National Institute of Allergy and Infectious Diseases, National Institutes of Health, 5601 Fishers Lane, Rockville, MD, 20892, USA Figure 1: Distribution of Guillain Barré Syndrome (GBS) events following Influenza A 2009 Monovalent vaccination, from Salmon et al. [11]. The blue line indicates period 1 (1–42 days), the red line indicates period 2 (50–91 days), and the dashed gray line indicates the washout period. Figure 2: Causal graphs depicting the relationships among the variables in A – The general setting. B – The general setting, when risk factor Ut is also depicted. C – The general setting with confounder W. D – The setting in Section 9 where an association between H1N1 vaccination (Z) and influenza (I) could be induced by conditioning on influenza symptoms (S).

<!-- Back matter, kept for the reader (the author's ruling, 15 Sep 2026): reference lists and their kin stay in the file; the extraction prompt is trimmed from the first back-matter heading below. -->

# References

1. CDC. Vaccine safety datalink. https://www.cdc.gov/vaccinesafety/ensuringsafety/monitoring/vsd/index.html.

2. CDC & FDA. Vaccine adverse event reporting system. https://vaers.hhs.gov/.

3. Hanson KE, Goddard K, Lewis N, Fireman B, Myers TR, Bakshi N, et al. Incidence of Guillain-Barré Syndrome after COVID-19 vaccination in the vaccine safety datalink. JAMA Netw Open 2022;5:e228879.

4. Murphy BR, Morens D, Simonsen L, Chanock R, La Montagne J, Kapikian A. Reappraisal of the association of intussusception with the licensed live rotavirus vaccine challenges initial conclusions. J Infect Dis 2003;187:1301–8.

5. Farrington PC. Relative incidence estimation from case series for vaccine safety evaluation. Biometrics 1995;51:228–35.

6. Farrington PC, Whitaker HJ. Semiparametric analysis of case series data. J R Stat Soc Series C (Applied Statistics) 2006;55:553–94.

7. Whitaker HJ, Farrington PC, Spiessens B, Musonda P. Tutorial in biostatistics: the self-controlled case series method. Stat Med 2006;25: 1768–97.

8. Borgan O. Handbook of statistical methods for case-control studies. CRC Press; 2018.

9. Maclure M. The case-crossover design: a method for studying transient effects on the risk of acute events. Am J Epidemiol 1991;133: 144–53.

10. Shahn Z, Hernán MA, Robins JM. A formal causal interpretation of the case-crossover design. Biometrics 2022;79:1330–43.

11. Salmon DA, Proschan M, Forshee R, Gargiullo P, Bleser W, Burwen DR, et al. Association between Guillain-Barré syndrome and influenza A (H1N1) 2009 monovalent inactivated vaccines in the USA: a meta-analysis. Lancet (London, England) 2013;381:1461–8.

12. Grimaldi-Bensouda L, Alperovitch A, Besson G, Vial C, Cuisset JM, Papeix C, et al. Guillain-Barré Syndrome, influenzalike illnesses, and influenza vaccination during seasons with and without circulating A/H1N1 viruses. Am J Epidemiol 2011;174:326–35.

13. Tam C, O’Brien SJ, Petersen I, Islam A, Hayward A, Rodrigues LC. Guillain-Barré Syndrome and preceding infection with campylobacter, Influenza and Epstein-Barr virus in the general practice research database. PLoS One 2007;2:e344.

14. Farrington PC, Miller E, Taylor B. MMR and autism: further evidence against a causal association. Vaccine 2001;19:3632–5.

14

15. CDC. Measles, Mumps, and Rubella (MMR) vaccination. https://www.cdc.gov/vaccines/vpd/mmr/public/index.html.

16. Jiang T, Smith ML, Street AE, Seegulam VL, Sampson L, Murray EJ, et al. A comorbid mental disorder paradox: using causal diagrams to understand associations between posttraumatic stress disorder and suicide. Psychol Trauma: Theory, Research, Practice, Policy 2021;13: 725–9.

Supplementary Material: This article contains supplementary material (https://doi.org/10.1515/jci-2024-0074).

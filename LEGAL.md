# Legal Notices

> This document does not constitute legal advice. Consult qualified counsel in the relevant jurisdictions for binding guidance.

---

## 1. General Disclaimer

THE CLAUDE DEV FRAMEWORK IS A DEVELOPMENT WORKFLOW TOOL PROVIDED "AS IS" UNDER THE MIT LICENSE. IT IS NOT A COMPLIANCE CONTROL, SECURITY TOOL, OR QUALITY ASSURANCE SYSTEM. THE FRAMEWORK DOES NOT GUARANTEE THE QUALITY, SECURITY, CORRECTNESS, LEGAL COMPLIANCE, OR FITNESS FOR ANY PARTICULAR PURPOSE OF SOFTWARE DEVELOPED WHILE USING IT. USE OF THIS FRAMEWORK DOES NOT SATISFY ANY REGULATORY, LEGAL, OR CONTRACTUAL REQUIREMENT FOR SOFTWARE DEVELOPMENT PROCESS CONTROLS.

## 2. AI-Generated Code Notice

Software developed using this framework is generated in whole or in part by Anthropic's Claude, a large language model. AI-generated code may not be eligible for copyright protection under US law (see US Copyright Office guidance on AI-generated works, March 2026). AI-generated code may contain patterns derived from the model's training data, which may include code under various open source licenses including copyleft licenses (GPL, AGPL). Users are solely responsible for:

- (a) Determining the intellectual property status of AI-generated code
- (b) Conducting license compliance scanning before distributing AI-generated code in proprietary products
- (c) Conducting patent clearance reviews where appropriate
- (d) Complying with Anthropic's terms of service regarding output ownership and usage restrictions

## 3. Data Transmission Warning

This framework operates within Anthropic's Claude Code, which transmits project file contents, terminal output, and developer interactions to Anthropic's API servers for processing. Users must ensure that:

- (a) Confidential, trade secret, or NDA-protected code is not exposed to Claude Code without appropriate authorization
- (b) Data processing agreements are in place with Anthropic where required by applicable privacy regulations (GDPR, CCPA, HIPAA)
- (c) Cross-border data transfer requirements are satisfied for applicable jurisdictions

## 4. Regulatory Notice

This framework's use of "compliance" refers exclusively to internal workflow discipline (adherence to the framework's own development process rules). It does not refer to, and does not satisfy, legal or regulatory compliance requirements including but not limited to: HIPAA, PCI-DSS, SOX, GDPR, FedRAMP, FISMA, FDA SaMD regulations, ISO 26262, DO-178C, IEC 62304, EU AI Act, or any other regulatory framework. Organizations subject to regulatory requirements must implement appropriate controls independently of this framework.

## 5. Safety-Critical Systems Prohibition

This framework MUST NOT be used for the development of safety-critical software subject to ISO 26262 (automotive), DO-178C (aerospace), IEC 62304 (medical devices), IEC 61508 (industrial), or equivalent functional safety standards. AI-generated code is non-deterministic and non-reproducible, which is fundamentally incompatible with current safety certification processes.

## 6. Employment and Monitoring Notice

This framework logs developer activity (session events, tool invocations, approval actions) in local audit files. In some jurisdictions, this may constitute employee monitoring subject to notification requirements, consent obligations, or works council consultation rights. Organizations deploying this framework on employer-managed systems should consult employment counsel in the relevant jurisdictions.

## 7. Third-Party Dependencies

This project uses open source dependencies under the following license families:

| License | Count | Copyleft? |
|---------|-------|-----------|
| MIT | 154 | No |
| ISC | 24 | No |
| Apache-2.0 | 10 | No |
| BlueOak-1.0.0 | 10 | No |
| BSD-3-Clause | 3 | No |
| LGPL-3.0-or-later | 1 | Yes (weak) |
| Unlicense / 0BSD | 3 | No |
| CC-BY-4.0 | 1 | No |

**LGPL note:** `@img/sharp-libvips-darwin-arm64` (v1.2.4) is LGPL-3.0-or-later. This is a native image processing library used by `sharp` at build time for icon/splash generation. It is not bundled in the distributed iOS application binary. LGPL permits use as a dynamically linked library without copyleft propagation; since it is only used during the build process and not distributed, it does not affect the application's license.

See `THIRD-PARTY-LICENSES.txt` for the complete dependency license inventory.

## 8. Framework and Plugin Licenses

| Component | License | Copyright |
|-----------|---------|-----------|
| Claude Dev Framework v3.0.0 | MIT | Copyright (c) 2026 Karl Raulerson |
| Superpowers plugin v5.0.7 | MIT | Copyright (c) 2025 Jesse Vincent |
| jq (runtime dependency) | MIT | Copyright (c) 2012 Stephen Dolan |

---

*Last updated: 2026-04-02*

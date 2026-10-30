# Design asset provenance

This package includes only the approved SolarWatch exports and the photograph authorized by the repository owner. It does not include the Ekova reference screenshot, Ekova logo/text or an external dashboard asset pack.

| Resource | Origin and publication basis |
| --- | --- |
| `solar-house-user.png` in the four main prototype folders | User-supplied file named **Casa moderna con paneles solares al anochecer.png**, 1672×941. The owner explicitly confirmed permission to publish this photograph and the captures containing it in the public repository, without additional attribution. Copies remain byte-identical; SHA-256 `b02b77574af92fcfe16b60fbacb3c1b50273c6b54eb5d3d48ee3e04ae1e1969c`. |
| Runtime `frontend/public/images/solar-house.png` and implemented Overview screenshots | The same owner-authorized photograph is reused byte-for-byte for the requested Phase 5 implementation. Actual application captures document persisted simulated readings; they are separate from the frozen prototype captures. No additional photo authorship or standalone licensing claim is made. |
| SolarWatch review PNGs and state-gallery capture | Captured from the approved local prototypes; include simulated data and the owner-authorized photograph. These are design evidence, not application/deployment screenshots. |
| HTML/CSS, fixture JavaScript and inline SVG mark/installation drawing | Project-authored review artifacts. The original SolarWatch sun mark and neutral installation diagram do not copy the reference brand. Code and project-authored documentation follow the repository MIT license. |
| Manrope | Referenced through Google Fonts CSS, with local fallback. No font binary is redistributed in this package. |
| Ekova image | Used only as a private visual reference during review. Excluded from all versioned files; no ownership or publication permission is asserted. |

The photograph permission records authorization to publish these repository artifacts, not a claim that the maintainer created the photograph or that a separate third-party license has been verified. Do not infer a broader standalone photo license from the repository's MIT code license. Any future reuse outside this approved publication should have its own appropriate rights basis.

The same authorized photograph is kept in four source folders so the frozen approved HTML remains byte-for-byte intact and independently viewable. The portable [manifest](prototypes/manifest.json) covers these copies, all included sources and captures. Private machine paths, original external-reference files and exploratory Stitch output are not publication resources.

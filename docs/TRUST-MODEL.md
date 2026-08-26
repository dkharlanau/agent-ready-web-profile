# Resolver trust model

ARWP uses the word evidence narrowly.

Different evidence answers different questions:

| Evidence | What it can support | What it cannot support by itself |
| --- | --- | --- |
| observed HTML/HTTP | surface was publicly observable | publisher intent, runtime conformance |
| publisher metadata | publisher declared a surface | runtime availability, authorization |
| upstream-standard metadata | declaration follows a protocol | business/security trust |
| runtime observation | endpoint spoke expected protocol behavior | authorization for arbitrary actions |
| signature verification | bytes/signature/key relation verified | signer reputation or business trust |
| workflow/artifact attestation | artifact provenance/integrity | correctness of the semantic claim |

Planning must not convert source authority into a universal trust score. Conflicting evidence remains visible and can force abstention.

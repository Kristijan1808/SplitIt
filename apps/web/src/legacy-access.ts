// Read-only compatibility credential for existing group access. No account UI or login.
export function legacyCredential() { return localStorage.getItem("splitit:token"); }

# 🧪 FarmFreshFarmer — Enterprise Security Verification Checklist (OWASP ASVS & NIST Zero Trust)

This checklist provides repeatable verification procedures to validate that all zero-trust layers, cryptographic safeguards, and policy enforcement points are operating with 100% integrity.

---

## 📋 Test Matrix

| # | Test Area | Objective | Expected Result | Status |
|---|---|---|---|---|
| **1** | **WebAuthn Passkeys** | Test registration & assertion of Touch ID / YubiKey | Validates challenge & updates counter | ✅ PASS |
| **2** | **Recovery Quarantine** | Test login using offline recovery code `FFF-...` | All sessions revoked; account locked to `recoveryPending`; non-re-enrollment endpoints return `403` | ✅ PASS |
| **3** | **Anti-Enumeration Trap** | Probe `admin@farmfreshfarmer.com` with invalid password | Constant-time response (~100ms) with generic message | ✅ PASS |
| **4** | **Step-Up Authentication** | Attempt to generate recovery codes or update payment config without fresh MFA | Returns `403 { stepUpRequired: true }` | ✅ PASS |
| **5** | **CSRF & Origin Defense** | Send `POST` with forged / unauthorized `Origin` header | Returns `403 CSRF_ORIGIN_MISMATCH` | ✅ PASS |
| **6** | **HMAC Audit Chain** | Walk hash chain via `verifyAuditChain()` | Validates $100\%$ continuity without broken hashes | ✅ PASS |
| **7** | **Single-Root DB Index** | Attempt inserting second user with `is_primary_admin = true` | DB rejects with unique constraint violation | ✅ PASS |
| **8** | **Token Theft Detection** | Re-use an expired or already-rotated refresh token | Revokes entire token family & logs security incident | ✅ PASS |
| **9** | **Idle Session Timeout** | Inactive admin session after 10–15 minutes | Session expires and requires re-authentication | ✅ PASS |
| **10**| **Telegram Replay Defense** | Replay `/lock` command with expired nonce | Rejects unauthorized replay | ✅ PASS |

---

## 🛠️ Automated Verification Commands

### 1. Cryptographic HMAC Audit Chain Test
```bash
curl -s -X GET "http://localhost:5000/api/admin/security/audit-chain/verify" \
  -H "Cookie: accessToken=..." | jq .
# Expected Output: { "valid": true, "verifiedCount": 1 }
```

### 2. Step-Up Authentication Status
```bash
curl -s -X GET "http://localhost:5000/api/admin/step-up/status" \
  -H "Cookie: accessToken=..." | jq .
# Expected Output: { "isStepUpActive": false, "secondsRemaining": 0 }
```

### 3. CSRF Origin Protection Test
```bash
curl -s -X POST "http://localhost:5000/api/admin/settings" \
  -H "Origin: https://malicious-site.com" \
  -H "Content-Type: application/json" \
  -d '{"test": "val"}' | jq .
# Expected Output: { "message": "CSRF: Origin not allowed", "code": "CSRF_ORIGIN_MISMATCH" }
```

### 4. Database Single-Root Partial Unique Index Test
```sql
-- Connect via psql:
INSERT INTO users (name, email, username, password, role, is_primary_admin) 
VALUES ('Attacker', 'hacker@test.com', 'hacker', 'hash', 'admin', TRUE);
-- Expected Output: ERROR: duplicate key value violates unique constraint "single_primary_admin_idx"
```

"""iter117: PCI/PII hardening — SSN encryption + reveal audit.

Confirms:
  1. `encrypt_ssn` → `decrypt_ssn` round-trip preserves the 9-digit SSN.
  2. `ssn_last4` returns exactly the last 4 digits.
  3. `mask_ssn` returns '***-**-1234'.
  4. `POST /api/trainer/submit-background-pii` persists `ssnEncrypted` (Fernet
     token, not plaintext) + `ssnLast4`, and never persists a raw `ssn` key.
  5. `POST /api/admin/verifications/{id}/reveal-ssn` decrypts the SSN and
     inserts an audit row in `pii_access_audit` (without the raw SSN).
  6. Admin backgroundInfo view exposes `ssnMasked`, `hasSsn` — never plain SSN.
"""
import os
import sys
import asyncio
import requests
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from utils.pii_crypto import encrypt_ssn, decrypt_ssn, ssn_last4, mask_ssn  # noqa: E402

BASE = "http://localhost:8001"


def test_encrypt_decrypt_roundtrip():
    token = encrypt_ssn('123456789')
    assert token and token != '123456789'
    assert decrypt_ssn(token) == '123456789'


def test_encrypt_ignores_dashes():
    token = encrypt_ssn('123-45-6789')
    assert decrypt_ssn(token) == '123456789'


def test_last4_and_mask():
    assert ssn_last4('123456789') == '6789'
    assert mask_ssn('123456789') == '***-**-6789'
    assert mask_ssn('') == ''


def test_decrypt_bad_token_returns_empty():
    assert decrypt_ssn('not-a-token') == ''


def _login(email, password):
    r = requests.post(f"{BASE}/api/auth/login", json={'email': email, 'password': password})
    assert r.status_code == 200, r.text
    d = r.json()
    # normalize field name across auth response variants
    if 'token' not in d and 'access_token' in d:
        d['token'] = d['access_token']
    return d


def _clear_bg(user_id):
    from pymongo import MongoClient
    client = MongoClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    db.background_check_requests.delete_many({'userId': user_id})
    db.pii_access_audit.delete_many({'targetUserId': user_id})
    client.close()


def _fetch_bg_doc(user_id):
    from pymongo import MongoClient
    client = MongoClient(os.environ['MONGO_URL'])
    doc = client[os.environ['DB_NAME']].background_check_requests.find_one({'userId': user_id})
    client.close()
    return doc


def _fetch_audit(user_id):
    from pymongo import MongoClient
    client = MongoClient(os.environ['MONGO_URL'])
    doc = client[os.environ['DB_NAME']].pii_access_audit.find_one(
        {'targetUserId': user_id, 'field': 'ssn'}
    )
    client.close()
    return doc


def test_submit_bg_pii_persists_encrypted():
    t = _login('test_trainer_iter25@test.com', 'Test123!')
    trainer_id = t['user']['id']
    hdr = {'Authorization': f"Bearer {t['token']}"}
    _clear_bg(trainer_id)

    r = requests.post(f"{BASE}/api/trainer/submit-background-pii", headers=hdr, json={
        'fullName': 'Test Trainer',
        'dob': '01/01/1990',
        'ssn': '111-22-3333',
        'address': '123 Test Ln',
    })
    assert r.status_code == 200, r.text

    doc = _fetch_bg_doc(trainer_id)
    assert doc is not None
    assert 'ssn' not in doc, "raw ssn must NOT be persisted"
    assert doc.get('ssnEncrypted'), "ssnEncrypted must be set"
    assert doc['ssnEncrypted'] != '111223333'
    assert doc.get('ssnLast4') == '3333'
    assert decrypt_ssn(doc['ssnEncrypted']) == '111223333'


def test_admin_reveal_ssn_and_audit():
    t = _login('test_trainer_iter25@test.com', 'Test123!')
    trainer_id = t['user']['id']
    t_hdr = {'Authorization': f"Bearer {t['token']}"}
    _clear_bg(trainer_id)
    requests.post(f"{BASE}/api/trainer/submit-background-pii", headers=t_hdr, json={
        'fullName': 'Test Trainer',
        'dob': '01/01/1990',
        'ssn': '444556666',
        'address': '99 Test Rd',
    })

    a = _login('admin@rapidreps.com', 'admin123')
    a_hdr = {'Authorization': f"Bearer {a['token']}"}

    r = requests.post(f"{BASE}/api/admin/verifications/{trainer_id}/reveal-ssn", headers=a_hdr)
    assert r.status_code == 200, r.text
    assert r.json()['ssn'] == '444556666'
    assert r.json()['masked'] == '***-**-6666'

    audit = _fetch_audit(trainer_id)
    assert audit is not None
    assert audit['action'] == 'reveal'
    assert audit['ssnLast4'] == '6666'
    assert 'ssn' not in audit, "audit row must not contain the raw SSN"


def test_admin_details_returns_masked_only():
    t = _login('test_trainer_iter25@test.com', 'Test123!')
    trainer_id = t['user']['id']
    t_hdr = {'Authorization': f"Bearer {t['token']}"}
    _clear_bg(trainer_id)
    requests.post(f"{BASE}/api/trainer/submit-background-pii", headers=t_hdr, json={
        'fullName': 'Test Trainer',
        'dob': '01/01/1990',
        'ssn': '777889999',
        'address': '77 Sample Ave',
    })

    a = _login('admin@rapidreps.com', 'admin123')
    a_hdr = {'Authorization': f"Bearer {a['token']}"}

    r = requests.get(f"{BASE}/api/admin/verifications/{trainer_id}/detail", headers=a_hdr)
    assert r.status_code == 200, r.text
    bg = r.json().get('backgroundInfo')
    assert bg is not None
    assert bg.get('ssnMasked') == '***-**-9999'
    assert bg.get('hasSsn') is True
    assert 'ssn' not in bg
    assert 'ssnEncrypted' not in bg
